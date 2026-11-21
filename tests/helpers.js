// Shared setup for the tests. Run them with `npm test`.
//
// Each test file runs in its own process (node --test does that), so module state such
// as the job queue and the database connection doesn't leak between files.

import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { Collection } from "discord.js";

export const ROOT = new URL("../", import.meta.url);

// Enmap keeps its database in ./data and reads ./package.json, both relative to the
// working directory, and opens the database as soon as modules/settings.js is imported.
// So every test file calls this first, then imports project modules with
// `await import(...)`, and never touches the real data/ folder.
export function useTempDataDir() {
  const dir = mkdtempSync(join(tmpdir(), "ms-robot-test-"));
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "ms-robot-test", type: "module" }));
  process.chdir(dir);
  process.on("exit", () => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

export const project = (path) => import(new URL(path, ROOT).href);

// ---- Discord look-alikes. Only what the bot's code actually reads is filled in.

export function makeUser(id, username = `user${id}`) {
  return {
    id, username, tag: username, bot: false, createdTimestamp: 1_600_000_000_000,
    displayAvatarURL: () => `https://cdn.discordapp.com/avatars/${id}/a.png`,
    toString: () => `<@${id}>`,
  };
}

export function makeMember(user, roleIds = [], guildId = "g1") {
  return {
    id: user.id, user, nickname: null, joinedTimestamp: 1_650_000_000_000,
    roles: { cache: new Collection([guildId, ...roleIds].map(id => [id, { id, toString: () => `<@&${id}>` }])) },
    permissions: { has: () => true },
  };
}

export function makeGuild({ id = "g1", ownerId = "0", channels = [], roles = [], members = [] } = {}) {
  const memberMap = new Collection(members.map(m => [m.id, m]));
  return {
    id, name: "Test Server", ownerId,
    channels: { cache: new Collection(channels.map(c => [c.id, c])) },
    roles: { cache: new Collection(roles.map(r => [r.id, r])) },
    members: {
      me: {},
      cache: memberMap,
      fetch: async (q) => typeof q === "string"
        ? memberMap.get(q) ?? Promise.reject(new Error("Unknown Member"))
        : new Collection([...memberMap].filter(([, m]) => m.user.username.startsWith(q.query))),
    },
  };
}

// Records every reply so tests can look at what the user would have seen.
export function makeInteraction({ commandName, user, member, guild, options = {}, sub = null, focused = null, channel = { name: "general" } }) {
  const replies = [];
  const record = (kind) => async (payload) => { replies.push({ kind, payload }); return { createdTimestamp: Date.now() }; };
  const interaction = {
    commandName, user, member, guild, guildId: guild?.id, channel, createdTimestamp: Date.now(),
    inGuild: () => Boolean(guild),
    isMessageComponent: () => false, isModalSubmit: () => false,
    isAutocomplete: () => focused !== null, isChatInputCommand: () => focused === null,
    options: {
      getString: (k) => options[k] ?? null, getUser: (k) => options[k] ?? null, getMember: (k) => options[k] ?? null,
      getRole: (k) => options[k] ?? null, getChannel: (k) => options[k] ?? null, getInteger: (k) => options[k] ?? null,
      getBoolean: (k) => options[k] ?? null, getSubcommand: () => sub, getSubcommandGroup: () => null, getFocused: () => focused ?? "",
    },
    reply: record("reply"), editReply: record("edit"), followUp: record("followUp"), respond: record("respond"),
    update: record("update"), showModal: record("modal"),
    deferReply: async () => { interaction.deferred = true; },
    replies,
    // The text of the last reply, whichever way it was sent.
    get last() { const p = replies.at(-1)?.payload; return typeof p === "string" ? p : p?.content ?? p; },
  };
  return interaction;
}

// A button click, menu pick or form submission, routed like a real one.
export function makeComponentInteraction({ customId, user, member, guild, values, fields }) {
  const interaction = makeInteraction({ user, member, guild });
  Object.assign(interaction, {
    customId, values, fields,
    isMessageComponent: () => !fields, isModalSubmit: () => Boolean(fields), isChatInputCommand: () => false,
  });
  return interaction;
}

// Loads every command and component the way index.js does.
export async function loadContainer() {
  const { readdirSync } = await import("fs");
  const config = (await project("config.js")).default;
  const container = {
    commands: new Collection(), aliases: new Collection(), slashcmds: new Collection(), components: new Collection(),
    files: new Map(), moved: new Map(), levelCache: Object.fromEntries(config.permLevels.map(l => [l.name, l.level])),
  };
  for (const file of readdirSync(new URL("commands/", ROOT))) {
    const m = await project(`commands/${file}`);
    container.commands.set(m.help.name, m);
    m.conf.aliases.forEach(a => container.aliases.set(a, m.help.name));
  }
  for (const file of readdirSync(new URL("slash/", ROOT))) {
    const url = new URL(`slash/${file}`, ROOT).href;
    const m = await import(url);
    container.slashcmds.set(m.commandData.name, m);
    container.files.set(m.commandData.name, { kind: "slash", url });
    const rep = m.conf.replaces ?? [];
    const hints = Array.isArray(rep) ? Object.fromEntries(rep.map(o => [o, `/${m.commandData.name}`])) : rep;
    for (const [old, hint] of Object.entries(hints)) container.moved.set(old, hint);
  }
  for (const file of readdirSync(new URL("components/", ROOT))) {
    const m = await project(`components/${file}`);
    container.components.set(m.prefix, m);
  }
  return container;
}

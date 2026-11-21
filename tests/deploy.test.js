// Startup auto-deploy only talks to Discord when something changed.
import "./setup/tempDataDir.js";   // first
import { before, test } from "node:test";
import assert from "node:assert/strict";
import { ApplicationCommand, ApplicationCommandManager, Client, Collection, InteractionContextType } from "discord.js";
import { loadContainer, makeInteraction, makeUser } from "./helpers.js";
import { deployCommands, describeDeploy } from "../modules/deploy.js";
import interactionCreate from "../events/interactionCreate.js";

let container;
before(async () => { container = await loadContainer(); client.container = container; });

// Discord's copy, as real ApplicationCommand objects so the comparison is discord.js's own.
const discord = new Client({ intents: [] });
let registered = [{ name: "ping", description: "Pongs when pinged.", options: [] }];
let puts = 0, guildClears = 0;
const asCommands = (defs) => new Collection(defs.map((def, i) => {
  const api = ApplicationCommandManager.transformCommand(def);
  return [String(i), new ApplicationCommand(discord, { ...api, id: String(i), application_id: "app", version: "1", default_member_permissions: api.default_member_permissions ?? null })];
}));
const oldGuild = { commands: { fetch: async () => new Collection([["x", {}]]), set: async () => { guildClears++; } } };
const client = { guilds: { cache: new Collection([["g1", oldGuild]]) },
  application: { commands: { fetch: async () => asCommands(registered), set: async (defs) => { puts++; registered = defs; } } } };

test("first start registers everything and removes old per-server copies", async () => {
  const result = await deployCommands(client);
  assert.equal(result.updated, true);
  // The log names what's new, so a missing command is easy to spot.
  assert.ok(result.added.includes("rolepanel") && !result.added.includes("ping"));
  assert.match(describeDeploy(result), /new: .*\/rolepanel/);
  assert.equal(result.count, container.slashcmds.size);
  assert.equal(guildClears, 1);
  assert.deepEqual(registered.find(c => c.name === "settings").contexts, [InteractionContextType.Guild]);
});

test("a restart with no changes makes no updates", async () => {
  puts = 0;
  assert.equal((await deployCommands(client)).updated, false);
  assert.equal(puts, 0);
});

test("a changed command, or /deploy, re-registers", async () => {
  const joke = container.slashcmds.get("joke");
  container.slashcmds.set("joke", { ...joke, commandData: { ...joke.commandData, description: "Tells a worse joke" } });
  assert.equal((await deployCommands(client)).updated, true);
  container.slashcmds.set("joke", joke);
  assert.equal((await deployCommands(client, { force: true })).updated, true);
});

test("a server joined later needs no deploy: everything is global, nothing per server", async () => {
  guildClears = 0;
  await deployCommands(client, { force: true });
  const serverOnly = registered.filter(c => c.contexts.length === 1);
  assert.ok(serverOnly.length > 0 && serverOnly.every(c => c.contexts[0] === InteractionContextType.Guild));
  // The only per-server call is clearing copies left by the old !deploy.
  assert.ok(registered.length === container.slashcmds.size);
});

test("/reload re-registers a slash command whose definition changed", async () => {
  process.env.OWNER = "999";
  const owner = makeUser("999", "owner");
  const reload = async () => {
    const i = makeInteraction({ commandName: "reload", user: owner, member: { roles: { cache: new Collection() } }, guild: { id: "g1", ownerId: "0", roles: { cache: new Collection() } }, options: { command: "joke" } });
    await interactionCreate(client, i);
    return i.last;
  };
  // Discord still has an old description for /joke, as if the file had just been edited.
  registered = registered.map(c => (c.name === "joke" ? { ...c, description: "Old text" } : c));
  puts = 0;
  assert.match(await reload(), /reloaded\. Slash commands: registered all/);
  assert.equal(puts, 1);
  // Reloading again with nothing changed doesn't touch Discord.
  assert.match(await reload(), /already up to date/);
  assert.equal(puts, 1);
});

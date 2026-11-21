// Slash commands, buttons and forms through the real interactionCreate handler.
import "./setup/tempDataDir.js";   // first
import { before, test } from "node:test";
import assert from "node:assert/strict";
import { ChannelType, Collection, ComponentType, ModalSubmitFields } from "discord.js";
import { loadContainer, makeComponentInteraction, makeGuild, makeInteraction, makeMember, makeUser } from "./helpers.js";
import interactionCreate from "../events/interactionCreate.js";
import { getSettings } from "../modules/functions.js";

process.env.OWNER = "999";
const client = { uptime: 65_000, ws: { ping: 42 }, user: { id: "bot" },
  guilds: { cache: new Collection([["g1", { memberCount: 2, members: { cache: new Collection([["1", { user: { bot: false } }], ["2", { user: { bot: true } }]]) } }]]) },
  channels: { cache: new Collection() } };
before(async () => { client.container = await loadContainer(); });

const LOG = "111111111111111111";
const owner = makeUser("999", "owner"), member = makeUser("111", "member");
const guild = makeGuild({
  channels: [{ id: LOG, name: "message-log", type: ChannelType.GuildText }],
  roles: [{ id: "r1", name: "Mods" }],
  members: [makeMember(owner), makeMember(member)],
});
const as = (user) => ({ user, member: guild.members.cache.get(user.id), guild });
const run = async (commandName, user, extra = {}) => {
  const i = makeInteraction({ commandName, ...as(user), ...extra });
  await interactionCreate(client, i);
  return i;
};
const click = async (customId, user, extra = {}) => {
  const i = makeComponentInteraction({ customId, ...as(user), ...extra });
  await interactionCreate(client, i);
  return i;
};

test("commands above someone's level are refused", async () => {
  assert.match((await run("set", member, { sub: "view" })).last, /Administrator/);
  assert.match((await run("eval", member, { options: { code: "1" } })).last, /Bot Owner/);
});

test("/set edit checks values, and reset asks for confirmation that only the asker can give", async () => {
  assert.match((await run("set", owner, { sub: "edit", options: { key: "selfieReact", value: "ture" } })).last, /true or false/);
  await run("set", owner, { sub: "edit", options: { key: "prefix", value: "?" } });
  assert.equal(getSettings("g1").prefix, "?");

  const ask = await run("set", owner, { sub: "reset", options: { key: "prefix" } });
  const resetId = ask.replies[0].payload.components[0].components[0].data.custom_id;
  assert.match((await click(resetId, member)).last, /Only the person/);
  await click(resetId, owner);
  assert.equal(getSettings("g1").prefix, "!");
});

test("setting names autocomplete", async () => {
  const i = await run("set", owner, { focused: "mess" });
  assert.deepEqual(i.replies[0].payload.map(c => c.name), ["welcomeMessage", "messageLogChannel", "messageLogIgnore"]);
});

test("/settings: pages, a pre-filled form with pickers, and saving it", async () => {
  const panel = (await run("settings", owner)).replies[0].payload;
  assert.match(panel.embeds[0].title, /General/);

  const logging = (await click("setmenu:jump:999", owner, { values: ["3"] })).replies[0].payload;
  assert.match(logging.embeds[0].title, /Logging/);
  const form = (await click("setmenu:edit:999:3", owner)).replies[0].payload.toJSON();
  assert.deepEqual(form.components.map(l => l.component.type), [ComponentType.ChannelSelect, ComponentType.ChannelSelect, ComponentType.ChannelSelect]);

  // Submitted the way discord.js hands a real submission over.
  const picked = (customId, ids) => ({ type: ComponentType.Label, component: { type: ComponentType.ChannelSelect, customId, values: ids, channels: new Collection(ids.map(id => [id, guild.channels.cache.get(id)])) } });
  const fields = new ModalSubmitFields([picked("modLogChannel", [LOG]), picked("messageLogChannel", [LOG]), picked("messageLogIgnore", [])]);
  const saved = await click("setmenu:save:999:3", owner, { fields });
  assert.match(saved.last, /Saved/);
  assert.equal(getSettings("g1").messageLogChannel, LOG);
  assert.equal(getSettings("g1").modLogChannel, "message-log");
});

test("/reactions needs Manage Server and saves a percentage", async () => {
  await run("reactions", owner, { sub: "minecraft", options: { chance: 25 } });
  assert.equal(getSettings("g1").minecraftReactChance, "25");
  guild.members.cache.get("111").permissions.has = () => false;
  assert.match((await run("reactions", member, { sub: "minecraft", options: { chance: 100 } })).last, /Manage Server/);
  guild.members.cache.get("111").permissions.has = () => true;
});

test("/stats shows version details to the owner only", async () => {
  const forMember = (await run("stats", member)).last, forOwner = (await run("stats", owner)).last;
  assert.match(forMember, /Uptime/);
  assert.match(forMember, /People {5}:: 1\n• Bots {7}:: 1/);
  assert.doesNotMatch(forMember, /Discord\.js|Node/);
  assert.match(forOwner, /Discord\.js/);
});

test("/help only lists commands the person can use", async () => {
  const names = (i) => i.replies[0].payload.embeds[0].fields.map(f => f.value).join("\n");
  assert.doesNotMatch(names(await run("help", member)), /\/eval/);
  assert.match(names(await run("help", owner)), /\/eval/);
});

test("/config is read-only, open to moderators and up, and refused to members", async () => {
  const mod = makeUser("333", "mod");
  guild.roles.cache.set("modrole", { id: "modrole", name: "Moderator" });
  guild.members.cache.set(mod.id, makeMember(mod, ["modrole"]));
  await run("set", owner, { sub: "edit", options: { key: "prefix", value: "?" } });

  assert.match((await run("config", member)).last, /Moderator/);
  const reply = (await run("config", mod)).replies[0].payload;
  assert.equal(reply.components, undefined, "no buttons: read-only");
  const embed = reply.embeds[0];
  assert.deepEqual(embed.fields.map(f => f.name).slice(0, 5), ["General", "Roles", "Welcome", "Logging", "Reactions"]);
  assert.match(embed.fields[0].value, /Prefix for message commands: \? · `prefix`/);
  assert.match(embed.fields[1].value, /\*\(default\)\*/);
  assert.equal(embed.fields.at(-1).name, "Role commands");
});

test("/settings: the role picker takes several roles and saves their IDs", async () => {
  const A = "400000000000000001", B = "400000000000000002";
  guild.roles.cache.set(A, { id: A, name: "Verified" });
  guild.roles.cache.set(B, { id: B, name: "verified" });
  await run("set", owner, { sub: "edit", options: { key: "verifiedRole", value: "verified" } });
  assert.equal(getSettings("g1").verifiedRole, `${A},${B}`);

  // The form shows both already picked...
  const form = (await click("setmenu:edit:999:1", owner)).replies[0].payload.toJSON();
  const verified = form.components.find(l => l.component.custom_id === "verifiedRole").component;
  assert.deepEqual(verified.default_values.map(v => v.id), [A, B]);
  // ...and saving just one keeps just that one.
  const picked = { type: ComponentType.Label, component: { type: ComponentType.RoleSelect, customId: "verifiedRole", values: [B], roles: new Collection([[B, guild.roles.cache.get(B)]]) } };
  await click("setmenu:save:999:1", owner, { fields: new ModalSubmitFields([picked]) });
  assert.equal(getSettings("g1").verifiedRole, B);
});

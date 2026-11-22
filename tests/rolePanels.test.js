import "./setup/tempDataDir.js";   // first
import { before, test } from "node:test";
import assert from "node:assert/strict";
import { Collection, PermissionFlagsBits } from "discord.js";
import { loadContainer, makeComponentInteraction, makeInteraction, makeUser } from "./helpers.js";
import interactionCreate from "../events/interactionCreate.js";
import reactionAdd from "../events/messageReactionAdd.js";
import reactionRemove from "../events/messageReactionRemove.js";
import { getPanel, panelsIn } from "../modules/rolePanels.js";

// ---- a small server: roles with positions and permissions, members whose roles change
function makeRole(id, name, position, { permissions = [], managed = false } = {}) {
  return {
    id, name, position, managed, toString: () => `<@&${id}>`,
    permissions: { has: (flag) => permissions.includes(flag) },
    comparePositionTo: (other) => position - other.position,
  };
}
// Real role IDs are numbers; id("red") gives the test role's ID.
const IDS = { red: "100000000000000002", blue: "100000000000000003", artist: "100000000000000004", level10: "100000000000000005", mod: "100000000000000006", botrole: "100000000000000007", me: "100000000000000008", owner: "100000000000000009" };
const id = (key) => IDS[key];
const roles = new Collection([
  ["g1", makeRole("g1", "@everyone", 0)],
  [id("red"), makeRole(id("red"), "Red", 2)], [id("blue"), makeRole(id("blue"), "Blue", 3)],
  [id("artist"), makeRole(id("artist"), "Artist", 4)], [id("level10"), makeRole(id("level10"), "Level 10", 5)],
  [id("mod"), makeRole(id("mod"), "Mod", 6, { permissions: [PermissionFlagsBits.KickMembers] })],
  [id("botrole"), makeRole(id("botrole"), "Some Bot", 7, { managed: true })],
  [id("me"), makeRole(id("me"), "ms robot", 8)], [id("owner"), makeRole(id("owner"), "Owner", 9)],
]);
const role = (key) => roles.get(key === "g1" ? "g1" : id(key));
function makeMember(user, roleIds = []) {
  const cache = new Collection(roleIds.map(id => [id, roles.get(id)]));
  const ids = (r) => (Array.isArray(r) ? r : [r]).map(x => x.id ?? x);
  return {
    id: user.id, user, guild: null, permissions: { has: () => true },
    roles: { cache, add: async (r) => ids(r).forEach(id => cache.set(id, roles.get(id))), remove: async (r) => ids(r).forEach(id => cache.delete(id)) },
  };
}

// ---- a channel that keeps the panel message, its buttons and reactions
const posted = [];
function makeMessage(id, payload) {
  const message = {
    id, payload, reactions: { cache: new Collection(), removeAll: async () => message.reactions.cache.clear() },
    edit: async (p) => { message.payload = p; },
    delete: async () => { message.deleted = true; },
    react: async (emoji) => {
      const key = emoji.match(/:(\d+)>$/)?.[1] ?? emoji;
      const users = new Set(["bot"]);
      message.reactions.cache.set(key, { me: true, emoji: { id: key === emoji ? null : key, name: key === emoji ? emoji : "custom" }, users: { remove: async (uid) => users.delete(uid) }, remove: async () => message.reactions.cache.delete(key), _users: users });
    },
  };
  return message;
}
const channel = {
  id: "c1", isTextBased: () => true, permissionsFor: () => ({ has: () => true }),
  messages: { fetch: async (id) => posted.find(m => m.id === id && !m.deleted) ?? Promise.reject(new Error("Unknown Message")) },
  send: async (payload) => { const m = makeMessage(`m${posted.length + 1}`, payload); posted.push(m); return m; },
};
const admin = makeUser("1", "admin"), alice = makeUser("2", "alice");
const guild = {
  // The admin is the server owner, which is above the Administrator level panels need.
  id: "g1", name: "Test", ownerId: "1", roles: { cache: roles }, channels: { cache: new Collection([["c1", channel]]) },
  members: { me: { permissions: { has: () => true }, roles: { highest: role("me") } } },
};
const members = { [admin.id]: makeMember(admin, [id("owner")]), [alice.id]: makeMember(alice) };
Object.values(members).forEach(m => { m.guild = guild; });
guild.members.fetch = async (id) => members[id];
channel.guild = guild;
const client = { emojis: { cache: new Collection([["999999999999999999", {}]]) }, channels: { cache: new Collection([["c1", channel]]) } };
before(async () => { client.container = await loadContainer(); });

const rolepanel = async (sub, options = {}, user = admin) => {
  const i = makeInteraction({ commandName: "rolepanel", sub, options, user, member: members[user.id], guild, channel });
  await interactionCreate(client, i);
  return i.last;
};
const press = async (panel, roleId, user = alice) => {
  const i = makeComponentInteraction({ customId: `rolepick:${panel.id}:${roleId}`, user, member: members[user.id], guild });
  await interactionCreate(client, i);
  return i.last;
};
const has = (user, roleId) => members[user.id].roles.cache.has(roleId);

// ---------------------------------------------------------------- buttons, pick one
test("creating a panel posts it; roles are checked before they're added", async () => {
  assert.match(await rolepanel("create", { title: "Colours", style: "buttons", mode: "single" }), /Posted \*\*Colours\*\*/);
  const panel = panelsIn("g1")[0];
  assert.match(await rolepanel("add", { panel: panel.id, role: id("red"), emoji: "🔴" }), /Added/);
  assert.match(await rolepanel("add", { panel: panel.id, role: id("blue"), label: "Blue team", emoji: "<:blue:999999999999999999>" }), /Added/);

  assert.match(await rolepanel("add", { panel: panel.id, role: id("mod") }), /powerful permissions/);
  assert.match(await rolepanel("add", { panel: panel.id, role: id("botrole") }), /managed by a bot/);
  assert.match(await rolepanel("add", { panel: panel.id, role: id("owner") }), /above my highest role/);
  assert.match(await rolepanel("add", { panel: panel.id, role: "@everyone" }), /@everyone/);
  assert.match(await rolepanel("add", { panel: panel.id, role: id("artist"), emoji: "not an emoji" }), /isn't a single emoji/);
  assert.match(await rolepanel("add", { panel: panel.id, role: id("artist"), emoji: "<:other:123456789012345678>" }), /servers I'm in/);
  assert.match(await rolepanel("add", { panel: panel.id, role: id("artist"), requires: id("artist") }), /require itself/);
  assert.match(await rolepanel("add", { panel: panel.id, role: id("red") }, alice), /needs the Administrator level/);

  const buttons = posted[0].payload.components.flatMap(r => r.toJSON().components);
  assert.deepEqual(buttons.map(b => b.label), ["Red", "Blue team"]);
  assert.deepEqual(buttons.map(b => b.custom_id), [`rolepick:${panel.id}:${id("red")}`, `rolepick:${panel.id}:${id("blue")}`]);
});

test("pick one: picking swaps the old role out, picking yours again removes it", async () => {
  const panel = panelsIn("g1")[0];
  assert.equal(await press(panel, id("red")), `Added <@&${id("red")}>.`);
  assert.equal(await press(panel, id("blue")), `Added <@&${id("blue")}> (instead of <@&${id("red")}>).`);
  assert.ok(has(alice, id("blue")) && !has(alice, id("red")));
  assert.equal(await press(panel, id("blue")), `Removed <@&${id("blue")}>.`);
  assert.ok(!has(alice, id("blue")));
});

// ---------------------------------------------------------------- buttons, pick any, prerequisites
test("pick any, with a prerequisite that can be any role", async () => {
  await rolepanel("create", { title: "Extras", style: "buttons", mode: "multiple" });
  const panel = panelsIn("g1").find(p => p.title === "Extras");
  await rolepanel("add", { panel: panel.id, role: id("red") });
  await rolepanel("add", { panel: panel.id, role: id("artist"), requires: id("level10") });

  assert.equal(await press(panel, id("artist")), `You need <@&${id("level10")}> before you can pick <@&${id("artist")}>.`);
  assert.ok(!has(alice, id("artist")));
  members[alice.id].roles.cache.set(id("level10"), role("level10"));
  await press(panel, id("artist"));
  await press(panel, id("red"));
  assert.ok(has(alice, id("artist")) && has(alice, id("red")), "both kept: pick any");

  // Losing the prerequisite doesn't take anything away.
  members[alice.id].roles.cache.delete(id("level10"));
  assert.ok(has(alice, id("artist")));
  assert.ok(posted.at(-1).payload.embeds[0].description.includes(`needs <@&${id("level10")}>`));
});

test("a role that became unsafe after it was added is refused at click time", async () => {
  const panel = panelsIn("g1").find(p => p.title === "Extras");
  members[alice.id].roles.cache.delete(id("red"));
  role("red").permissions.has = (flag) => flag === PermissionFlagsBits.Administrator;
  assert.match(await press(panel, id("red")), /powerful permissions/);
  role("red").permissions.has = () => false;
});

// ---------------------------------------------------------------- reactions
const react = async (message, emoji, user, add = true) => {
  const reaction = message.reactions.cache.get(emoji) ?? { emoji: { id: null, name: emoji }, users: { remove: async () => {} } };
  reaction.message = { id: message.id, guild, reactions: message.reactions };
  if (add) reaction._users?.add(user.id);
  await (add ? reactionAdd : reactionRemove)(client, reaction, { ...user, bot: false, send: async (t) => dms.push(t) });
};
const dms = [];

test("reaction panels need an emoji for every role, and the bot adds the reactions", async () => {
  await rolepanel("create", { title: "Pronouns", style: "reactions", mode: "single" });
  const panel = panelsIn("g1").find(p => p.title === "Pronouns");
  assert.match(await rolepanel("add", { panel: panel.id, role: id("red") }), /need an emoji/);
  await rolepanel("add", { panel: panel.id, role: id("red"), emoji: "🔴" });
  await rolepanel("add", { panel: panel.id, role: id("blue"), emoji: "🔵" });
  await rolepanel("add", { panel: panel.id, role: id("artist"), emoji: "🎨", requires: id("level10") });
  const message = posted.find(m => m.id === getPanel(panel.id).messageId);
  assert.deepEqual([...message.reactions.cache.keys()], ["🔴", "🔵", "🎨"]);
  assert.equal(message.payload.components.length, 0, "no buttons on a reaction panel");
});

test("reacting picks, swapping takes back the old reaction, un-reacting removes the role", async () => {
  const panel = panelsIn("g1").find(p => p.title === "Pronouns");
  const message = posted.find(m => m.id === getPanel(panel.id).messageId);
  members[alice.id].roles.cache.clear();

  await react(message, "🔴", alice);
  assert.ok(has(alice, id("red")));
  await react(message, "🔵", alice);
  assert.ok(has(alice, id("blue")) && !has(alice, id("red")));
  assert.ok(!message.reactions.cache.get("🔴")._users.has(alice.id), "old reaction taken back");
  await react(message, "🔵", alice, false);
  assert.ok(!has(alice, id("blue")));
});

test("a refused reaction is taken back and explained by DM", async () => {
  const panel = panelsIn("g1").find(p => p.title === "Pronouns");
  const message = posted.find(m => m.id === getPanel(panel.id).messageId);
  await react(message, "🎨", alice);
  assert.ok(!has(alice, id("artist")));
  assert.ok(!message.reactions.cache.get("🎨")._users.has(alice.id));
  assert.match(dms.at(-1), /You need @Level 10 before you can pick @Artist/);
});

// ---------------------------------------------------------------- editing
test("switching style moves between buttons and reactions", async () => {
  const panel = panelsIn("g1").find(p => p.title === "Colours");
  const message = posted.find(m => m.id === getPanel(panel.id).messageId);
  await rolepanel("edit", { panel: panel.id, style: "reactions" });
  assert.equal(message.payload.components.length, 0);
  assert.equal(message.reactions.cache.size, 2);
  await rolepanel("edit", { panel: panel.id, style: "buttons", title: "Colour roles" });
  assert.equal(message.reactions.cache.size, 0);
  assert.equal(message.payload.embeds[0].title, "Colour roles");
});

test("a deleted panel message is posted again on the next change", async () => {
  const panel = panelsIn("g1").find(p => p.title === "Extras");
  posted.find(m => m.id === getPanel(panel.id).messageId).deleted = true;
  await rolepanel("remove", { panel: panel.id, role: id("red") });
  assert.notEqual(getPanel(panel.id).messageId, panel.messageId);
});

test("deleting a panel removes its message; its old buttons say so", async () => {
  const panel = panelsIn("g1").find(p => p.title === "Extras");
  assert.match(await rolepanel("delete", { panel: panel.id }), /Deleted/);
  assert.equal(getPanel(panel.id), null);
  assert.match(await press(panel, id("artist")), /deleted/);
});

// ---------------------------------------------------------------- who can set up panels
test("moderators can manage panels only when the server allows it", async () => {
  const { settings } = await import("../modules/settings.js");
  const mod = makeUser("3", "mod");
  members[mod.id] = makeMember(mod, [id("mod")]);
  members[mod.id].guild = guild;
  settings.set("g1", { modRole: id("mod") });
  assert.match(await rolepanel("list", {}, mod), /needs the Administrator level/);

  settings.set("g1", { modRole: id("mod"), rolePanelAccess: "moderator" });
  assert.doesNotMatch(await rolepanel("list", {}, mod), /needs the/);
  assert.match(await rolepanel("list", {}, alice), /needs the Moderator level/, "members still can't");
});

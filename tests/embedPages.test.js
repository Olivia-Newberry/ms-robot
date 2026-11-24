// Long lists split over embeds and messages (modules/embedPages.js), and /roleconfig
// list with more roles than one message holds.
import "./setup/tempDataDir.js";   // first
import { before, test } from "node:test";
import assert from "node:assert/strict";
import { listMessages } from "../modules/embedPages.js";
import { settings } from "../modules/settings.js";
import { loadContainer, makeGuild, makeInteraction, makeMember, makeUser } from "./helpers.js";
import interactionCreate from "../events/interactionCreate.js";

const roleLine = (n) => `<@&${String(n).padStart(19, "1")}> (\`${String(n).padStart(19, "1")}\`)`;
const within = (m) => {
  const total = m.embeds.reduce((sum, e) => sum + e.data.title.length + e.data.description.length, 0);
  assert.ok(m.embeds.length <= 10 && total <= 6000, `message too big: ${m.embeds.length} embeds, ${total} characters`);
  for (const e of m.embeds) assert.ok(e.data.description.length <= 4096 && e.data.title.length <= 256);
};

test("short lists fit in one message, one embed per section", () => {
  const messages = listMessages([{ title: "A (2)", lines: ["x", "y"] }, { title: "B (0)", lines: [] }]);
  assert.equal(messages.length, 1);
  assert.deepEqual(messages[0].embeds.map(e => [e.data.title, e.data.description]), [["A (2)", "x\ny"], ["B (0)", "*none*"]]);
});

test("long lists carry on in more embeds and messages, without splitting or losing a line", () => {
  const lines = Array.from({ length: 500 }, (_, n) => roleLine(n));
  const messages = listMessages([{ title: "Roles (500)", lines }]);
  assert.ok(messages.length > 1);
  messages.forEach(within);
  const embeds = messages.flatMap(m => m.embeds);
  assert.equal(embeds[0].data.title, "Roles (500)");
  assert.equal(embeds[1].data.title, "Roles (500) (continued)");
  assert.deepEqual(embeds.flatMap(e => e.data.description.split("\n")), lines);
});

const client = { user: { id: "bot" } };
const owner = makeUser("10", "owner");
const ids = Array.from({ length: 120 }, (_, n) => String(n).padStart(19, "2"));
const guild = makeGuild({ id: "g-roles", ownerId: owner.id, roles: ids.map(id => ({ id, name: `role ${id}`, toString: () => `<@&${id}>` })), members: [makeMember(owner)] });
before(async () => {
  client.container = await loadContainer();
  settings.set(guild.id, { assignableRoles: ids.join(" "), roleManagerRoles: ids.slice(0, 3).join(" ") });
});

test("/roleconfig list shows every role however many there are", async () => {
  const i = makeInteraction({ commandName: "roleconfig", sub: "list", user: owner, member: guild.members.cache.get(owner.id), guild });
  await interactionCreate(client, i);
  const sent = i.replies.filter(r => ["reply", "followUp"].includes(r.kind)).map(r => r.payload);
  assert.ok(sent.every(p => p.embeds?.length), JSON.stringify(sent).slice(0, 300));
  sent.forEach(within);
  const text = sent.flatMap(p => p.embeds).map(e => e.data.description).join("\n");
  for (const id of ids) assert.ok(text.includes(id), `role ${id} missing`);
  assert.match(sent[0].embeds[0].data.title, /Can be assigned \(120\)/);
});

// !user (message command) and /userinfo, including the message count.
import "./setup/tempDataDir.js";   // first
import { before, test } from "node:test";
import assert from "node:assert/strict";
import { Collection } from "discord.js";
import { loadContainer, makeGuild, makeInteraction, makeMember, makeUser } from "./helpers.js";
import messageCreate from "../events/messageCreate.js";
import interactionCreate from "../events/interactionCreate.js";


const ALICE = "1234567890123456789";
const bot = makeUser("bot1", "ms robot"), alice = makeUser(ALICE, "alice"), bob = makeUser("987654321098765432", "bob");
const users = { [bot.id]: bot, [alice.id]: alice, [bob.id]: bob };
const guild = makeGuild({ members: [makeMember(alice), makeMember(bob)] });
let searchResult = { total_results: 320 };
const client = { user: bot, users: { fetch: async id => users[id] ?? Promise.reject(new Error("Unknown User")) },
  rest: { get: async () => { if (searchResult instanceof Error) throw searchResult; return searchResult; } } };
before(async () => { client.container = await loadContainer(); });

async function say(content, channel = { name: "general" }) {
  const sent = [];
  const mentioned = [...content.matchAll(/<@!?(\w+)>/g)].map(m => users[m[1]]);
  await messageCreate(client, {
    content, author: bob, guild, member: guild.members.cache.get(bob.id), attachments: new Collection(),
    mentions: { users: new Collection(mentioned.map(u => [u.id, u])) },
    channel: { ...channel, send: async p => sent.push(p) }, reply: async p => sent.push(p),
  });
  return sent;
}
const fields = (payload) => Object.fromEntries(payload.embeds[0].toJSON().fields.map(f => [f.name, f.value]));

test("!user finds people by mention, ID and name, and shows their ID and message count", async () => {
  for (const query of [`<@${ALICE}>`, ALICE, "alice"]) {
    const [reply] = await say(`!user ${query}`);
    assert.equal(fields(reply)["User ID:"], `\`${ALICE}\``, query);
    assert.equal(fields(reply)["Messages sent:"], "320");
  }
});

test("\"@bot user name\" looks up the name, not the bot", async () => {
  const [reply] = await say(`<@${bot.id}> user alice`);
  assert.equal(fields(reply)["User ID:"], `\`${ALICE}\``);
});

test("!user in a mod thread posts the thread's user", async () => {
  const thread = { name: "t", parent: { name: "Open Threads", parent: null },
    messages: { fetch: async () => new Collection([["2", { id: "2", content: `Thread for ${ALICE}` }], ["1", { id: "1", content: "651034500897439745 header" }]]) } };
  const [reply] = await say("!user", thread);
  assert.match(reply.content, new RegExp(`Thread userID = ${ALICE}`));
  // Categories named for tickets count too, e.g. "Mod Tickets".
  const ticket = { ...thread, parent: { name: "Mod Tickets", parent: null } };
  assert.match((await say("!user", ticket))[0].content, new RegExp(`Thread userID = ${ALICE}`));
});

test("old prefix names point to their slash command, but only when the bot is mentioned", async () => {
  assert.match((await say(`<@${bot.id}> dog`))[0].content, /\/animal kind:dog/);
  // "!help" may well be meant for another bot with the same prefix.
  assert.deepEqual(await say("!help"), []);
});

test("message count: 'still indexing' while Discord builds the index, left out if unavailable", async () => {
  searchResult = { code: 110000, retry_after: 2 };
  assert.match(fields((await say("!user alice"))[0])["Messages sent:"], /indexing/);
  searchResult = new Error("Missing Access");
  const i = makeInteraction({ commandName: "userinfo", user: bob, member: guild.members.cache.get(bob.id), guild, options: { user: alice } });
  await interactionCreate(client, i);
  assert.equal(fields(i.replies.at(-1).payload)["Messages sent:"], undefined);
});

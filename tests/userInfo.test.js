// !user (message command) and /userinfo, including the message count.
import "./setup/tempDataDir.js";   // first
import { before, test } from "node:test";
import assert from "node:assert/strict";
import { Collection } from "discord.js";
import { loadContainer, makeGuild, makeInteraction, makeMember, makeUser } from "./helpers.js";
import messageCreate from "../events/messageCreate.js";
import interactionCreate from "../events/interactionCreate.js";
import config from "../config.js";


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
  // A bot that opens threads with its own ID (MOD_THREAD_SKIP_IDS in .env).
  config.modThreadSkipIds = ["100000000000000002"];
  const thread = { name: "t", parent: { name: "Open Threads", parent: null },
    messages: { fetch: async () => new Collection([["2", { id: "2", content: `Thread for ${ALICE}` }], ["1", { id: "1", content: "100000000000000002 header" }]]) } };
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

// ---------------------------------------------------------------- people who aren't members
test("people who've left: profile, a clear banner, ban status and messages here, never other servers", async () => {
  const gone = makeUser("111111111111111111", "goneuser");
  const lookalike = makeUser("222222222222222222", "alicea");     // banned, name contains "alice"
  users[gone.id] = gone;
  const bans = new Collection([[gone.id, { user: gone, reason: "spam links" }], [lookalike.id, { user: lookalike, reason: null }]]);
  guild.members.me = { permissions: { has: () => true } };        // can see bans
  guild.bans = {
    fetch: async (options) => {
      if (options?.user) {
        const ban = bans.get(options.user);
        if (ban) return ban;
        throw Object.assign(new Error("Unknown Ban"), { code: 10026 });
      }
      return bans;
    },
  };
  searchResult = { total_results: 42 };

  // By ID: not a member, banned here with a reason, and their messages here still count.
  const [byId] = await say(`!user ${gone.id}`);
  const embed = byId.embeds[0].toJSON();
  assert.match(embed.description, /Not a member of this server/);
  assert.equal(fields(byId)["Banned here:"], "Yes: spam links");
  assert.equal(fields(byId)["Messages sent:"], "42");
  assert.equal(fields(byId)["Roles:"], undefined);

  // By name: no member called that, so this server's ban list is searched.
  const [byName] = await say("!user goneuser");
  assert.match(byName.embeds[0].toJSON().description, /Found in this server's ban list/);

  // A current member always wins, even if a banned user's name also fits.
  const [member] = await say("!user alice");
  assert.equal(fields(member)["User ID:"], `\`${ALICE}\``);

  // Nothing anywhere in this server: say so, and suggest using an ID.
  assert.match((await say("!user nobody-at-all"))[0].content, /No member of this server matches "nobody-at-all"\. If they've left, look them up by their ID/);
});

test("without Ban Members, ban details are simply left out", async () => {
  guild.members.me = { permissions: { has: () => false } };
  const [reply] = await say("!user 111111111111111111");
  assert.match(reply.embeds[0].toJSON().description, /Not a member/);
  assert.equal(fields(reply)["Banned here:"], undefined);
  assert.match((await say("!user goneuser"))[0].content, /No member of this server matches/);
});

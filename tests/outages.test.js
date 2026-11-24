// Discord outages, the bot being removed from a server, and logging in while Discord is down.
import "./setup/tempDataDir.js";   // first
import { test } from "node:test";
import assert from "node:assert/strict";
import { Collection } from "discord.js";
import guildAvailable from "../events/guildAvailable.js";
import guildCreate from "../events/guildCreate.js";
import guildDelete from "../events/guildDelete.js";
import * as jobs from "../modules/jobs.js";
import { prepareGuild, settled } from "../modules/guildSetup.js";
import { loginWithRetry } from "../modules/lifecycle.js";
import { getPanel, newPanel } from "../modules/rolePanels.js";
import { settings } from "../modules/settings.js";

test.after(() => jobs.stopJobs(0));

function server(id, { available = true } = {}) {
  const loaded = [];
  return {
    id, name: `Server ${id}`, available, memberCount: 0, loaded,
    roles: { cache: new Collection() }, channels: { cache: new Collection() },
    members: { me: {}, cache: new Collection(), fetch: async () => { loaded.push("members"); } },
  };
}

test("a server back from an outage gets the startup work it missed", async () => {
  const guild = server("g1", { available: false });
  await prepareGuild({}, guild);
  assert.deepEqual(guild.loaded, [], "nothing while it's unavailable");
  guild.available = true;
  guildAvailable({ isReady: () => true }, guild);
  await settled();
  assert.deepEqual(guild.loaded, ["members"]);
});

test("an outage never deletes anything", () => {
  settings.set("g2", { prefix: "?" });
  guildDelete({}, { ...server("g2"), available: false });
  assert.equal(settings.get("g2").prefix, "?");
  assert.equal(jobs.findJobs(j => j.type === "forgetGuild").length, 0);
});

test("removal keeps a server's setup for 30 days, and re-adding the bot keeps it for good", () => {
  settings.set("g3", { prefix: "?" });
  guildDelete({}, server("g3"));
  const [forget] = jobs.findJobs(j => j.type === "forgetGuild" && j.data.guildId === "g3");
  const days = (forget.runAt - Date.now()) / 86_400_000;
  assert.ok(days > 29.9 && days <= 30);
  assert.equal(settings.get("g3").prefix, "?", "nothing deleted yet");

  guildCreate({}, server("g3"));
  assert.equal(jobs.findJobs(j => j.type === "forgetGuild" && j.data.guildId === "g3").length, 0);
});

test("after 30 days away, settings and role panels are deleted (unless the bot is back)", async () => {
  settings.set("gone", { prefix: "?" });
  settings.set("back", { prefix: "!" });
  const panel = newPanel({ guildId: "gone", channelId: "c", title: "Colours", style: "buttons", mode: "single", createdBy: "1" });
  jobs.startJobs({ guilds: { cache: new Collection([["back", {}]]) } });
  jobs.schedule("forgetGuild", { guildId: "gone" }, { lane: "gone" });
  jobs.schedule("forgetGuild", { guildId: "back" }, { lane: "back" });
  await new Promise(r => setTimeout(r, 200));
  assert.equal(settings.has("gone"), false);
  assert.equal(getPanel(panel.id), null);
  assert.equal(settings.get("back").prefix, "!");
});

test("failed sends keep being retried through a long outage, then give up after a day", async () => {
  let calls = 0;
  jobs.registerJobType("alwaysDown", { async run() { calls++; throw new Error("503 Service Unavailable"); } });
  const id = jobs.schedule("alwaysDown", {});
  await new Promise(r => setTimeout(r, 100));
  const [job] = jobs.findJobs(j => j.id === id);
  assert.equal(job.attempts, 1);

  // Pretend it has been failing for hours: still retried, and the wait is capped.
  Object.assign(job, { attempts: 10, firstFailedAt: Date.now() - 5 * 3600_000, runAt: Date.now() });
  jobs.schedule("noop", {});    // nudges the scheduler
  await new Promise(r => setTimeout(r, 100));
  assert.ok(jobs.findJobs(j => j.id === id).length === 1, "not given up after 11 attempts");
  assert.ok(job.runAt - Date.now() <= 15 * 60_000 + 1000, "waits at most 15 minutes");

  // A day after the first failure, it's given up (and kept on record in quarantine).
  Object.assign(job, { firstFailedAt: Date.now() - 25 * 3600_000, runAt: Date.now() });
  jobs.schedule("noop", {});
  await new Promise(r => setTimeout(r, 100));
  assert.equal(jobs.findJobs(j => j.id === id).length, 0);
  assert.ok(calls >= 3);
});

test("logging in is retried while Discord is down, with growing waits", async () => {
  const waits = [];
  let attempts = 0;
  const client = { login: async () => { if (++attempts < 4) throw Object.assign(new Error("fetch failed"), { code: "ECONNRESET" }); return "ok"; }, destroy: async () => {} };
  const result = await loginWithRetry(client, "token", { firstWait: 5, maxWait: 15, sleep: async (ms) => { waits.push(ms); } });
  assert.equal(result, "ok");
  assert.deepEqual(waits, [5, 10, 15]);
});

test("a wrong token isn't retried", async () => {
  let gaveUp = null;
  const client = { login: async () => { throw Object.assign(new Error("An invalid token was provided."), { code: "TokenInvalid" }); }, destroy: async () => {} };
  await loginWithRetry(client, "bad", { sleep: async () => assert.fail("shouldn't wait"), giveUp: (e) => { gaveUp = e.code; } });
  assert.equal(gaveUp, "TokenInvalid");
});

test("servers arriving while the bot connects aren't treated as an outage ending", async () => {
  const guild = server("connecting");
  guildAvailable({ isReady: () => false }, guild);
  await settled();
  assert.deepEqual(guild.loaded, []);
});

test("the same server isn't prepared twice in a row", async () => {
  const guild = server("twice");
  prepareGuild({}, guild);
  prepareGuild({}, guild);
  await settled();
  assert.deepEqual(guild.loaded, ["members"], "one member-list request, not two");
});

test("a rate-limited member list is fetched again after Discord's wait", async () => {
  const { cacheMembers } = await import("../modules/memberCounts.js");
  let calls = 0;
  const waits = [];
  const guild = { name: "busy", members: { fetch: async () => {
    if (++calls === 1) throw Object.assign(new Error("Request with opcode 8 was rate limited."), { name: "GatewayRateLimitError", data: { retry_after: 26.5 } });
  } } };
  await cacheMembers([guild], { sleep: async (ms) => { waits.push(ms); } });
  assert.equal(calls, 2);
  assert.deepEqual(waits, [27_000]);
});

test("every server's busy channels are refilled before any server's quiet ones", async () => {
  const { SnowflakeUtil } = await import("discord.js");
  settings.set("s1", { messageLogChannel: "log1" });
  settings.set("s2", { messageLogChannel: "log2" });
  const order = [];
  const posted = (hoursAgo) => SnowflakeUtil.generate({ timestamp: Date.now() - hoursAgo * 3600_000 }).toString();
  const channel = (id, hoursAgo) => ({
    id, parentId: null, isTextBased: () => true, isThread: () => false, lastMessageId: posted(hoursAgo),
    permissionsFor: () => ({ has: () => true }),
    messages: { cache: new Collection(), fetch: async ({ limit }) => { order.push(`${id}:${limit}`); return new Collection(); } },
  });
  const withChannels = (id, channels) => Object.assign(server(id), { channels: { cache: new Collection(channels.map(c => [c.id, c])) } });
  prepareGuild({}, withChannels("s1", [channel("s1-old", 24 * 60), channel("s1-busy", 1)]));
  prepareGuild({}, withChannels("s2", [channel("s2-old", 24 * 60), channel("s2-busy", 1)]));
  await settled();
  assert.deepEqual(order, ["s1-busy:100", "s2-busy:100", "s1-old:50", "s2-old:50"]);
});

test("each refill pass says when it starts, only for servers using the message log", async (t) => {
  const lines = [];
  t.mock.method(console, "log", (line) => lines.push(String(line)));
  settings.set("logging", { messageLogChannel: "log" });
  prepareGuild({}, server("logging"));
  prepareGuild({}, server("not-logging"));
  await settled();
  const starts = lines.filter(l => l.includes("filling the message cache"));
  assert.equal(starts.length, 2);
  assert.match(starts[0], /Server logging: filling the message cache from channels active in the last 3 days/);
  assert.match(starts[1], /filling the message cache from channels inactive for 3 days or more \(their last 50 messages each\)/);
});

test("a final line says when everything has finished loading", async (t) => {
  const lines = [];
  t.mock.method(console, "log", (line) => lines.push(String(line)));
  const cached = new Collection([["c1", { messages: { cache: new Collection([["m1", { content: "hi", embeds: [], attachments: new Collection() }]]) } }]]);
  prepareGuild({ channels: { cache: cached } }, server("final-1"));
  prepareGuild({ channels: { cache: cached } }, server("final-2"));
  await settled();
  const last = lines.filter(l => l.includes("Finished loading")).at(-1);
  assert.match(last, /Finished loading 2 servers in \d+s: member lists loaded, 1 message cached\./);
  assert.ok(lines.indexOf(last) === lines.length - 1 || lines.slice(lines.indexOf(last) + 1).every(l => !l.includes("Message log")), "it comes after the message log lines");
});

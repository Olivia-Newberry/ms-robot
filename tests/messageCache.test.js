// The message cache: its memory budget, and refilling it at startup for the message log.
import "./setup/tempDataDir.js";   // first
import { test } from "node:test";
import assert from "node:assert/strict";
import { Collection, SnowflakeUtil } from "discord.js";
import config from "../config.js";
import { settings } from "../modules/settings.js";
import { refillMessageCache } from "../modules/messageLog.js";
import { cacheSize, checkMessageCache, estimateBytes } from "../modules/messageCache.js";

// ---- keeping the cache in check

const NOW = Date.now();
const MB = 1024 * 1024;
const message = (id, minutesAgo, content = "hi") => ({ id, createdTimestamp: NOW - minutesAgo * 60_000, content, embeds: [], attachments: new Collection() });
function channelWith(name, count, { startMinutesAgo = 0, content } = {}) {
  const cache = new Collection();
  for (let i = 0; i < count; i++) cache.set(`${name}-${i}`, message(`${name}-${i}`, startMinutesAgo + i, content));
  return { messages: { cache } };
}
const plenty = { available: 600 * MB, total: 1000 * MB };
const low = { available: 120 * MB, total: 1000 * MB };          // 12%, under a 30% reserve
const roomyHeap = { used: 40 * MB, limit: 400 * MB };
const limits = (extra = {}) => ({ reservePercent: 30, basePerChannel: 200, keepPerChannel: 50, heap: roomyHeap, ...extra });

test("bigger messages count for more", () => {
  assert.ok(estimateBytes(message("a", 0, "x".repeat(2000))) > estimateBytes(message("b", 0, "hi")));
  assert.ok(estimateBytes({ ...message("c", 0), embeds: [{}], attachments: new Collection([["1", {}]]) }) > estimateBytes(message("d", 0)));
});

test("with memory to spare and under the ceiling, nothing is touched", () => {
  const busy = channelWith("busy", 200);
  const result = checkMessageCache([busy], limits({ host: plenty }));
  assert.deepEqual(result.reason, null);
  assert.equal(busy.messages.cache.size, 200);
});

test("a busy channel can hold up to 1,000 during a burst while memory allows", () => {
  const burst = channelWith("burst", 1000);
  const result = checkMessageCache([burst], limits({ host: plenty }));
  assert.equal(result.removed, 0);
  assert.equal(burst.messages.cache.size, 1000);
});

test("when the server runs low, a quarter goes: burst extras first, then the oldest of the rest", () => {
  const burst = channelWith("burst", 600);                                // newest messages
  const quiet = channelWith("quiet", 120, { startMinutesAgo: 10_000 });  // a week old
  const before = cacheSize([burst, quiet]).bytes;
  const { reason, removed, bytes } = checkMessageCache([burst, quiet], limits({ host: low }));
  assert.match(reason, /only 120 MB \(12%\) available, under its 30% reserve/);
  assert.ok(removed > 0 && bytes <= before * 0.75);
  // The quarter came out of the burst's extras, even though the quiet channel's
  // messages are older: its usual 120 are left alone.
  assert.equal(quiet.messages.cache.size, 120);
  assert.ok(burst.messages.cache.size < 600 && burst.messages.cache.size >= 200);
  assert.ok(burst.messages.cache.has("burst-0"), "the burst's newest are kept");
});

test("once burst extras are gone, the oldest of everyone's usual messages go next", () => {
  const busy = channelWith("busy", 200);                                  // no extras
  const quiet = channelWith("quiet", 120, { startMinutesAgo: 10_000 });
  checkMessageCache([busy, quiet], limits({ host: low }));
  assert.equal(quiet.messages.cache.size, 50, "the week-old messages went first, down to the newest 50");
  assert.ok(busy.messages.cache.has("busy-0") && busy.messages.cache.size >= 190, "only the busy channel's oldest few");
});

test("near Node's own memory limit, the bot trims even with the server roomy", () => {
  const huge = channelWith("huge", 900);
  const nearLimit = { used: 320 * MB, limit: 400 * MB };              // 80%, past 75%
  const { reason, removed } = checkMessageCache([huge], limits({ host: plenty, heap: nearLimit }));
  assert.match(reason, /JavaScript memory is at 320 MB, past 75% of Node's 400 MB limit/);
  assert.ok(removed > 0);
});

test("the limits scale with the server: no fixed share to outgrow", () => {
  const busy = channelWith("busy", 900);
  const bigServer = { total: 64 * 1024 * MB, available: 50 * 1024 * MB };
  const bigHeap = { used: 400 * MB, limit: 4096 * MB };
  assert.equal(checkMessageCache([busy], limits({ host: bigServer, heap: bigHeap })).reason, null);
});

test("every channel keeps its newest few through any cleanup", () => {
  const huge = channelWith("huge", 200, { content: "x".repeat(500) });
  const small = [1, 2, 3].map(n => channelWith(`small${n}`, 20, { startMinutesAgo: 100_000 }));
  // Squeezed repeatedly by a very low server, until only the floors are left.
  for (let i = 0; i < 20; i++) checkMessageCache([huge, ...small], limits({ host: low }));
  assert.ok(small.every(c => c.messages.cache.size === 20), "channels under the floor are untouched");
  assert.equal(huge.messages.cache.size, 50);
});

test("default settings: 200 per channel, bursts to 1,000, and a reserve kept free", () => {
  const { basePerChannel, perChannel, hostReservePercent, keepPerChannel, refill, refillWithinHours } = config.messageCache;
  assert.equal(basePerChannel, 200);
  assert.equal(perChannel, 1000);
  assert.ok(hostReservePercent > 0 && hostReservePercent < 100);
  assert.ok(keepPerChannel < perChannel);
  assert.ok(refill > 0 && refill <= 100 && refillWithinHours > 0);
  assert.ok(keepPerChannel > 0 && keepPerChannel <= refill, "quiet channels are refilled up to the floor");
});

// ---- refilling at startup

const fetched = [];
const postedHoursAgo = (hours) => SnowflakeUtil.generate({ timestamp: NOW - hours * 3600 * 1000 }).toString();
const joins = [];
function channel(id, { parentId = null, thread = false, readable = true, text = true, lastPost = 1, joined = true } = {}) {
  return {
    id, parentId, isTextBased: () => text, isThread: () => thread, joined, joinable: true,
    join: async () => { joins.push(id); },
    lastMessageId: lastPost === null ? null : postedHoursAgo(lastPost),
    permissionsFor: () => ({ has: () => readable }),
    // Like discord.js: fetched messages go into the cache, and so does the message a
    // reply points to, here one outside the fetched three.
    messages: (() => {
      const cache = new Collection();
      return { cache, fetch: async ({ limit }) => {
        fetched.push([id, limit]);
        const got = new Collection(Array.from({ length: 3 }, (_, i) => [`${id}-${i}`, {}]));
        for (const [key, m] of got) cache.set(key, m);
        cache.set(`${id}-replied-to`, {});
        return got;
      } };
    })(),
  };
}
const guild = (id, channels) => ({ id, members: { me: {} }, channels: { cache: new Collection(channels.map(c => [c.id, c])) } });

test("refill fetches from every channel and thread the log covers: 100 from active ones, fewer from quiet ones", async () => {
  settings.set("logged", { messageLogChannel: "log", messageLogIgnore: "staffCategory ignoredChannel" });
  const servers = [
    guild("logged", [
      channel("general"), channel("memes"),
      channel("log"),                                   // the log channel itself
      channel("ignoredChannel"),
      channel("staff-chat", { parentId: "staffCategory" }),
      channel("a-thread", { thread: true }),             // already joined, recently active
      channel("missed-thread", { thread: true, joined: false }),   // created while offline
      channel("old-thread", { thread: true, joined: false, lastPost: 24 * 30 }),
      channel("staff-thread", { thread: true, joined: false, parentId: "staffCategory" }),
      channel("secret", { readable: false }),
      channel("voice", { text: false }),
      channel("quiet", { lastPost: 24 * 30 }),          // nothing in the last month: its last 10
      channel("empty", { lastPost: null }),             // never had a message
    ]),
    guild("notLogged", [channel("other-general")]),     // message log off: nothing fetched
  ];
  const result = await refillMessageCache(servers, { active: 100, quiet: 10, now: NOW });
  const limits = Object.fromEntries(fetched);
  assert.deepEqual(limits, { "general": 100, "memes": 100, "a-thread": 100, "missed-thread": 100, "old-thread": 10, "quiet": 10 });
  // Joining threads is modules/threadJoin.js's job, done before the refill.
  assert.deepEqual(joins, []);
  // 6 channels x (3 fetched + 1 replied-to message), counted by what actually got cached.
  assert.deepEqual(result, { channels: 6, messages: 24 });
});

// Keeps discord.js's message cache from crowding the server.
//
// The message log can only show the original text of an edited or deleted message if
// it's still cached (Discord never sends the old text), so the cache is allowed to grow:
// 200 messages per channel normally, as the bot ran for a year before 1.0, and up to
// 1,000 in a channel during a burst. It's only cut back when it matters, checked every
// few minutes, with limits that scale with whatever server the bot runs on:
//   - the server is running low (under hostReservePercent of its RAM available, e.g.
//     because another bot on the server is busy): a quarter of the cache is dropped,
//     again each check while it stays low. Other bots don't trim themselves for us, so
//     ms robot is the one to give;
//   - JavaScript memory nears Node's own limit, which on a small server can come before
//     the server itself runs low: a quarter is dropped, so Node never runs out.
// The per-channel caps (200, bursts to 1,000) bound it the rest of the time.
// Burst extras (anything past a channel's newest 200) go first, oldest first across all
// channels. Only then does it eat into channels' usual 200, and every channel keeps its
// newest few regardless, so one very busy channel can't push quiet channels' recent
// messages out. Settings are messageCache in config.js.

import config from "../config.js";
import { formatBytes, heapUsage, hostMemory } from "./hostMemory.js";

// Rough memory for one cached message. Measured with discord.js 14 at about 2 KB for a
// short plain message; the text, embeds and attachments are what make others bigger.
// An estimate for choosing what to drop and for /stats, not an exact figure.
export function estimateBytes(message) {
  return 1800
    + 2 * (message.content?.length ?? 0)
    + 1500 * (message.embeds?.length ?? 0)
    + 500 * (message.attachments?.size ?? 0);
}

const cachesOf = (channels) => [...channels].map(c => c.messages?.cache).filter(cache => cache?.size);

export function cacheSize(channels) {
  let messages = 0, bytes = 0;
  for (const cache of cachesOf(channels)) {
    for (const message of cache.values()) { messages++; bytes += estimateBytes(message); }
  }
  return { messages, bytes };
}

// Drops the oldest messages until the estimate is down to `goalBytes`: first burst
// extras (past each channel's newest `basePerChannel`), then the rest down to each
// channel's newest `keepPerChannel`. Returns how many went and what's left.
function dropOldest(caches, bytes, goalBytes, { basePerChannel, keepPerChannel }) {
  const extras = [], rest = [];
  for (const cache of caches) {
    const newestFirst = [...cache.values()].sort((a, b) => b.createdTimestamp - a.createdTimestamp);
    newestFirst.forEach((message, i) => {
      if (i >= basePerChannel) extras.push({ message, cache });
      else if (i >= keepPerChannel) rest.push({ message, cache });
    });
  }
  const oldestFirst = (a, b) => a.message.createdTimestamp - b.message.createdTimestamp;
  let removed = 0;
  for (const { message, cache } of [...extras.sort(oldestFirst), ...rest.sort(oldestFirst)]) {
    if (bytes <= goalBytes) break;
    cache.delete(message.id);
    bytes -= estimateBytes(message);
    removed++;
  }
  return { removed, bytes };
}

const MB = 1024 * 1024;

// Trims once JavaScript memory passes this much of Node's own limit, leaving room below
// the point where Node slows down and then crashes.
const HEAP_LIMIT_SHARE = 0.75;

// One check. Returns { reason, removed, bytes }; reason is null when nothing was needed.
export function checkMessageCache(channels, {
  reservePercent = config.messageCache.hostReservePercent,
  basePerChannel = config.messageCache.basePerChannel,
  keepPerChannel = config.messageCache.keepPerChannel,
  host = hostMemory(),
  heap = heapUsage(),
} = {}) {
  const floors = { basePerChannel, keepPerChannel };
  const caches = cachesOf(channels);
  const { bytes } = cacheSize(caches.map(cache => ({ messages: { cache } })));
  const quarter = () => dropOldest(caches, bytes, bytes * 0.75, floors);

  // A quarter at a time, so one low reading doesn't empty the whole cache.
  if (host.available < host.total * reservePercent / 100) {
    const pct = Math.round(host.available / host.total * 100);
    return { reason: `the server has only ${formatBytes(host.available)} (${pct}%) available, under its ${reservePercent}% reserve`, ...quarter() };
  }
  if (heap.used > heap.limit * HEAP_LIMIT_SHARE) {
    return { reason: `JavaScript memory is at ${formatBytes(heap.used)}, past ${HEAP_LIMIT_SHARE * 100}% of Node's ${formatBytes(heap.limit)} limit`, ...quarter() };
  }
  return { reason: null, removed: 0, bytes };
}

// Checked every few minutes rather than on every message: adding up tens of thousands
// of messages takes milliseconds, and memory doesn't run out in a few minutes.
export function startCacheTrimming(client, log, every = 5 * 60 * 1000) {
  const timer = setInterval(() => {
    const { reason, removed, bytes } = checkMessageCache(client.channels.cache.values());
    if (removed) log(`Message cache trimmed because ${reason}: dropped the ${removed.toLocaleString()} oldest messages (now about ${Math.round(bytes / MB)} MB).`);
  }, every);
  timer.unref?.();
  return timer;
}

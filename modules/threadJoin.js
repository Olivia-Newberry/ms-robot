// Keeps the bot in every active thread it can see, so the message log has the messages
// there in its cache: an edit or delete in a thread the bot never joined can only be
// logged as "original text isn't available".
//
// Threads come and go in several ways, so joining happens at each of them:
//   - created (events/threadCreate.js)
//   - unarchived, which a thread archived while the bot was away needs
//     (events/threadUpdate.js)
//   - the bot given access to a channel with threads already in it
//     (events/threadListSync.js)
//   - startup, for threads created while the bot was offline (modules/guildSetup.js)
//   - a sweep every 10 minutes, for anything the above missed (e.g. a dropped event).
//     It only makes requests for threads the bot isn't in, so usually none.

import { PermissionFlagsBits } from "discord.js";
import { warn } from "./Logger.js";

const SWEEP_EVERY = 10 * 60 * 1000;

// True if it joined. Never throws: a thread deleted or locked a moment ago isn't an error.
export async function joinThread(thread) {
  if (!thread?.isThread?.() || thread.joined || thread.archived || !thread.joinable) return false;
  if (!thread.permissionsFor?.(thread.guild.members.me)?.has(PermissionFlagsBits.ViewChannel)) return false;
  try {
    await thread.join();
    return true;
  } catch {
    return false;
  }
}

// One at a time, so a server with many threads doesn't send a burst; discord.js waits
// out rate limits itself.
export async function joinThreads(threads) {
  let joined = 0;
  for (const thread of threads) if (await joinThread(thread)) joined++;
  return joined;
}

export const activeThreads = (guild) => [...guild.channels.cache.values()].filter(c => c.isThread?.() && !c.archived);

export function startThreadSweep(client, every = SWEEP_EVERY) {
  const timer = setInterval(async () => {
    for (const guild of client.guilds.cache.values()) {
      if (!guild.available) continue;
      const joined = await joinThreads(activeThreads(guild));
      if (joined) warn(`Joined ${joined} thread${joined === 1 ? "" : "s"} in ${guild.name} that the bot had missed.`);
    }
  }, every);
  timer.unref?.();
  return timer;
}

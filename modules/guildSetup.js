// What happens when a server becomes usable, and when the bot leaves one.
//
// During a Discord outage, servers go "unavailable": discord.js keeps them, fires
// guildUnavailable, and later guildAvailable when they're back. It never fires
// guildDelete for an outage, so nothing here runs for one. But a server that was
// unavailable when the bot started missed the startup work below, so it runs again when
// the server comes back (events/guildAvailable.js), as well as on startup and on joining.

import config from "../config.js";
import { getSettings } from "./functions.js";
import { schedule, cancel, findJobs, registerJobType } from "./jobs.js";
import { error, log } from "./Logger.js";
import { cacheMembers } from "./memberCounts.js";
import { cacheSize } from "./messageCache.js";
import { refillMessageCache } from "./messageLog.js";
import { deletePanel, panelsIn } from "./rolePanels.js";
import { settings } from "./settings.js";
import { activeThreads, joinThreads } from "./threadJoin.js";
import { migrateRoleSettings } from "./settingsUi.js";
import { importVerificationSettings } from "./verification.js";

// Pins role settings to role IDs, then loads the member list (for /stats bot counts)
// and recent messages (for the message log), in the background, one server at a time so
// a startup with several servers doesn't send a burst of requests.
//
// Messages come in two passes: every server's active channels first, then quiet
// channels' last few messages once all of those are done. With hundreds of quiet
// channels that second pass takes minutes, and edits in busy channels during that time
// would otherwise be missed.
let queue = Promise.resolve();
// When each server was last prepared, so the same work isn't queued twice in a row.
const prepared = new Map();
const AGAIN_AFTER = 2 * 60 * 1000;
// Servers whose quiet channels are still to be fetched, and when the current round of
// loading started (for the "finished" line).
const quietPending = new Map();
let quietScheduled = false;
let roundStarted = null;

// Nothing is fetched for servers without the message log, so nothing is announced either.
const logsMessages = (guild) => !["", "false", undefined].includes(getSettings(guild).messageLogChannel);
const activeWindow = () => {
  const hours = config.messageCache.refillWithinHours;
  return hours % 24 === 0 ? `${hours / 24} day${hours === 24 ? "" : "s"}` : `${hours} hours`;
};

export function prepareGuild(client, guild) {
  if (!guild.available) return queue;
  if (Date.now() - (prepared.get(guild.id) ?? 0) < AGAIN_AFTER) return queue;
  prepared.set(guild.id, Date.now());
  roundStarted ??= Date.now();
  for (const change of migrateRoleSettings(guild)) log(`Role setting in ${guild.name}: ${change}`);
  const imported = importVerificationSettings(guild);
  if (imported.length) log(`Verification in ${guild.name}: copied from .env into /settings: ${imported.join("; ")}. The VERIFICATION_* lines in .env can now be removed.`);
  queue = queue
    .then(() => cacheMembers([guild]))
    // Before the messages, so threads are joined before their messages are fetched.
    .then(() => joinThreads(activeThreads(guild)))
    .then(joined => { if (joined) log(`Joined ${joined} thread${joined === 1 ? "" : "s"} in ${guild.name} created while the bot was away.`); })
    .then(() => {
      if (logsMessages(guild)) log(`Message log in ${guild.name}: filling the message cache from channels active in the last ${activeWindow()}…`);
      return refillMessageCache([guild], { quiet: 0 });
    })
    .then(({ channels, messages }) => {
      if (channels) log(`Message log in ${guild.name}: cached ${messages} recent messages from ${channels} active channels and threads.`);
    })
    .catch(e => error(`Couldn't prepare ${guild.name}: ${e.message}`));
  quietPending.set(guild.id, guild);
  scheduleQuietPass(client);
  return queue;
}

// Queued on the next tick, so that when startup prepares several servers in one go, all
// of their first passes are already queued ahead of it.
function scheduleQuietPass(client) {
  if (quietScheduled) return;
  quietScheduled = true;
  setTimeout(() => {
    quietScheduled = false;
    queue = queue.then(async () => {
      const guilds = [...quietPending.values()];
      quietPending.clear();
      try {
        if (guilds.some(logsMessages)) log(`Message log: filling the message cache from channels inactive for ${activeWindow()} or more (their last ${config.messageCache.keepPerChannel} messages each)…`);
        const { channels, messages } = await refillMessageCache(guilds, { active: 0 });
        if (channels) log(`Message log: cached ${messages} recent messages from ${channels} quieter channels and threads.`);
      } catch (e) {
        error(`Couldn't refill quiet channels: ${e.message}`);
      }
      // The last thing queued, so this means everything is loaded: member lists and both
      // message passes, for every server in this round. Logged even if something above
      // failed, so it's a dependable "fully loaded" marker. The total is the cache's real
      // size, the same figure /stats shows.
      const seconds = Math.round((Date.now() - roundStarted) / 1000);
      roundStarted = null;
      const cached = client?.channels?.cache ? cacheSize(client.channels.cache.values()).messages : null;
      log(`Finished loading ${guilds.length} server${guilds.length === 1 ? "" : "s"} in ${seconds}s: member lists loaded${cached === null ? "" : `, ${cached.toLocaleString()} message${cached === 1 ? "" : "s"} cached`}.`, "ready");
    });
  }, 0);
}

// Resolves once everything queued so far, including the quiet pass, is done. For tests.
export async function settled() {
  await new Promise(r => setTimeout(r, 0));
  return queue;
}

// ---- Leaving a server ------------------------------------------------------------------
//
// When the bot is really removed (kicked, or the server deleted), its settings and role
// panels are kept for 30 days rather than deleted on the spot, so a mistaken kick doesn't
// lose a server's setup. Re-adding the bot within that time cancels the cleanup.

const KEEP_FOR = 30 * 24 * 60 * 60 * 1000;

registerJobType("forgetGuild", {
  async run(client, jobs) {
    for (const { data: { guildId } } of jobs) {
      // Back in the server since: keep everything.
      if (client.guilds.cache.has(guildId)) continue;
      settings.delete(guildId);
      for (const panel of panelsIn(guildId)) deletePanel(panel.id);
      log(`Forgot server ${guildId}: settings and role panels deleted 30 days after the bot left.`);
    }
  },
});

export function guildLeft(guild) {
  schedule("forgetGuild", { guildId: guild.id }, { runAt: Date.now() + KEEP_FOR, lane: guild.id });
}

export function guildRejoined(guild) {
  for (const job of findJobs(j => j.type === "forgetGuild" && j.data.guildId === guild.id)) cancel(job.id);
}

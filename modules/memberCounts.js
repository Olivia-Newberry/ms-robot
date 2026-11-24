// People vs bots across every server, for /stats.
//
// Discord's member count includes bots and doesn't say how many, so bots have to be
// counted from the member list. Downloading that list on every /stats would be slow in
// a 12k member server and Discord rate limits it, so each server's list is fetched once
// (at startup, or when the bot joins) and discord.js keeps it current from join and
// leave events (the Server Members intent).

import { error } from "./Logger.js";

// Discord allows one full member-list request per server about every 30 seconds. If
// one is refused for that, it's tried once more after the wait Discord asks for.
export async function cacheMembers(guilds, { sleep = (ms) => new Promise(r => setTimeout(r, ms)) } = {}) {
  for (const guild of guilds) {
    try {
      await guild.members.fetch();
    } catch (e) {
      const retryAfter = e.name === "GatewayRateLimitError" ? e.data?.retry_after : null;
      if (!retryAfter) { error(`Couldn't load the member list for ${guild.name}: ${e.message}`); continue; }
      await sleep(retryAfter * 1000 + 500);
      await guild.members.fetch().catch(err => error(`Couldn't load the member list for ${guild.name}: ${err.message}`));
    }
  }
}

// complete is false while any server's list is still loading (or failed to load),
// since counting bots from part of a list would undercount them.
export function countMembers(guilds) {
  let total = 0, bots = 0, complete = true;
  for (const guild of guilds) {
    total += guild.memberCount;
    bots += guild.members.cache.filter(m => m.user.bot).size;
    if (guild.members.cache.size < guild.memberCount) complete = false;
  }
  return { people: total - bots, bots, total, complete };
}

export function describeMembers({ people, bots, total, complete }) {
  if (!complete) return [`• Members    :: ${total.toLocaleString()}`];
  return [
    `• Members    :: ${total.toLocaleString()}`,
     `• People     :: ${people.toLocaleString()}`,
     `• Bots       :: ${bots.toLocaleString()}`
  ];
}

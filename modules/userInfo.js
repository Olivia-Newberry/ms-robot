// Shared by /userinfo, /threaduser and the !user message command, so all three show
// the same information.
//
// `ctx` is { guild, settings, requester } rather than an interaction or message, so the
// same code serves both kinds of command.

import { EmbedBuilder, PermissionFlagsBits } from "discord.js";
import config from "../config.js";
import { permlevel } from "./functions.js";
import { randomColor } from "./fun.js";

const when = (ms) => `<t:${Math.floor(ms / 1000)}:D> at <t:${Math.floor(ms / 1000)}:t> <t:${Math.floor(ms / 1000)}:R>`;

// Snowflake IDs are 17 to 20 digits; accounts made since 2022 have 19, which the old
// 18-digit pattern missed.
const USER_ID = /\d{17,20}/;
// A bot that posts first in some mod threads (MOD_THREAD_SKIP_IDS in .env): the ID in
// its message isn't the member's, so the next message is used instead.
const skipIds = () => config.modThreadSkipIds;

// permlevel() reads its checks off a message, so the target member is dressed up as
// one. Without this the embed could only show the level of whoever ran the command.
function levelName(ctx, member, user) {
  const level = permlevel({ guild: ctx.guild, member, author: user, settings: ctx.settings });
  return `${level} - ${config.permLevels.find(l => l.level === level)?.name ?? "Unknown"}`;
}

// Discord's guild message search reports how many messages match, so asking for one
// result by this author gives their total without downloading any history.
// Returns { count }, { indexing: true } while Discord is still building the server's
// search index, or null when the count can't be had (no Read Message History, no
// Message Content intent, or the endpoint refusing bots). The caller leaves the field
// out for null rather than showing a misleading 0.
export async function messageCount(client, guild, userId) {
  try {
    const result = await client.rest.get(`/guilds/${guild.id}/messages/search`, {
      query: new URLSearchParams({ author_id: userId, limit: "1", include_nsfw: "true" }),
    });
    if (typeof result?.total_results === "number") return { count: result.total_results };
    // Discord answers 202 with code 110000 until the index exists.
    if (result?.code === 110000) return { indexing: true };
    return null;
  } catch {
    return null;
  }
}

// Someone who isn't a member is only shown what any bot can see about any user (their
// public profile) plus this server's own records about them: whether they're banned
// here, and how many messages they sent here. Other servers the bot is in are never
// searched or mentioned: Discord's Developer Policy restricts using one server's data to
// track people across servers, and those communities didn't agree to share it.
export function userInfoEmbed(ctx, user, member, messages = null, { ban = null, fromBans = false } = {}) {
  const embed = new EmbedBuilder()
    .setColor(randomColor())
    .setThumbnail(user.displayAvatarURL())
    .addFields(
      { name: user.tag, value: `${user}`, inline: true },
      // Its own field so it can be copied on mobile with a long press.
      { name: "User ID:", value: `\`${user.id}\``, inline: true },
      { name: "Permissions:", value: levelName(ctx, member, user), inline: true },
    )
    .setFooter({ text: `Replying to ${ctx.requester.tag}` });

  if (member) {
    // @everyone is on every member, so listing it adds nothing.
    const roles = member.roles.cache.filter(role => role.id !== ctx.guild.id).map(role => `${role}`);
    embed.addFields(
      { name: "Nickname:", value: member.nickname ?? "None", inline: true },
      { name: "In Server", value: ctx.guild.name, inline: true },
    );
    if (messages?.count !== undefined) embed.addFields({ name: "Messages sent:", value: messages.count.toLocaleString(), inline: true });
    if (messages?.indexing) embed.addFields({ name: "Messages sent:", value: "Discord is still indexing this server, try again later", inline: true });
    embed.addFields(
      { name: "Joined The Server On:", value: when(member.joinedTimestamp), inline: false },
      { name: "Account Created On:", value: when(user.createdTimestamp), inline: false },
    );
    // Field values stop at 1024 characters, which a long role list can pass. Cutting
    // between roles keeps every listed mention intact.
    let list = "";
    for (const role of roles) {
      const next = list ? `${list}, ${role}` : role;
      if (next.length > 1024) break;
      list = next;
    }
    if (list) embed.addFields({ name: "Roles:", value: list, inline: false });
  } else {
    embed.setDescription(`⚠️ **Not a member of this server.**${fromBans ? " Found in this server's ban list." : ""}`);
    embed.addFields({ name: "In Server", value: "No", inline: true });
    // Only when the bot can see the ban list (Ban Members); otherwise it's left out.
    if (ban) embed.addFields({ name: "Banned here:", value: ban.banned ? `Yes${ban.reason ? `: ${ban.reason}` : " (no reason given)"}`.slice(0, 1024) : "No", inline: true });
    // Messages from people who have left still count, so it's still worth showing.
    if (messages?.count !== undefined) embed.addFields({ name: "Messages sent:", value: messages.count.toLocaleString(), inline: true });
    embed.addFields({ name: "Account Created On:", value: when(user.createdTimestamp), inline: false });
  }
  return embed;
}

// Everything the command needs to answer: the user, whether they're a member, and
// their message count. Fetched together so the slower count lookup runs alongside.
export async function lookUp(client, guild, user) {
  const [member, messages] = await Promise.all([
    guild.members.fetch(user.id).catch(() => null),
    messageCount(client, guild, user.id),
  ]);
  const ban = member ? null : await banStatus(guild, user.id);
  return { member, messages, ban };
}

const canSeeBans = (guild) => Boolean(guild.members.me?.permissions?.has(PermissionFlagsBits.BanMembers));

// { banned, reason } for this server, or null if the bot can't see its bans.
export async function banStatus(guild, userId) {
  if (!canSeeBans(guild)) return null;
  try {
    const ban = await guild.bans.fetch({ user: userId, force: true });
    return { banned: true, reason: ban.reason };
  } catch (e) {
    // 10026 is Discord's "Unknown Ban": not banned. Anything else, say nothing.
    return e.code === 10026 ? { banned: false } : null;
  }
}

// This server's ban list, for finding someone who's left by name. A few pages at most:
// enough for any real server, without a burst of requests on one lookup.
async function searchBans(guild, query) {
  if (!canSeeBans(guild)) return [];
  const wanted = query.toLowerCase();
  const names = (user) => [user.username, user.globalName, user.tag].filter(Boolean).map(n => n.toLowerCase());
  const exact = [], partial = [];
  let after;
  for (let page = 0; page < 5; page++) {
    const bans = await guild.bans.fetch({ limit: 1000, after, cache: false }).catch(() => null);
    if (!bans?.size) break;
    for (const ban of bans.values()) {
      const candidate = names(ban.user);
      if (candidate.includes(wanted)) exact.push(ban.user);
      else if (candidate.some(n => n.includes(wanted))) partial.push(ban.user);
    }
    if (bans.size < 1000) break;
    after = bans.lastKey();
  }
  return exact.length ? exact : partial;
}

// Mod threads are channels under a category named for threads or tickets (e.g. "Mod
// Tickets"), opened by another bot whose first message contains the member's ID.
// Real Discord threads sit one level deeper, so the category is the parent's parent.
const MOD_THREAD_CATEGORY = /thread|ticket/i;

export function isModThread(channel) {
  const category = (channel?.parent?.parent ?? channel?.parent)?.name ?? "";
  return MOD_THREAD_CATEGORY.test(category);
}

export async function threadUserId(channel) {
  // after: "0" fetches the oldest messages rather than the newest 50, so long threads
  // work too. The ID comes from another bot's message, which needs Message Content.
  const oldest = [...(await channel.messages.fetch({ after: "0", limit: 5 })).values()]
    .sort((a, b) => (BigInt(a.id) < BigInt(b.id) ? -1 : 1));
  let userId = oldest[0]?.content.match(USER_ID)?.[0];
  if (skipIds().includes(userId)) userId = oldest[1]?.content.match(USER_ID)?.[0];
  return userId ?? null;
}

// The lookups !user has always accepted: a mention, an ID, an old-style name#1234 tag,
// or a username/nickname search. Members of this server always come first; a name that
// matches no member is looked for in this server's ban list. Returns { user, fromBans }
// or { matches } when several banned users fit, so the caller can ask which.
export async function findUser(client, guild, query, mentioned) {
  if (mentioned) return { user: mentioned };
  const id = query.match(/^<@!?(\d{17,20})>$|^(\d{17,20})$/)?.slice(1).find(Boolean);
  if (id) return { user: await client.users.fetch(id).catch(() => null) };
  const byTag = guild.members.cache.find(m => m.user.tag.toLowerCase() === query.toLowerCase());
  if (byTag) return { user: byTag.user };
  const found = await guild.members.fetch({ query, limit: 1 }).catch(() => null);
  if (found?.first()) return { user: found.first().user };
  const banned = await searchBans(guild, query);
  if (banned.length === 1) return { user: banned[0], fromBans: true };
  if (banned.length > 1) return { matches: banned.slice(0, 10) };
  return { user: null };
}

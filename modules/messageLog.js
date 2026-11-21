// Message edit/delete logging for moderators.
//
// Design choices:
//   - The user's ID goes in the message text, not the embed, because Discord search
//     only looks at message text, so mods can find every entry for a user by ID.
//   - The whole message is shown, not just the changed words, because a change often
//     can't be judged without the sentence around it.
//   - "View context" (components/msglog.js) fetches the surrounding conversation when
//     clicked instead of saving it, so the bot keeps no message text of its own. That
//     matters for the Message Content intent review. Entries waiting to be posted are
//     the exception: they sit in the job queue's database so a restart doesn't lose them.
//
// Discord limits this works within:
//   - embed description 4096 characters. A message can be 4000 characters before diff
//     markup is added, so when the marked-up message doesn't fit, unchanged text far
//     from the edits is shortened and the full before/after is attached as a .diff.
//   - about 5 messages per 5 seconds per channel. Entries go through the job queue
//     (modules/jobs.js) with one lane per log channel. Normally each is its own message.
//     When a burst backs up behind the rate limit, the waiting entries are packed up to
//     5 per message (5 rows of buttons is Discord's maximum), numbered so each entry's
//     buttons are easy to match to its embed. Nothing is dropped, and entries still
//     queued survive a restart.

import { ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, PermissionFlagsBits } from "discord.js";
import { warn } from "./Logger.js";
import { componentId } from "./components.js";
import { getSettings } from "./functions.js";
import { registerJobType, schedule } from "./jobs.js";
import { idList } from "./roleTools.js";
import { escapeToken, lineDiff, renderDiff, tokenize } from "./textDiff.js";

export const PREFIX = "msglog";
const COLORS = { edit: 0xf0b232, delete: 0xda373c, bulk: 0x8f1d21 };
// Below Discord's 4096 so the notes added after the text ("Long message: ...") still fit.
const DESCRIPTION_BUDGET = 3800;
export const escape = (text) => tokenize(text ?? "").map(escapeToken).join("");
export const jumpLink = (guildId, channelId, messageId) => `https://discord.com/channels/${guildId}/${channelId}${messageId ? `/${messageId}` : ""}`;
const ts = (ms, style = "R") => `<t:${Math.floor(ms / 1000)}:${style}>`;

function target(message) {
  if (!message.guild) return null;
  const settings = getSettings(message.guild);
  const channelId = settings.messageLogChannel;
  if (!channelId || channelId === "false") return null;
  // Mods talking in the log channel would otherwise get logged in the middle of it.
  if (message.channelId === channelId) return null;

  // Mods usually ignore a whole staff category. Threads sit a level below their
  // channel, so the category is the parent's parent.
  const channel = message.channel;
  const parent = channel?.isThread?.() ? channel.parent : channel;
  const ignored = idList(settings.messageLogIgnore);
  if ([message.channelId, channel?.parentId, parent?.parentId].some(id => id && ignored.includes(id))) return null;

  const logChannel = message.guild.channels.cache.get(channelId);
  if (!logChannel?.isTextBased()) return null;
  // Checked here so a server that took the bot's access away doesn't fill the queue
  // with sends that can only fail and be retried.
  const perms = logChannel.permissionsFor(message.guild.members.me);
  const needed = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.AttachFiles];
  if (!perms?.has(needed)) {
    warn(`Missing permissions to post message logs in #${logChannel.name} (${message.guild.name}).`);
    return null;
  }
  return logChannel;
}

// Bot and webhook messages are skipped: embeds unfurling and other bots' own edits
// would bury the human activity mods actually want to see.
const skipAuthor = (message) => message.author?.bot || message.webhookId;

// The mention opens the user's profile; the raw ID is there to copy and search for,
// and still identifies them after they leave the server and the mention stops working.
function headline(action, message) {
  const who = message.author ? `<@${message.author.id}> · \`${message.author.id}\`` : "an unknown user (message wasn't cached)";
  return `**${action}** by ${who} · in <#${message.channelId}>`;
}

function baseEmbed(color, title, message, footer = "") {
  const embed = new EmbedBuilder().setColor(color).setTitle(title).setFooter({ text: `Message ID ${message.id}${footer}` });
  if (message.author) embed.setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL({ size: 64 }) });
  return embed;
}

function buttons(contextId, link, linkLabel) {
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(contextId).setLabel("View context").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setURL(link).setLabel(linkLabel).setStyle(ButtonStyle.Link),
  )];
}

function attachmentList(attachments) {
  return attachments.map(a => `\`${a.name}\` (${Math.ceil(a.size / 1024)} KB)`).join("\n").slice(0, 1024);
}

const NOT_CACHED = "*The original text isn't available: the message was sent before the bot last started, or is too old to still be cached.*";

export function logEdit(oldMessage, newMessage) {
  if (skipAuthor(newMessage)) return;
  const before = oldMessage.content ?? "", after = newMessage.content ?? "";
  const removed = oldMessage.partial ? [] : [...oldMessage.attachments.values()].filter(a => !newMessage.attachments.has(a.id));
  // Pins, embed unfurls and thread changes all arrive as edits with the same text.
  if (!oldMessage.partial && before === after && !removed.length) return;

  const channel = target(newMessage);
  if (!channel) return;

  const embed = baseEmbed(COLORS.edit, "Message edited", newMessage, " · struck through = removed, underlined = added, [+ ] / [− ] = emoji")
    .setTimestamp(newMessage.editedTimestamp ?? Date.now());
  const files = [];
  if (oldMessage.partial) {
    const shown = escape(after);
    // Cutting can leave a trailing backslash from escaping, which would escape the
    // markdown after it, hence the replace().
    embed.setDescription(`${NOT_CACHED} It now reads:\n\n${shown.slice(0, DESCRIPTION_BUDGET).replace(/\\$/, "") || "*(no text)*"}`);
    if (shown.length > DESCRIPTION_BUDGET) files.push(new AttachmentBuilder(Buffer.from(after), { name: `message-${newMessage.id}.txt` }));
  } else {
    const { text, complete, changed } = renderDiff(before, after, DESCRIPTION_BUDGET);
    let description = text || "*(no text)*";
    // Unchanged text gets here when only attachments were removed.
    if (!changed) description = `*Text unchanged.*\n${description}`;
    else if (before.replace(/\s+/g, " ").trim() === after.replace(/\s+/g, " ").trim()) description = `*Only spacing or line breaks changed.*\n${description}`;
    if (!complete) {
      description += "\n\n*Long message: unchanged text far from the edits is shortened above. The full before and after is attached.*";
      files.push(new AttachmentBuilder(Buffer.from(`--- before\n+++ after\n${lineDiff(before, after)}`), { name: `edit-${newMessage.id}.diff` }));
    }
    embed.setDescription(description.slice(0, 4096));
  }
  embed.addFields({ name: "Sent", value: ts(newMessage.createdTimestamp), inline: true });
  if (removed.length) embed.addFields({ name: "Attachments removed", value: attachmentList(removed) });

  enqueue(channel, {
    content: headline("Edited", newMessage),
    embeds: [embed],
    files,
    components: buttons(componentId(PREFIX, "ctx", newMessage.channelId, newMessage.id), jumpLink(newMessage.guildId, newMessage.channelId, newMessage.id), "Jump to message"),
  });
}

export function logDelete(message) {
  if (skipAuthor(message)) return;
  const channel = target(message);
  if (!channel) return;

  const embed = baseEmbed(COLORS.delete, "Message deleted", message).setTimestamp(Date.now());
  const files = [];
  const shown = escape(message.content);
  if (message.partial) embed.setDescription(NOT_CACHED);
  else if (!shown) embed.setDescription("*No text, see below.*");
  else if (shown.length <= DESCRIPTION_BUDGET) embed.setDescription(shown);
  else {
    // Attached so the full deleted text survives even when the embed can't hold it.
    embed.setDescription(`${shown.slice(0, DESCRIPTION_BUDGET).replace(/\\$/, "")}…\n\n*Long message, the full text is attached.*`);
    files.push(new AttachmentBuilder(Buffer.from(message.content), { name: `deleted-${message.id}.txt` }));
  }

  if (message.createdTimestamp) embed.addFields({ name: "Sent", value: ts(message.createdTimestamp), inline: true });
  if (message.reference?.messageId) {
    const link = jumpLink(message.reference.guildId ?? message.guildId, message.reference.channelId, message.reference.messageId);
    embed.addFields({ name: "Was replying to", value: `[this message](${link})`, inline: true });
  }
  // Attachment URLs stop working once the message is gone, so names and sizes only.
  if (message.attachments?.size) embed.addFields({ name: "Attachments", value: attachmentList([...message.attachments.values()]) });
  if (message.stickers?.size) embed.addFields({ name: "Stickers", value: message.stickers.map(s => s.name).join(", ").slice(0, 1024) });

  // Discord opens a link to a deleted message at the spot it used to be, which is
  // still the quickest way for a mod to see what it was in reply to.
  enqueue(channel, {
    content: headline("Deleted", message),
    embeds: [embed],
    files,
    components: buttons(componentId(PREFIX, "ctx", message.channelId, message.id), jumpLink(message.guildId, message.channelId, message.id), "Jump to where it was"),
  });
}

export function logBulkDelete(messages) {
  const first = messages.first();
  if (!first) return;
  const channel = target(first);
  if (!channel) return;

  // A purge can be 100 messages, far more than embeds hold, so the messages go in a
  // transcript file. Oldest first so it reads top to bottom.
  const sorted = [...messages.values()].sort((a, b) => (a.createdTimestamp ?? 0) - (b.createdTimestamp ?? 0));
  const cached = sorted.filter(m => !m.partial);
  const authors = new Map();
  for (const m of cached) authors.set(m.author.id, (authors.get(m.author.id) ?? 0) + 1);

  const lines = cached.map(m => {
    const time = new Date(m.createdTimestamp).toISOString().replace("T", " ").slice(0, 19);
    const extra = m.attachments.size ? ` [attachments: ${m.attachments.map(a => a.name).join(", ")}]` : "";
    return `[${time} UTC] ${m.author.tag} (${m.author.id}): ${m.content}${extra}`;
  });
  const uncached = sorted.length - cached.length;
  if (uncached) lines.push(`\n${uncached} older message(s) were not cached, so their content is unknown.`);

  // 15 keeps the list inside a field's 1024 characters.
  const authorSummary = [...authors].sort((a, b) => b[1] - a[1]).slice(0, 15)
    .map(([id, count]) => `<@${id}> · \`${id}\` × ${count}`).join("\n");

  const embed = new EmbedBuilder()
    .setColor(COLORS.bulk)
    .setTitle(`${messages.size} messages deleted at once`)
    .setDescription("The deleted messages are in the attached transcript.")
    .setTimestamp(Date.now());
  if (authorSummary) embed.addFields({ name: "Authors", value: authorSummary.slice(0, 1024) });
  if (uncached) embed.addFields({ name: "Not cached", value: `${uncached} message(s) were too old for their content to be known.` });

  enqueue(channel, {
    content: `**Bulk delete** in <#${first.channelId}>`,
    embeds: [embed],
    files: [new AttachmentBuilder(Buffer.from(lines.join("\n")), { name: `bulk-delete-${first.channelId}-${Date.now()}.txt` })],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setURL(jumpLink(first.guildId, first.channelId)).setLabel("Go to channel").setStyle(ButtonStyle.Link),
    )],
  });
}

// ---- Sending -----------------------------------------------------------------------

// Discord's per message limits. Buttons are why entries is 5: each entry needs its own
// row, and a message holds 5. embedChars is below the real 6000 to leave room for the
// "#n · " added to titles when entries share a message.
const LIMITS = { entries: 5, embeds: 10, embedChars: 5900, content: 2000, files: 10 };
// Errors that retrying won't fix: the channel is gone or the bot lost access.
const PERMANENT = new Set([10003, 50001, 50013]);

// Job data has to be plain JSON, so embeds/buttons are stored as API objects and file
// contents as base64.
function enqueue(channel, { content, embeds = [], components = [], files = [] }) {
  schedule(PREFIX, {
    channelId: channel.id,
    content,
    embeds: embeds.map(e => e.toJSON()),
    components: components.map(c => c.toJSON()),
    files: files.map(f => ({ name: f.name, data: Buffer.from(f.attachment).toString("base64") })),
  }, { lane: channel.id });
}

// Only these parts count towards Discord's 6000 character limit; colours and URLs don't.
function embedLength(e) {
  return (e.title?.length ?? 0) + (e.description?.length ?? 0) + (e.footer?.text?.length ?? 0)
    + (e.author?.name?.length ?? 0) + (e.fields ?? []).reduce((n, f) => n + f.name.length + f.value.length, 0);
}

// During a burst every message costs a rate-limit wait, so entries share messages
// wherever the limits allow. The + 8 is room for the "`#n` " numbering.
function pack(jobs) {
  const messages = [];
  let current = null;
  for (const job of jobs) {
    const d = job.data;
    const size = { embeds: d.embeds.length, chars: d.embeds.reduce((n, e) => n + embedLength(e), 0), content: (d.content?.length ?? 0) + 8, files: d.files.length };
    const fits = current
      && current.jobs.length < LIMITS.entries
      && current.embeds + size.embeds <= LIMITS.embeds
      && current.chars + size.chars + 8 <= LIMITS.embedChars
      && current.content + size.content <= LIMITS.content
      && current.files + size.files <= LIMITS.files;
    if (!fits) messages.push(current = { jobs: [], embeds: 0, chars: 0, content: 0, files: 0 });
    current.jobs.push(job);
    current.embeds += size.embeds; current.chars += size.chars; current.content += size.content; current.files += size.files;
  }
  return messages;
}

// One entry is sent exactly as built. Several get a number on their line of text,
// embed title and buttons ("View context #2") so it's clear which belongs to which.
function toPayload(jobs) {
  const numbered = jobs.length > 1;
  const content = [], embeds = [], components = [], files = [];
  jobs.forEach(({ data }, i) => {
    const n = i + 1;
    content.push(numbered ? `\`#${n}\` ${data.content}` : data.content);
    // Saved entries are plain API JSON, which both discord.js 13 and 14 produce, so
    // entries queued before an upgrade still send.
    for (const json of data.embeds) {
      const embed = new EmbedBuilder(json);
      if (numbered && embed.data.title) embed.setTitle(`#${n} · ${embed.data.title}`);
      embeds.push(embed);
    }
    for (const json of data.components) {
      const row = new ActionRowBuilder(json);
      if (numbered) for (const button of row.components) button.setLabel(`${button.data.label} #${n}`);
      components.push(row);
    }
    for (const f of data.files) files.push(new AttachmentBuilder(Buffer.from(f.data, "base64"), { name: f.name }));
  });
  return { content: content.join("\n"), embeds, components, files, allowedMentions: { parse: [] } };
}

registerJobType(PREFIX, {
  // Keeps each pass short, so a large backlog can't hold up a shutdown past its grace
  // period. Anything beyond waits for the next pass.
  maxBatch: LIMITS.entries * 5,
  async run(client, jobs, { complete }) {
    // Entries saved in a shape this version can't send are skipped rather than retried.
    const valid = jobs.filter(j => Array.isArray(j.data.embeds) && Array.isArray(j.data.components) && Array.isArray(j.data.files));
    if (valid.length < jobs.length) {
      warn(`Dropping ${jobs.length - valid.length} malformed message log entr${jobs.length - valid.length === 1 ? "y" : "ies"}.`);
      complete(jobs.filter(j => !valid.includes(j)));
    }
    if (!valid.length) return [];
    jobs = valid;
    const channel = client.channels.cache.get(jobs[0].data.channelId);
    if (!channel?.isTextBased()) return jobs;     // log channel deleted: nothing to retry
    const finished = [];
    for (const message of pack(jobs)) {
      let payload;
      try {
        payload = toPayload(message.jobs);
      } catch (e) {
        // Saved data that can't be rebuilt into a message will never send; skip it.
        warn(`Dropping unreadable message log entr${message.jobs.length === 1 ? "y" : "ies"}: ${e.message}`);
        complete(message.jobs);
        continue;
      }
      try {
        // discord.js waits out rate limits itself, so sending in order keeps order.
        await channel.send(payload);
        complete(message.jobs);              // now, so a crash later in the batch doesn't resend it
        finished.push(...message.jobs);
      } catch (e) {
        warn(`Could not post message log in #${channel.name}: ${e.message}`);
        if (PERMANENT.has(e.code)) { complete(message.jobs); continue; }
        break;                               // keep order: retry this and the rest later
      }
    }
    return finished;
  },
});

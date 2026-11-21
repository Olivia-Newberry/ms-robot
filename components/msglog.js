// "View context" on message log entries (see modules/messageLog.js).
//
//   msglog:ctx:<channelId>:<messageId>   the messages around that point in the channel
//
// The logged message itself is already shown in full in the log entry, so this only
// shows what was said around it. It's fetched when clicked, so it reflects the channel
// as it is now. Replies are ephemeral, so only the moderator who clicked sees them, and
// only if they can read the channel the message was in.

import { EmbedBuilder, MessageFlags, PermissionFlagsBits } from "discord.js";
import { escape, jumpLink, PREFIX } from "../modules/messageLog.js";

export const prefix = PREFIX;
export const conf = { guildOnly: true };

const BUDGET = 3800;
const SURROUNDING = 10;
// One wall of text shouldn't crowd the rest of the conversation out of the embed.
const LINE_LENGTH = 300;

const time = (ms) => `<t:${Math.floor(ms / 1000)}:t>`;
// Snowflake IDs are too big for Number to compare exactly, hence BigInt.
const byId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

async function showContext(interaction, channelId, messageId) {
  const reply = (content) => interaction.reply({ content, flags: MessageFlags.Ephemeral });
  const channel = interaction.guild.channels.cache.get(channelId);
  if (!channel?.isTextBased()) return reply("No surrounding messages available: that channel no longer exists.");
  // Being in the log channel doesn't mean a mod can read every channel it logs.
  if (!channel.permissionsFor(interaction.member)?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory])) {
    return reply("You can't read the channel this message was in.");
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  let around;
  try {
    // "around" takes any ID, so this also works for a message that has been deleted.
    // + 1 because the logged message itself is one of the results if it still exists.
    around = await channel.messages.fetch({ around: messageId, limit: SURROUNDING + 1 });
  } catch (e) {
    return interaction.editReply(`No surrounding messages available: ${e.message}`);
  }

  const target = BigInt(messageId);
  const lines = [...around.values()].map(m => {
    const isTarget = m.id === messageId;
    const content = escape(m.content).slice(0, LINE_LENGTH).replace(/\\$/, "") || "*(no text)*";
    // The logged message's text is already in the log entry; repeating it would only
    // take space from the conversation around it.
    const text = isTarget
      ? `▶ **${escape(m.author.tag)}** ${time(m.createdTimestamp)} *(the logged message, as it reads now)*`
      : `**${escape(m.author.tag)}** ${time(m.createdTimestamp)} ${content}`;
    return { id: BigInt(m.id), text };
  });
  if (!around.has(messageId)) lines.push({ id: target, text: "🗑️ *the deleted message was here*" });
  lines.sort(byId);

  if (lines.length <= 1) return interaction.editReply("No surrounding messages available: nothing else was said around it.");

  // The messages nearest the logged one matter most, so trimming starts at whichever
  // end is furthest from it.
  let text = lines.map(l => l.text).join("\n");
  while (text.length > BUDGET && lines.length > 1) {
    const at = lines.findIndex(l => l.id === target);
    lines.splice(at > lines.length / 2 ? 0 : lines.length - 1, 1);
    text = lines.map(l => l.text).join("\n");
  }

  const embed = new EmbedBuilder().setColor(0x5865f2).setTitle(`Around this message in #${channel.name}`)
    .setURL(jumpLink(interaction.guildId, channelId, messageId))
    .setDescription(text)
    .setFooter({ text: "Fetched just now, so later edits and deletes are reflected." });
  return interaction.editReply({ embeds: [embed], allowedMentions: { parse: [] } });
}

export async function run(client, interaction, [kind, channelId, messageId]) {
  // "del" is what delete entries used before edits got the same button.
  if ((kind === "ctx" || kind === "del") && channelId && messageId) return showContext(interaction, channelId, messageId);
  return interaction.reply({ content: "This button is from an older version of the log and no longer works.", flags: MessageFlags.Ephemeral });
}

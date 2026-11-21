// Role panels: a message members use to give themselves roles, by button or by emoji
// reaction. Set up with /rolepanel; clicks are handled by components/rolepick.js and
// reactions by events/messageReactionAdd.js / messageReactionRemove.js.
//
// A panel is "pick one" (choosing a role takes away the others from that panel, e.g.
// colour roles) or "pick any". Each role can name a prerequisite role the member must
// already have. Losing a prerequisite later doesn't remove anything.
//
// Panels are stored in the "rolePanels" database rather than in the message itself,
// because reactions carry no data of their own and a button ID only holds 100
// characters, while prerequisites and the mode have to be checked on every pick.

import { ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, parseEmoji } from "discord.js";
import { componentId } from "./components.js";
import { isPlainObject, openStore, safeGet } from "./db.js";
import { isUnicodeEmoji } from "./textDiff.js";

export const PICK = "rolepick";
// Discord's limits: 5 rows of 5 buttons, and 20 different reactions per message.
export const MAX_ROLES = { buttons: 25, reactions: 20 };

// Self-service roles must never grant control of the server. These would let anyone
// who can click a button moderate or take over.
const DANGEROUS = [
  "Administrator", "ManageGuild", "ManageRoles", "ManageChannels", "ManageWebhooks", "ManageMessages",
  "ManageNicknames", "ManageEmojisAndStickers", "ManageEvents", "ManageThreads", "KickMembers", "BanMembers",
  "ModerateMembers", "MentionEveryone", "ViewAuditLog",
];

function validatePanel(panel, key) {
  if (!isPlainObject(panel) || typeof panel.guildId !== "string" || !Array.isArray(panel.roles)) return { drop: "not a role panel" };
  const roles = panel.roles.filter(r => isPlainObject(r) && typeof r.roleId === "string");
  const fixed = {
    ...panel, id: key, roles,
    style: panel.style === "reactions" ? "reactions" : "buttons",
    mode: panel.mode === "single" ? "single" : "multiple",
  };
  return JSON.stringify(fixed) === JSON.stringify(panel) ? undefined : { value: fixed };
}

export const panels = openStore("rolePanels", { validate: validatePanel });

export const getPanel = (id) => safeGet(panels, id);
export const savePanel = (panel) => { panels.set(panel.id, panel); return panel; };
export const deletePanel = (id) => panels.delete(id);

export function panelsIn(guildId) {
  const found = [];
  for (const id of panels.keys()) {
    const panel = getPanel(id);
    if (panel?.guildId === guildId) found.push(panel);
  }
  return found;
}

// Reactions only say which message they're on, so panels are looked up by message.
export function panelForMessage(messageId) {
  for (const id of panels.keys()) {
    const panel = getPanel(id);
    if (panel?.messageId === messageId) return panel;
  }
  return null;
}

export function newPanel({ guildId, channelId, title, description, style, mode, createdBy }) {
  // Time plus a random part: unique, short enough for button IDs, and free of ":".
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  return savePanel({ id, guildId, channelId, messageId: null, title, description: description ?? "", style, mode, roles: [], createdBy, createdAt: Date.now() });
}

// Why a role can't be handed out by the bot right now, or null if it can.
export function roleProblem(guild, role) {
  const me = guild.members.me;
  if (role.id === guild.id) return "@everyone can't be handed out";
  if (role.managed) return `${role} is managed by a bot or integration, so it can't be handed out`;
  if (!me.permissions.has(PermissionFlagsBits.ManageRoles)) return "I'm missing the **Manage Roles** permission";
  if (role.comparePositionTo(me.roles.highest) >= 0) return `${role} sits at or above my highest role, so I can't hand it out`;
  const powerful = DANGEROUS.filter(name => role.permissions.has(PermissionFlagsBits[name]));
  if (powerful.length) return `${role} has powerful permissions (${powerful.slice(0, 3).join(", ")}${powerful.length > 3 ? "…" : ""}), so it can't be self-assigned`;
  return null;
}

// Returns { emoji } with the text to store, or { error }. Custom emoji must come from a
// server the bot is in, or Discord won't let it react with or display them.
export function checkEmoji(text, client) {
  const trimmed = text.trim();
  const custom = parseEmoji(trimmed);
  if (custom?.id && /^<a?:\w+:\d+>$/.test(trimmed)) {
    return client.emojis.cache.has(custom.id) ? { emoji: trimmed } : { error: "I can only use custom emoji from servers I'm in" };
  }
  return isUnicodeEmoji(trimmed) ? { emoji: trimmed } : { error: `"${trimmed}" isn't a single emoji` };
}

// The same emoji can arrive with or without the invisible variation selector, so it's
// left out when comparing.
export function emojiKey(emoji) {
  if (!emoji) return null;
  if (typeof emoji === "string") {
    const parsed = parseEmoji(emoji);
    return parsed?.id ?? emoji.replace(/️/g, "");
  }
  return emoji.id ?? emoji.name?.replace(/️/g, "") ?? null;
}

export function render(panel, guild) {
  const lines = panel.roles.map(entry => {
    const role = guild.roles.cache.get(entry.roleId);
    const needs = entry.requires ? ` *(needs <@&${entry.requires}>)*` : "";
    return `${entry.emoji ? `${entry.emoji} ` : ""}${role ?? "*deleted role*"}${entry.label ? ` · ${entry.label}` : ""}${needs}`;
  });
  const how = panel.style === "buttons" ? "Click a button" : "React";
  const embed = {
    title: panel.title,
    description: [panel.description, lines.join("\n") || "*No roles yet.*"].filter(Boolean).join("\n\n").slice(0, 4096),
    color: 0x5865f2,
    footer: { text: panel.mode === "single" ? `${how} to pick one. Picking another swaps it; pick yours again to remove it.` : `${how} to add a role; do it again to remove it.` },
  };

  const components = [];
  if (panel.style === "buttons") {
    for (let i = 0; i < panel.roles.length; i += 5) {
      components.push(new ActionRowBuilder().addComponents(panel.roles.slice(i, i + 5).map(entry => {
        const role = guild.roles.cache.get(entry.roleId);
        const button = new ButtonBuilder()
          .setCustomId(componentId(PICK, panel.id, entry.roleId))
          .setStyle(ButtonStyle.Secondary)
          .setLabel((entry.label || role?.name || "Deleted role").slice(0, 80));
        if (entry.emoji) button.setEmoji(parseEmoji(entry.emoji));
        return button;
      })));
    }
  }
  return { embeds: [embed], components, allowedMentions: { parse: [] } };
}

// Posts the panel, or edits it in place. A deleted panel message is posted again, so
// /rolepanel add or edit doubles as a repost.
export async function publish(client, panel) {
  const channel = client.channels.cache.get(panel.channelId);
  if (!channel?.isTextBased()) throw new Error("the panel's channel no longer exists");
  const guild = channel.guild;
  const payload = render(panel, guild);

  let message = panel.messageId ? await channel.messages.fetch(panel.messageId).catch(() => null) : null;
  if (message) await message.edit(payload);
  else {
    message = await channel.send(payload);
    savePanel({ ...panel, messageId: message.id });
  }

  if (panel.style === "reactions") {
    const wanted = new Set(panel.roles.map(e => emojiKey(e.emoji)));
    // Leftovers from removed roles, or from when this was a button panel.
    for (const reaction of message.reactions.cache.values()) {
      if (!wanted.has(emojiKey(reaction.emoji))) await reaction.remove().catch(() => null);
    }
    for (const entry of panel.roles) {
      if (!message.reactions.cache.find(r => emojiKey(r.emoji) === emojiKey(entry.emoji))?.me) await message.react(entry.emoji);
    }
  } else if (message.reactions.cache.size) {
    // Switched from reactions to buttons.
    await message.reactions.removeAll().catch(() => null);
  }
  return message;
}

// What a pick does, shared by buttons and reactions. Returns
// { result: "added" | "removed" | "refused", text, removed: [roleIds taken away] }.
export async function pick(member, panel, roleId) {
  const guild = member.guild;
  const entry = panel.roles.find(e => e.roleId === roleId);
  const role = guild.roles.cache.get(roleId);
  if (!entry || !role) return { result: "refused", text: "That role isn't on this panel any more.", removed: [] };
  const reason = `Role panel: ${panel.title}`.slice(0, 512);

  if (member.roles.cache.has(roleId)) {
    await member.roles.remove(roleId, reason);
    return { result: "removed", text: `Removed ${role}.`, removed: [roleId] };
  }
  if (entry.requires && !member.roles.cache.has(entry.requires)) {
    const needed = guild.roles.cache.get(entry.requires);
    return { result: "refused", text: needed ? `You need ${needed} before you can pick ${role}.` : `${role} needs a role that no longer exists. Let an admin know.`, removed: [] };
  }
  const problem = roleProblem(guild, role);
  if (problem) return { result: "refused", text: `I can't hand out ${role}: ${problem}. Let an admin know.`, removed: [] };

  const removed = panel.mode === "single" ? panel.roles.map(e => e.roleId).filter(id => id !== roleId && member.roles.cache.has(id)) : [];
  if (removed.length) await member.roles.remove(removed, reason);
  await member.roles.add(roleId, reason);
  const swapped = removed.length ? ` (instead of ${removed.map(id => `<@&${id}>`).join(", ")})` : "";
  return { result: "added", text: `Added ${role}${swapped}.`, removed };
}

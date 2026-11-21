// Shared by /set, /conf and their confirmation buttons (components/settings.js).

import { ActionRowBuilder, ButtonBuilder, ButtonStyle, codeBlock } from "discord.js";
import { componentId } from "./components.js";
import { isPlainObject, safeGet } from "./db.js";
import { getSettings } from "./functions.js";
import { isIdList, resolveRoles } from "./roleMatch.js";
import { sanitizeSettings, settings } from "./settings.js";

export const defaults = () => getSettings();
export const overridesFor = (guildId) => sanitizeSettings(safeGet(settings, guildId, {}));

export function table(title, values) {
  const width = Math.max(20, ...Object.keys(values).map(k => k.length + 1));
  const lines = Object.entries(values).map(([key, value]) => `${key}${" ".repeat(width - key.length)}::  ${value}`);
  return codeBlock("asciidoc", `= ${title} =\n${lines.join("\n")}`);
}

// Typing a key from memory was the main way !set went wrong, so keys are suggested.
export async function suggestKeys(interaction) {
  const typed = interaction.options.getFocused().toLowerCase();
  const keys = Object.keys(defaults()).filter(k => k.toLowerCase().includes(typed)).slice(0, 25);
  await interaction.respond(keys.map(k => ({ name: k, value: k })));
}

// The buttons carry who asked, so nobody else in the channel can confirm for them.
export function confirmButtons(action, userId, key, label) {
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(componentId("settings", action, userId, key)).setLabel(label).setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(componentId("settings", "cancel", userId, key)).setLabel("Cancel").setStyle(ButtonStyle.Secondary),
  )];
}

export function saveOverride(guildId, key, value) {
  const current = overridesFor(guildId);
  if (value === undefined) delete current[key];
  else current[key] = value;
  settings.set(guildId, current);
}

// Removing a default also removes every server's override of it, like !conf del did.
export function deleteDefaultKey(key) {
  const stored = sanitizeSettings(safeGet(settings, "default", {}));
  delete stored[key];
  settings.set("default", stored);
  for (const id of settings.keys()) {
    if (id === "default") continue;
    const conf = safeGet(settings, id, {});
    if (isPlainObject(conf) && key in conf) {
      delete conf[key];
      settings.set(id, conf);
    }
  }
}

// Role settings that still hold a name (from older versions, or the "Moderator" /
// "Administrator" defaults) are converted to the IDs of every role that name matches in
// any capitals: the same roles that counted before, now pinned down so a renamed or
// newly created lookalike can't start counting. Names that match no role are left, so
// they still work if the role is created later. Run for each server at startup and when
// the bot joins one. Returns what was converted, for the log.
export const ROLE_SETTINGS = ["modRole", "adminRole", "verifiedRole"];

export function migrateRoleSettings(guild) {
  const current = getSettings(guild);
  const converted = [];
  for (const key of ROLE_SETTINGS) {
    const value = current[key];
    if (!value || value === "false" || isIdList(value)) continue;
    const roles = resolveRoles(guild, value);
    if (!roles.length) continue;
    saveOverride(guild.id, key, roles.map(r => r.id).join(","));
    converted.push(`${key} "${value}" → ${roles.map(r => `${r.name} (${r.id})`).join(", ")}`);
  }
  return converted;
}

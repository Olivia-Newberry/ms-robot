// The /settings panel: one page of settings at a time, with a menu and arrows to move
// between pages and a button that opens a form pre-filled with that page's values.
//
// Everything the buttons need is in their IDs (see modules/components.js), so a panel
// keeps working after a restart. Pages are rebuilt from the current settings on every
// click, so two admins editing at once always see the latest values.
//
//   setmenu:page:<userId>:<page>    show a page (arrows)
//   setmenu:jump:<userId>           show the page picked in the menu
//   setmenu:edit:<userId>:<page>    open the form for a page
//   setmenu:save:<userId>:<page>    the form being submitted

import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelSelectMenuBuilder, ChannelType, CheckboxBuilder, LabelBuilder,
  StringSelectMenuOptionBuilder,
  ModalBuilder, RoleSelectMenuBuilder, StringSelectMenuBuilder, TextInputBuilder, TextInputStyle,
} from "discord.js";
import { componentId } from "./components.js";
import { getSettings } from "./functions.js";
import { overridesFor, saveOverride } from "./settingsUi.js";
import { resolveRoles } from "./roleMatch.js";
import { describe, display, normalize, pagesFor } from "./settingsSchema.js";

export const PREFIX = "setmenu";

function pageList(guild) {
  const current = getSettings(guild);
  return { current, pages: pagesFor(Object.keys(current)) };
}

// A page number from an old panel can point past the end if custom keys were removed.
const clamp = (page, pages) => Math.min(Math.max(0, Number(page) || 0), pages.length - 1);

export function buildPanel(guild, userId, page, notice = "") {
  const { current, pages } = pageList(guild);
  page = clamp(page, pages);
  const overridden = overridesFor(guild.id);
  const { title, keys } = pages[page];

  const embed = {
    title: `Server settings: ${title}`,
    description: "In the form, clearing a text box or picker puts that setting back to its default, unless its note says empty turns it off.",
    color: 0x5865f2,
    fields: keys.map(key => ({
      name: `${describe(key).label}${key in overridden ? "" : " (default)"}`,
      value: `${display(key, current[key])}\n*\`${key}\` · ${describe(key).hint}*`,
    })),
    footer: { text: `Page ${page + 1} of ${pages.length}` },
  };

  const menu = new StringSelectMenuBuilder()
    .setCustomId(componentId(PREFIX, "jump", userId))
    .setPlaceholder("Jump to a page")
    .addOptions(pages.map((p, i) => ({
      label: p.title,
      value: String(i),
      description: p.keys.map(k => describe(k).label).join(", ").slice(0, 100),
      default: i === page,
    })));

  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(componentId(PREFIX, "page", userId, page - 1)).setLabel("◀ Previous").setStyle(ButtonStyle.Secondary).setDisabled(page === 0),
    new ButtonBuilder().setCustomId(componentId(PREFIX, "edit", userId, page)).setLabel(`Edit ${title}`).setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(componentId(PREFIX, "page", userId, page + 1)).setLabel("Next ▶").setStyle(ButtonStyle.Secondary).setDisabled(page === pages.length - 1),
  );

  return { content: notice || null, embeds: [embed], components: [new ActionRowBuilder().addComponents(menu), buttons] };
}

// Channels the log and welcome messages can be posted in.
const POSTABLE = [ChannelType.GuildText, ChannelType.GuildAnnouncement];
// The message log's ignore list also takes whole categories and forums.
const IGNORABLE = [...POSTABLE, ChannelType.GuildCategory, ChannelType.GuildForum, ChannelType.GuildVoice];

const findChannel = (guild, name) => guild.channels.cache.find(c => c.name === name && POSTABLE.includes(c.type));
const existingChannels = (guild, value) => (value ?? "").split(" ").filter(id => guild.channels.cache.has(id));

// The component for one setting, pre-filled with its current value, and the
// LabelBuilder method that holds that kind of component.
function fieldFor(guild, key, value) {
  const { type, max = 100, paragraph } = describe(key);
  switch (type) {
    case "bool":
      return ["setCheckboxComponent", new CheckboxBuilder().setCustomId(key).setDefault(value === "true")];
    case "choice":
      return ["setStringSelectMenuComponent", new StringSelectMenuBuilder().setCustomId(key).setRequired(false).addOptions(
        Object.entries(describe(key).choices).map(([choice, label]) => new StringSelectMenuOptionBuilder().setLabel(label).setValue(choice).setDefault(choice === value)),
      )];
    case "channelId":
    case "channelIds": {
      const picker = new ChannelSelectMenuBuilder().setCustomId(key).setRequired(false).setMinValues(0)
        .setMaxValues(type === "channelId" ? 1 : 25).setChannelTypes(...(type === "channelId" ? POSTABLE : IGNORABLE));
      const ids = existingChannels(guild, value).slice(0, type === "channelId" ? 1 : 25);
      if (ids.length) picker.setDefaultChannels(...ids);
      return ["setChannelSelectMenuComponent", picker];
    }
    case "channelName": {
      const picker = new ChannelSelectMenuBuilder().setCustomId(key).setRequired(false).setMinValues(0).setMaxValues(1).setChannelTypes(...POSTABLE);
      const channel = findChannel(guild, value);
      if (channel) picker.setDefaultChannels(channel.id);
      return ["setChannelSelectMenuComponent", picker];
    }
    case "role": {
      const picker = new RoleSelectMenuBuilder().setCustomId(key).setRequired(false).setMinValues(0).setMaxValues(25);
      // Matched the same way permission levels match it, so the form shows the roles
      // that actually count. An old name shows every role it matches, and saving the
      // form stores their IDs.
      const roles = resolveRoles(guild, value).slice(0, 25);
      if (roles.length) picker.setDefaultRoles(...roles.map(r => r.id));
      return ["setRoleSelectMenuComponent", picker];
    }
    default: {
      const limit = Math.min(max, 4000);
      const input = new TextInputBuilder().setCustomId(key).setStyle(paragraph ? TextInputStyle.Paragraph : TextInputStyle.Short)
        .setMaxLength(limit).setRequired(false);
      if (value) input.setValue(value.slice(0, limit));
      return ["setTextInputComponent", input];
    }
  }
}

export function buildForm(guild, userId, page) {
  const { current, pages } = pageList(guild);
  page = clamp(page, pages);
  const { title, keys } = pages[page];
  const modal = new ModalBuilder().setCustomId(componentId(PREFIX, "save", userId, page)).setTitle(`${title} settings`.slice(0, 45));
  for (const key of keys) {
    // The key itself is the field ID, so saving doesn't depend on the page still
    // holding the same keys by the time the form comes back.
    const { label, hint } = describe(key);
    const [setter, field] = fieldFor(guild, key, current[key]);
    modal.addLabelComponents(new LabelBuilder().setLabel(label).setDescription(hint.slice(0, 100))[setter](field));
  }
  return modal;
}

// Turns one submitted field back into the string the setting stores. Returns undefined
// for "empty", which means default (or "false" for settings whose `none` says so).
function submitted(fields, key, guild) {
  const { type, none: empty } = describe(key);
  switch (type) {
    case "bool":
      return { value: String(fields.getCheckbox(key)) };
    case "choice":
      // Nothing picked means the default, like clearing a text box.
      return { value: fields.getStringSelectValues(key)?.[0] ?? undefined };
    case "channelId":
    case "channelIds": {
      const ids = [...(fields.getSelectedChannels(key)?.keys() ?? [])];
      return { value: ids.length ? ids.join(" ") : empty };
    }
    case "channelName": {
      const channel = fields.getSelectedChannels(key)?.first();
      return { value: channel ? guild.channels.cache.get(channel.id)?.name ?? channel.name : empty };
    }
    case "role": {
      const ids = [...(fields.getSelectedRoles(key)?.keys() ?? [])];
      return { value: ids.length ? ids.join(",") : empty };
    }
    default: {
      const raw = fields.getTextInputValue(key) ?? "";
      return raw.trim() ? normalize(key, raw, guild) : { value: undefined };
    }
  }
}

// Saves what changed and reports what didn't pass. Invalid fields are skipped rather
// than failing the whole form, so one typo doesn't throw away the other edits.
export function saveForm(guild, fields) {
  const current = getSettings(guild);
  const overridden = overridesFor(guild.id);
  const saved = [], reset = [], errors = [];
  for (const key of fields.fields.keys()) {
    if (!(key in current)) continue;  // removed with /conf since the form was opened
    const result = submitted(fields, key, guild);
    if (result.error) { errors.push(`**${describe(key).label}** ${result.error}, so it wasn't changed.`); continue; }
    if (result.value === undefined) {
      if (key in overridden) { saveOverride(guild.id, key, undefined); reset.push(key); }
      continue;
    }
    if (result.value !== current[key]) { saveOverride(guild.id, key, result.value); saved.push(key); }
  }
  const lines = [];
  if (saved.length) lines.push(`✅ Saved ${saved.map(k => `\`${k}\``).join(", ")}.`);
  if (reset.length) lines.push(`↩️ Back to default: ${reset.map(k => `\`${k}\``).join(", ")}.`);
  if (!saved.length && !reset.length && !errors.length) lines.push("Nothing changed.");
  lines.push(...errors.map(e => `⚠️ ${e}`));
  return lines.join("\n");
}

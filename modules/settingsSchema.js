// What each server setting means and what values it accepts.
//
// Settings are stored as plain strings, so without this, "ture" or "50%" would be saved
// as-is and quietly break the feature that reads them. The /settings panel and /set
// both check values against these types before saving.
//
import { resolveRoles } from "./roleMatch.js";

// Pages group settings by topic because a Discord form holds at most 5 fields.
//
// Each type also decides what the form shows: a checkbox for true/false, a channel or
// role picker for channels and roles, and a text box for everything else. Pickers rule
// out typos entirely; the checks below are mainly for /set, where values are typed.

const PAGES = [
  { title: "General", keys: ["prefix", "commandReply", "systemNotice", "selfTimeout"] },
  { title: "Roles", keys: ["modRole", "adminRole", "verifiedRole"] },
  { title: "Welcome", keys: ["welcomeEnabled", "welcomeChannel", "welcomeMessage"] },
  { title: "Logging", keys: ["modLogChannel", "messageLogChannel", "messageLogIgnore"] },
  { title: "Reactions", keys: ["minecraftReactChance", "selfieReact"] },
];
export const FIELDS_PER_FORM = 5;

const OFF = ["false", "off", "none", "no", ""];

const TYPES = {
  text: (raw) => ({ value: raw }),
  bool: (raw) => {
    const v = raw.toLowerCase();
    if (["true", "yes", "on", "1"].includes(v)) return { value: "true" };
    if (["false", "no", "off", "0"].includes(v)) return { value: "false" };
    return { error: "must be true or false" };
  },
  percent: (raw) => {
    const n = Number(raw.replace(/%$/, ""));
    return Number.isInteger(n) && n >= 0 && n <= 100 ? { value: String(n) } : { error: "must be a whole number from 0 to 100" };
  },
  // Accepts a pasted #channel mention as well as a bare ID, since that's what people copy.
  channelId: (raw, guild) => {
    if (OFF.includes(raw.toLowerCase())) return { value: "false" };
    const id = raw.match(/^<#(\d{17,20})>$|^(\d{17,20})$/)?.slice(1).find(Boolean);
    if (!id) return { error: "must be a channel ID or #channel, or false to turn it off" };
    if (guild && !guild.channels.cache.has(id)) return { error: "isn't a channel in this server" };
    return { value: id };
  },
  // Stored as a name, not an ID, because the code that reads these (welcome messages,
  // role change logs) matches channels by name. A pasted mention is turned into the name.
  channelName: (raw, guild) => {
    const id = raw.match(/^<#(\d{17,20})>$/)?.[1];
    if (id) return guild?.channels.cache.get(id) ? { value: guild.channels.cache.get(id).name } : { error: "isn't a channel in this server" };
    return { value: raw.replace(/^#/, "") };
  },
  // Stored as comma-separated role IDs, so which roles count is pinned down even when
  // "Verified", "verified" and "vҽrified" all exist (see modules/roleMatch.js). Takes
  // mentions or IDs separated by commas, or a name, which means every role with that
  // name in any capitals, as names always have.
  role: (raw, guild) => {
    if (OFF.includes(raw.toLowerCase())) return { value: "false" };
    if (!guild) return { error: "can only be set from inside a server" };
    const ids = [];
    for (const part of raw.split(",").map(p => p.trim().replace(/^@/, "")).filter(Boolean)) {
      const roles = resolveRoles(guild, part);
      if (!roles.length) return { error: `"${part}" doesn't match any role` };
      ids.push(...roles.map(r => r.id));
    }
    return { value: [...new Set(ids)].join(",") };
  },
  channelIds: (raw, guild) => {
    if (OFF.includes(raw.toLowerCase())) return { value: "false" };
    const ids = [];
    for (const part of raw.split(/[\s,]+/).filter(Boolean)) {
      const id = part.match(/^<#(\d{17,20})>$|^(\d{17,20})$/)?.slice(1).find(Boolean);
      if (!id) return { error: `"${part}" isn't a channel ID or #channel` };
      if (guild && !guild.channels.cache.has(id)) return { error: `"${part}" isn't a channel in this server` };
      ids.push(id);
    }
    return { value: ids.join(" ") };
  },
};

// label: form field label (45 characters). hint: shown under the field and in the panel
// (100 characters). none: what an empty picker means; "false" turns the feature off,
// otherwise the setting goes back to its default.
const SCHEMA = {
  prefix: { label: "Prefix for message commands", type: "text", hint: "Only !deploy still uses it", max: 10 },
  commandReply: { label: "Ping people when replying", type: "bool", hint: "true or false" },
  systemNotice: { label: "Explain when a command is refused", type: "bool", hint: "true or false" },
  selfTimeout: { label: "Members can /timeout themselves", type: "bool", hint: "true or false" },
  modRole: { label: "Moderator roles", type: "role", hint: "Members with any of these get the Moderator level" },
  adminRole: { label: "Administrator roles", type: "role", hint: "Members with any of these get the Administrator level" },
  verifiedRole: { label: "Verified roles", type: "role", hint: "Leave empty if the server has none", none: "false" },
  welcomeEnabled: { label: "Welcome new members", type: "bool", hint: "true or false" },
  welcomeChannel: { label: "Welcome channel", type: "channelName", hint: "Where welcome messages are posted" },
  welcomeMessage: { label: "Welcome message", type: "text", hint: "{{user}} is replaced with the new member", paragraph: true, max: 2000 },
  modLogChannel: { label: "Role change log channel", type: "channelName", hint: "Where /addrole and /removerole are logged" },
  messageLogChannel: { label: "Message log channel", type: "channelId", hint: "Where edits and deletes are logged; empty turns it off", none: "false" },
  messageLogIgnore: { label: "Channels the message log skips", type: "channelIds", hint: "Channels or categories; empty logs everything", none: "false", max: 1000 },
  minecraftReactChance: { label: "Minecraft reaction chance (%)", type: "percent", hint: "0 to 100; 0 turns it off" },
  selfieReact: { label: "React to selfies", type: "bool", hint: "true or false" },
};

export const describe = (key) => SCHEMA[key] ?? { label: key.slice(0, 45), type: "text", hint: "Custom setting" };

// Keys added with /conf have no page of their own, so they're collected at the end.
export function pagesFor(allKeys) {
  const known = new Set(PAGES.flatMap(p => p.keys));
  const pages = PAGES.map(p => ({ ...p, keys: p.keys.filter(k => allKeys.includes(k)) })).filter(p => p.keys.length);
  const other = allKeys.filter(k => !known.has(k));
  for (let i = 0; i < other.length; i += FIELDS_PER_FORM) {
    pages.push({ title: other.length > FIELDS_PER_FORM ? `Other ${i / FIELDS_PER_FORM + 1}` : "Other", keys: other.slice(i, i + FIELDS_PER_FORM) });
  }
  return pages;
}

// Returns { value } or { error }. `guild` lets channel settings check the channel exists.
export function normalize(key, raw, guild) {
  const { type, max = 100 } = describe(key);
  const trimmed = raw.trim();
  if (trimmed.length > max) return { error: `can be at most ${max} characters` };
  return TYPES[type](trimmed, guild);
}

// Makes stored IDs readable in the panel.
export function display(key, value) {
  const { type } = describe(key);
  if (value === undefined || value === "") return "*(empty)*";
  if ((type === "channelId" || type === "channelIds") && value !== "false") return value.split(" ").map(id => `<#${id}>`).join(" ");
  // Names saved by older versions are shown as they are.
  if (type === "role" && /^[\d,\s]+$/.test(value)) return value.split(/[\s,]+/).filter(Boolean).map(id => `<@&${id}> (\`${id}\`)`).join(", ");
  if (type === "percent") return `${value}%`;
  return value.length > 200 ? `${value.slice(0, 200)}…` : value;
}

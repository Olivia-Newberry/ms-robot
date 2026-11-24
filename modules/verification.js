// The "!verification" hand-off: in a server with a verification bot, "!verification"
// makes ms robot send that bot's command (e.g. "!!verify"), so members don't need to
// know it. In the server's help channels the hand-off doesn't work, so the bot replies
// with the server's help message instead (e.g. pointing to a sticky message or modmail).
//
// Each server sets it up in /settings (Verification page). It's off until the command is
// set, so other servers never trigger a bot they don't have.

import { openStore, safeGet } from "./db.js";
import { getSettings } from "./functions.js";
import { saveOverride } from "./settingsUi.js";

const isOff = (value) => !value || value === "false";

// { send } to hand off, { reply } to point elsewhere, or null when the server hasn't
// set it up.
export function verificationReply(message) {
  if (!message.guild) return null;
  const settings = message.settings ?? getSettings(message.guild);
  if (isOff(settings.verificationCommand)) return null;
  const help = isOff(settings.verificationHelpChannels) ? [] : settings.verificationHelpChannels.split(/[\s,]+/);
  // A thread counts as its channel, so a help thread inside a help channel still is one.
  const inHelp = [message.channel.id, message.channel.parentId].some(id => id && help.includes(id));
  if (inHelp) return isOff(settings.verificationHelpMessage) ? null : { reply: settings.verificationHelpMessage };
  return { send: settings.verificationCommand };
}

// ---- One-time import from .env ----------------------------------------------------------
//
// Before this was a server setting, the server, command, channel names and help message came
// from VERIFICATION_* in .env. On startup they're copied into that one server's
// settings, so it keeps working with no setup. Done once per server, and recorded, so
// turning the feature off in /settings later doesn't bring it back on the next start.
// Afterwards the VERIFICATION_* lines can be removed from .env.

const imports = openStore("imports");
const importKey = (guildId) => `verification:${guildId}`;

// Returns what it did, for the startup log, or [] when there's nothing to do.
export function importVerificationSettings(guild, env = process.env) {
  if (!env.VERIFICATION_SERVER_ID || env.VERIFICATION_SERVER_ID !== guild.id) return [];
  if (safeGet(imports, importKey(guild.id))) return [];
  // A server that has already been set up in /settings wins over .env.
  if (!isOff(getSettings(guild).verificationCommand)) {
    imports.set(importKey(guild.id), { at: Date.now(), skipped: "already set in /settings" });
    return [];
  }

  const done = [];
  if (env.VERIFICATION_COMMAND) {
    saveOverride(guild.id, "verificationCommand", env.VERIFICATION_COMMAND);
    done.push(`command "${env.VERIFICATION_COMMAND}"`);
  }
  // Names are matched against this server's channels only, ignoring case; a name can
  // match several channels. Names that match nothing are reported, not guessed at.
  const names = (env.VERIFICATION_HELP_CHANNELS ?? "").split(",").map(s => s.trim().replace(/^#/, "")).filter(Boolean);
  const ids = [], missing = [];
  for (const name of names) {
    const found = [...guild.channels.cache.values()].filter(c => c.name?.toLowerCase() === name.toLowerCase());
    if (found.length) ids.push(...found.map(c => c.id));
    else missing.push(name);
  }
  if (ids.length) {
    saveOverride(guild.id, "verificationHelpChannels", [...new Set(ids)].join(" "));
    done.push(`help channels ${ids.map(id => `#${guild.channels.cache.get(id).name} (${id})`).join(", ")}`);
  }
  if (missing.length) done.push(`no channel named ${missing.map(n => `"${n}"`).join(", ")}, skipped`);
  if (env.VERIFICATION_HELP_MESSAGE) {
    saveOverride(guild.id, "verificationHelpMessage", env.VERIFICATION_HELP_MESSAGE);
    done.push(`help message "${env.VERIFICATION_HELP_MESSAGE}"`);
  }
  imports.set(importKey(guild.id), { at: Date.now(), imported: done });
  return done;
}

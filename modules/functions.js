import { error } from "./Logger.js";
import config from "../config.js";
import { sanitizeSettings, settings } from "./settings.js";
import { safeGet } from "./db.js";
import { shutdown } from "./lifecycle.js";

const __dirname = import.meta.dirname;
// Let's start by getting some useful functions that we'll use throughout
// the bot, like logs and elevation features.

/*
  PERMISSION LEVEL FUNCTION

  This is a very basic permission system for commands which uses "levels"
  "spaces" are intentionally left black so you can add them if you want.
  NEVER GIVE ANYONE BUT OWNER THE LEVEL 10! By default this can run any
  command including the VERY DANGEROUS `eval` and `exec` commands!

  */
function permlevel(message) {
  let permlvl = 0;

  const permOrder = config.permLevels.slice(0).sort((p, c) => p.level < c.level ? 1 : -1);

  while (permOrder.length) {
    const currentLevel = permOrder.shift();
    if (message.guild && currentLevel.guildOnly) continue;
    if (currentLevel.check(message)) {
      permlvl = currentLevel.level;
      break;
    }
  }
  return permlvl;
}

/*
  GUILD SETTINGS FUNCTION

  This function merges the default settings (from config.defaultSettings) with any
  guild override you might have for particular guild. If no overrides are present,
  the default settings are used.

*/
  
// getSettings merges the client defaults with the guild settings. guild settings in
// enmap should only have *unique* overrides that are different from defaults.
// function getSettings(guild) {
//   settings.ensure("default", config.defaultSettings);
//   if (!guild) return settings.get("default");
//   const guildConf = settings.get(guild.id) || {};
//   // This "..." thing is the "Spread Operator". It's awesome!
//   // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Spread_syntax
//   return ({...settings.get("default"), ...guildConf});
// }
// Never throws: unreadable or oddly typed saved settings fall back to the defaults in
// config.js, key by key, so one bad value doesn't reset a server's whole setup.
function getSettings(guild) {
  const guildId = typeof guild === "string" ? guild : guild?.id;
  const defaults = { ...config.defaultSettings, ...sanitizeSettings(safeGet(settings, "default", {})) };
  if (!guildId) return defaults;
  return { ...defaults, ...sanitizeSettings(safeGet(settings, guildId, {})) };
}

// These 2 process methods will catch exceptions and give *more details* about the error and stack trace.
process.on("uncaughtException", (err) => {
  // Non-Error values can be thrown too, and have no stack.
  const errorMsg = String(err?.stack ?? err).replaceAll(`${__dirname}/`, "./");
  error(`Uncaught Exception: ${errorMsg}`);
  console.error(err);
  // Always best practice to let the code crash on uncaught exceptions, since state
  // may be broken. Queued work is saved first and the service manager restarts us.
  shutdown(1, "Crashed");
});

process.on("unhandledRejection", err => {
  error(`Unhandled rejection: ${err}`);
  console.error(err);
});

export { getSettings, permlevel };
export default { getSettings, permlevel };
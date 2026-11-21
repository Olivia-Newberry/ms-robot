import config from "../config.js";
import { isPlainObject, openStore } from "./db.js";

// Every setting is stored as a string ("true", "false", IDs separated by spaces...).
// Older versions of the bot sometimes saved other types, so this turns what it can
// back into strings and leaves out what it can't (objects, null).
export function sanitizeSettings(value) {
  if (!isPlainObject(value)) return {};
  const clean = {};
  for (const [key, v] of Object.entries(value)) {
    if (typeof v === "string") clean[key] = v;
    else if (typeof v === "boolean" || typeof v === "number") clean[key] = String(v);
    // "false" is how the rest of the project spells an empty list.
    else if (Array.isArray(v) && v.every(x => typeof x === "string" || typeof x === "number")) clean[key] = v.length ? v.join(" ") : "false";
  }
  return clean;
}

// Runs over every saved entry at startup (see modules/db.js). The "default" entry also
// picks up any keys added to config.defaultSettings since it was first saved, which
// Enmap's ensure() never does for an entry that already exists.
function validateSettings(value, key) {
  if (!isPlainObject(value)) return { drop: "server settings should be an object" };
  let clean = sanitizeSettings(value);
  if (key === "default") clean = { ...config.defaultSettings, ...clean };
  return JSON.stringify(clean) === JSON.stringify(value) ? undefined : { value: clean };
}

// Servers only store the settings they've changed, so changing a default reaches
// every server that never set it.
export const settings = openStore("settings", { validate: validateSettings });

// A read-only or broken database shouldn't stop the bot starting; getSettings() falls
// back to config.defaultSettings anyway.
try {
  settings.ensure("default", config.defaultSettings);
} catch (e) {
  console.error("Couldn't save default settings:", e.message);
}

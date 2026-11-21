// Opening Enmap stores so that bad data can't take the bot down.
//
// Enmap throws when it reads a row it can't decode. That covers rows written by older
// Enmap versions (plain JSON, from before the v6 format, with no migration run) as
// well as genuinely corrupt rows. Its set() reads the old value first, so a bad row
// breaks writes to that key too.
//
// openStore() checks every row once, at startup:
//   - rows in the old plain JSON format are converted to the current format
//   - rows that pass decoding go through the store's validate() to fix or reject
//     values of the wrong shape
//   - anything that can't be recovered is copied to data/quarantine.jsonl, with the
//     original text, and removed from the store. Nothing is thrown away unrecorded.
// If the database file itself can't be opened or read, the store falls back to an
// in-memory copy so the bot keeps running (on defaults), and says so loudly.

import Database from "better-sqlite3";
import Enmap from "enmap";
import { appendFileSync, existsSync } from "fs";
import { resolve } from "path";
import { error, warn } from "./Logger.js";

const DATA_DIR = resolve(process.cwd(), "data");
const FILE = resolve(DATA_DIR, "enmap.sqlite");
const QUARANTINE = resolve(DATA_DIR, "quarantine.jsonl");

// Exported so commands can warn admins that changes they make won't be saved.
export const degradedStores = new Set();

let raw = null;
let checkedIntegrity = false;

// Enmap only gives back decoded values, and a bad row is exactly the one it can't
// decode, so a second read-only connection reads the raw text.
function rawValue(name, key) {
  raw ??= new Database(FILE, { readonly: true, fileMustExist: true });
  return raw.prepare(`SELECT value FROM "${name.replace(/"/g, "\"\"")}" WHERE key = ?`).get(key)?.value;
}

// Reported at startup so a damaged file is noticed before it shows up as odd
// behaviour. It doesn't stop the bot, because the readable rows are still worth using.
function checkIntegrity() {
  if (checkedIntegrity || !existsSync(FILE)) return;
  checkedIntegrity = true;
  try {
    const db = new Database(FILE, { readonly: true, fileMustExist: true });
    const result = db.pragma("quick_check", { simple: true });
    db.close();
    if (result !== "ok") error(`data/enmap.sqlite failed its integrity check (${result}). Readable rows will still be used; back the file up before changing it.`);
  } catch (e) {
    error(`data/enmap.sqlite couldn't be checked: ${e.message}`);
  }
}

// Appended rather than overwritten, and never deleted by the bot, so anything it
// couldn't use can still be inspected or put back by hand.
export function quarantine(name, key, value, reason) {
  try {
    appendFileSync(QUARANTINE, JSON.stringify({ at: new Date().toISOString(), store: name, key, reason, value }) + "\n");
  } catch (e) {
    error(`Couldn't write to data/quarantine.jsonl: ${e.message}`);
  }
  warn(`Set aside unreadable ${name} entry "${key}" (${reason}). Its original data is in data/quarantine.jsonl.`);
}

// validate(value, key) returns:
//   undefined                  keep as is
//   { value }                  replace with this (fixed) value
//   { drop: "reason" }         set it aside
function repair(store, name, validate) {
  let migrated = 0, dropped = 0;
  for (const key of store.keys()) {
    let value, changed = false;
    try {
      value = store.get(key);
    } catch {
      const text = rawValue(name, key);
      try {
        // Enmap before v6 stored plain JSON.
        value = JSON.parse(text);
        changed = true;
      } catch {
        quarantine(name, key, text, "not readable as Enmap data or JSON");
        store.delete(key); dropped++;
        continue;
      }
      if (value === null || value === undefined) {
        quarantine(name, key, text, "empty value");
        store.delete(key); dropped++;
        continue;
      }
      // Current-format data ({ t, v }) that still failed to decode is damaged, not old.
      if (typeof value === "object" && typeof value.t === "number" && "v" in value) {
        quarantine(name, key, text, "damaged Enmap data");
        store.delete(key); dropped++;
        continue;
      }
    }

    const verdict = validate?.(value, key);
    if (verdict?.drop) {
      quarantine(name, key, value, verdict.drop);
      store.delete(key); dropped++;
      continue;
    }
    if (verdict && "value" in verdict) { value = verdict.value; changed = true; }

    if (changed) {
      // set() reads the old row first, so the bad one has to go before rewriting.
      store.delete(key);
      store.set(key, value);
      migrated++;
    }
  }
  if (migrated || dropped) warn(`Checked the ${name} store: ${migrated} entr${migrated === 1 ? "y" : "ies"} repaired, ${dropped} set aside.`);
}

export function openStore(name, { validate } = {}) {
  checkIntegrity();
  try {
    const store = new Enmap({ name });
    repair(store, name, validate);
    return store;
  } catch (e) {
    error(`The ${name} store couldn't be loaded (${e.message}). Running from memory with no saved ${name} data; changes won't be kept until data/enmap.sqlite is fixed.`);
    degradedStores.add(name);
    return new Enmap({ inMemory: true });
  }
}

// For reads during normal running: a row can only go bad after startup if something
// outside the bot edits the file, but a lookup should still never throw.
export function safeGet(store, key, fallback = null) {
  try {
    return store.get(key) ?? fallback;
  } catch (e) {
    warn(`Couldn't read "${key}": ${e.message}`);
    return fallback;
  }
}

export const isPlainObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

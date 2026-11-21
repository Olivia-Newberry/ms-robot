// A database as an older version of the bot might have left it: rows in Enmap's old
// plain-JSON format, wrongly typed values, and some that are simply broken. Imported
// before the project modules so they find it on startup. Used by db.test.js.
import "./tempDataDir.js";
import Database from "better-sqlite3";
import Enmap from "enmap";

new Enmap({ name: "settings" }).set("goodGuild", { prefix: "$" });
new Enmap({ name: "jobs" });
const raw = new Database("data/enmap.sqlite");
const put = (table, key, value) => raw.prepare(`INSERT OR REPLACE INTO "${table}" (key, value) VALUES (?, ?)`).run(key, value);
put("settings", "default", JSON.stringify({ prefix: "!", modRole: "Moderator" }));
put("settings", "legacyGuild", JSON.stringify({ prefix: "?", assignableRoles: ["111", "222"], systemNotice: true, weird: { x: 1 } }));
put("settings", "garbageGuild", "{{{ not json");
put("settings", "damagedGuild", JSON.stringify({ t: 99, v: 1 }));
put("settings", "stringGuild", JSON.stringify("just a string"));
put("jobs", "legacy-job", JSON.stringify({ type: "reminder", data: { text: "hi" } }));
put("jobs", "no-type", JSON.stringify({ data: {} }));
raw.close();

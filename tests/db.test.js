// Startup repair of old-format and damaged rows (modules/db.js).
import "./setup/legacyDatabase.js";   // first: the old database the modules below find
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "fs";
import { settings } from "../modules/settings.js";
import { getSettings } from "../modules/functions.js";
import * as jobs from "../modules/jobs.js";

test("old plain-JSON rows are converted and their values kept", () => {
  const s = getSettings("legacyGuild");
  assert.equal(s.prefix, "?");
  assert.equal(s.assignableRoles, "111 222");   // arrays become the space-separated form
  assert.equal(s.systemNotice, "true");         // booleans become strings
  assert.equal(settings.get("legacyGuild").weird, undefined);
});

test("rows that can't be recovered fall back to defaults instead of crashing", () => {
  for (const guild of ["garbageGuild", "damagedGuild", "stringGuild", "neverSeen"]) assert.equal(getSettings(guild).prefix, "!");
});

test("the stored defaults pick up keys added to config.js since", () => {
  assert.ok("messageLogChannel" in settings.get("default"));
});

test("writes to a repaired server work (Enmap's set() reads the old row first)", () => {
  settings.set("legacyGuild", "@mods", "modRole");
  assert.equal(settings.get("legacyGuild").modRole, "@mods");
});

test("everything set aside is recorded with its original data", () => {
  const lines = readFileSync("data/quarantine.jsonl", "utf8").trim().split("\n").map(l => JSON.parse(l));
  const keys = lines.map(l => `${l.store}/${l.key}`);
  for (const k of ["settings/garbageGuild", "settings/damagedGuild", "settings/stringGuild", "jobs/no-type"]) assert.ok(keys.includes(k), k);
  assert.equal(lines.find(l => l.key === "garbageGuild").value, "{{{ not json");
});

test("old-format jobs are repaired and still run", async () => {
  const ran = [];
  jobs.registerJobType("reminder", { run: async (client, batch) => { ran.push(...batch.map(j => j.data.text)); } });
  jobs.startJobs({});
  await new Promise(r => setTimeout(r, 100));
  await jobs.stopJobs();
  assert.deepEqual(ran, ["hi"]);
});

// A database file that isn't a database at all: the bot should still start.
import "./setup/unreadableDatabase.js";   // first
import { test } from "node:test";
import assert from "node:assert/strict";
import { degradedStores } from "../modules/db.js";
import { getSettings } from "../modules/functions.js";

test("falls back to in-memory stores on defaults", () => {
  assert.equal(getSettings("anyGuild").prefix, "!");
  assert.ok(degradedStores.has("settings"));
});

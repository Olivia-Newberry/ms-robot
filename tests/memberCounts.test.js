import { test } from "node:test";
import assert from "node:assert/strict";
import { Collection } from "discord.js";
import { cacheMembers, countMembers, describeMembers } from "../modules/memberCounts.js";

const member = (id, bot) => [id, { id, user: { bot } }];
const server = (memberCount, cached) => ({ name: "s", memberCount, members: { cache: new Collection(cached), fetch: async () => {} } });

test("separates people from bots across servers", () => {
  const counts = countMembers([
    server(3, [member("1", false), member("2", false), member("3", true)]),
    server(2, [member("1", false), member("4", true)]),
  ]);
  assert.deepEqual(counts, { people: 3, bots: 2, total: 5, complete: true });
  assert.deepEqual(describeMembers(counts), ["• Members    :: 5", "• People     :: 3", "• Bots       :: 2"]);
});

test("doesn't guess while a member list is still loading", () => {
  const counts = countMembers([server(12_000, [member("1", true)])]);
  assert.equal(counts.complete, false);
  assert.deepEqual(describeMembers(counts), ["• Members    :: 12,000"]);
});

test("a server whose list fails to load doesn't stop the others", async () => {
  const loaded = [];
  const failing = { name: "broken", members: { fetch: async () => { throw new Error("Missing Access"); } } };
  const fine = { name: "fine", members: { fetch: async () => { loaded.push("fine"); } } };
  await cacheMembers([failing, fine]);
  assert.deepEqual(loaded, ["fine"]);
});

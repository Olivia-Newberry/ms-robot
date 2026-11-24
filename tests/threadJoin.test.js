// Joining active threads so the message log sees their messages (modules/threadJoin.js).
import { test } from "node:test";
import assert from "node:assert/strict";
import { Collection } from "discord.js";
import { activeThreads, joinThread, joinThreads } from "../modules/threadJoin.js";
import threadUpdate from "../events/threadUpdate.js";
import threadListSync from "../events/threadListSync.js";

const joins = [];
function thread(id, { joined = false, archived = false, joinable = true, visible = true, fails = false } = {}) {
  return {
    id, joined, archived, joinable, isThread: () => true,
    guild: { members: { me: {} } },
    permissionsFor: () => ({ has: () => visible }),
    join: async () => { if (fails) throw new Error("Unknown Channel"); joins.push(id); },
  };
}

test("joins threads it can see and isn't in, and skips the rest", async () => {
  joins.length = 0;
  const threads = [
    thread("new"),
    thread("already", { joined: true }),
    thread("archived", { archived: true }),
    thread("private", { joinable: false }),
    thread("hidden", { visible: false }),
    thread("deleted", { fails: true }),    // gone a moment ago: not an error
  ];
  assert.equal(await joinThreads(threads), 1);
  assert.deepEqual(joins, ["new"]);
  assert.equal(await joinThread({ isThread: () => false }), false, "not a thread");
});

test("reopened threads and threads in newly visible channels are joined", async () => {
  joins.length = 0;
  await threadUpdate(null, thread("t", { archived: true }), thread("t"));
  await threadUpdate(null, thread("renamed"), thread("renamed"));   // not reopened: left alone
  await threadListSync(null, new Collection([["a", thread("a")], ["b", thread("b")]]));
  assert.deepEqual(joins, ["t", "a", "b"]);
});

test("active threads are the server's unarchived threads", () => {
  const guild = { channels: { cache: new Collection([
    ["c", { id: "c", isThread: () => false }], ["t", thread("t")], ["old", thread("old", { archived: true })],
  ]) } };
  assert.deepEqual(activeThreads(guild).map(t => t.id), ["t"]);
});

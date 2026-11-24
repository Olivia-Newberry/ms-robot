// Deciding Node's memory limit from config.js. Only the decision is tested; actually
// restarting would restart the test runner.
import { test } from "node:test";
import assert from "node:assert/strict";
import { plan, startedWith } from "../modules/nodeHeap.js";

const GB = 1024 * 1024 * 1024;
const droplet = { percent: 70, totalBytes: 0.94 * GB, current: null, alreadyApplied: undefined };

test("reads the limit Node was started with", () => {
  assert.equal(startedWith(["--max-old-space-size=672"], ""), 672);
  assert.equal(startedWith([], "--trace-warnings --max-old-space-size=500"), 500);
  assert.equal(startedWith([], ""), null);
});

test("on Node 22.15+ it restarts in place with 70% of RAM", () => {
  assert.deepEqual(plan({ ...droplet, canRestart: true }), { action: "restart", mb: 673 });
});

test("on older Node (production's 20) it can't, so it says what to add to the service", () => {
  assert.deepEqual(plan({ ...droplet, canRestart: false }), { action: "warn", mb: 673 });
});

test("nothing to do once it's applied, or set to that already, or turned off", () => {
  assert.equal(plan({ ...droplet, canRestart: true, alreadyApplied: "673" }).action, "none");
  assert.equal(plan({ ...droplet, canRestart: true, current: 673 }).action, "none");
  assert.equal(plan({ ...droplet, percent: null, canRestart: true }).action, "none");
});

test("scales with the server", () => {
  assert.equal(plan({ ...droplet, totalBytes: 4 * GB, canRestart: true }).mb, 2867);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { componentId, parseComponentId } from "../modules/components.js";

test("ids round-trip", () => {
  assert.deepEqual(parseComponentId(componentId("msglog", "ctx", "123", "456")), { prefix: "msglog", args: ["ctx", "123", "456"] });
});

test("refuses ids Discord would reject or that would parse wrongly", () => {
  assert.throws(() => componentId("x", "a:b"), /can't contain/);
  assert.throws(() => componentId("x", "y".repeat(100)), /Discord allows 100/);
});

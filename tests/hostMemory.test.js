import { test } from "node:test";
import assert from "node:assert/strict";
import { formatBytes, heapUsage, hostMemory, serviceMemory } from "../modules/hostMemory.js";

const files = (contents) => (path) => {
  if (path in contents) return contents[path];
  throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
};

test("a service's memory from its systemd cgroup", () => {
  assert.equal(serviceMemory("modmail.service", files({ "/sys/fs/cgroup/system.slice/modmail.service/memory.current": "220200960\n" })), 220200960);
});

test("older hosts (cgroup v1) are read too", () => {
  assert.equal(serviceMemory("modmail.service", files({ "/sys/fs/cgroup/memory/system.slice/modmail.service/memory.usage_in_bytes": "1048576" })), 1048576);
});

test("a service the bot can't see is left out, not an error", () => {
  assert.equal(serviceMemory("modmail.service", files({})), null);
  assert.equal(serviceMemory("modmail.service", files({ "/sys/fs/cgroup/system.slice/modmail.service/memory.current": "max" })), null);
});

test("server memory adds up", () => {
  const { total, available, used } = hostMemory();
  assert.ok(total > 0 && available > 0 && available <= total);
  assert.equal(used, total - available);
});

test("sizes switch to GB from a gigabyte", () => {
  const MB = 1024 * 1024;
  assert.equal(formatBytes(144 * MB), "144 MB");
  assert.equal(formatBytes(1023 * MB), "1,023 MB");
  assert.equal(formatBytes(22426 * MB), "21.9 GB");
  assert.equal(formatBytes(64073 * MB), "62.6 GB");
});

test("Node's memory limit is read at runtime", () => {
  const { used, limit } = heapUsage();
  assert.ok(used > 0 && limit > used);
});

// Memory of the machine the bot runs on, and of other services sharing it
// (MONITOR_SERVICES in .env, e.g. a modmail bot).
//
// A small server may be shared with other bots, so what matters is how much the whole
// machine has left, not just this process. Used by the message cache
// cleanup (modules/messageCache.js) and shown in /stats. Kept in one place so a future
// dashboard API can report the same numbers.

import { readFileSync } from "fs";
import os from "os";
import v8 from "v8";

// os.freemem() is the kernel's "available" figure on Linux (what can be used without
// swapping), not just unused memory, so it's the right number to keep a reserve of.
export function hostMemory() {
  const total = os.totalmem(), available = os.freemem();
  return { total, available, used: total - available };
}

// systemd keeps each service in its own cgroup and publishes its memory use (the whole
// process, as systemd counts it) in a file any user can read. cgroup v2 first; the v1
// path is for older hosts. Returns bytes, or null when the service isn't there or the
// bot can't see it (e.g. running in Docker), so callers can just leave it out.
export function serviceMemory(service, read = (path) => readFileSync(path, "utf8")) {
  const paths = [
    `/sys/fs/cgroup/system.slice/${service}/memory.current`,
    `/sys/fs/cgroup/memory/system.slice/${service}/memory.usage_in_bytes`,
  ];
  for (const path of paths) {
    try {
      const bytes = Number(read(path).trim());
      if (Number.isFinite(bytes)) return bytes;
    } catch { /* not this path */ }
  }
  return null;
}

// MB below a gigabyte, GB (one decimal) from there: "144 MB", "21.9 GB".
export function formatBytes(bytes) {
  const mbs = bytes / 1024 / 1024;
  return mbs < 1024 ? `${Math.round(mbs).toLocaleString()} MB` : `${(mbs / 1024).toFixed(1)} GB`;
}
export const mb = formatBytes;

// Node caps how much JavaScript memory one process may use, based on the machine's RAM
// (about 4 GB on a 64 GB machine, far less on a small one). Past it the process crashes
// with "heap out of memory", so the message cache must stay well under it.
export function heapUsage() {
  const { used_heap_size: used, heap_size_limit: limit } = v8.getHeapStatistics();
  return { used, limit };
}

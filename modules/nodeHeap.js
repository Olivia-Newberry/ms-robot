// Setting Node's JavaScript memory limit from config.js (nodeHeapPercent).
//
// Node sizes its limit from the machine's RAM, and on a small server it's far below what
// the bot could safely use. The limit can only be set when Node starts
// (--max-old-space-size), so when config.js asks for a different one, the bot restarts
// itself in place with the flag: same process ID, so systemd and Docker don't notice.
// That needs process.execve, which Node has from 22.15; on older Node (production is on
// 20) it can't, so it logs the line to add to the service instead and keeps Node's
// default.
//
// Applied by modules/applyNodeHeap.js, which index.js imports right after loading .env,
// before anything opens the database, so a restart in place never leaves anything half
// done. This file only exports functions, so tests can import it safely.

import os from "os";
import config from "../config.js";
import { warn } from "./Logger.js";

const MB = 1024 * 1024;
// Set on the restarted process, so it knows the limit came from config.js and doesn't
// restart again.
const APPLIED = "MS_ROBOT_HEAP_MB";

// The --max-old-space-size Node was started with, from its arguments or NODE_OPTIONS.
export function startedWith(execArgv = process.execArgv, nodeOptions = process.env.NODE_OPTIONS ?? "") {
  const match = [...execArgv, ...nodeOptions.split(/\s+/)].join(" ").match(/--max-old-space-size=(\d+)/);
  return match ? Number(match[1]) : null;
}

// What to do, without doing it: { action: "none" | "restart" | "warn", mb }.
export function plan({
  percent = config.nodeHeapPercent,
  totalBytes = os.totalmem(),
  current = startedWith(),
  canRestart = typeof process.execve === "function",
  alreadyApplied = process.env[APPLIED],
} = {}) {
  if (!percent) return { action: "none" };
  const mb = Math.floor(totalBytes / MB * percent / 100);
  if (current === mb || alreadyApplied) return { action: "none", mb };
  return { action: canRestart ? "restart" : "warn", mb };
}

export function applyNodeHeapLimit() {
  const { action, mb } = plan();
  if (action === "restart") {
    const args = [process.execPath, ...process.execArgv.filter(a => !a.startsWith("--max-old-space-size")), `--max-old-space-size=${mb}`, ...process.argv.slice(1)];
    process.execve(process.execPath, args, { ...process.env, [APPLIED]: String(mb) });
  }
  if (action === "warn") {
    warn(`config.js asks for a ${mb} MB Node memory limit (nodeHeapPercent: ${config.nodeHeapPercent}), but this Node (${process.version}) can't apply it itself; it needs 22.15 or newer. To apply it now, add this to ms-robot.service under [Service]: Environment=NODE_OPTIONS=--max-old-space-size=${mb}`);
  }
}

// Where the current limit came from, for /stats.
export function limitSource() {
  if (process.env[APPLIED]) return `${config.nodeHeapPercent}% of RAM, from config.js`;
  if (startedWith()) return "from NODE_OPTIONS";
  return "Node's default";
}

// Shutting down without losing queued work.
//
// Crashes, !reboot, and SIGTERM/SIGINT (systemd stop, docker stop, Ctrl+C) all come
// here. Running job batches get a few seconds to finish, then the bot disconnects and
// exits. Anything still queued is saved and resumes when the bot starts again, which
// the service manager does automatically (Restart=always / restart: unless-stopped).

import { stopJobs } from "./jobs.js";
import { error, warn } from "./Logger.js";

// Short enough to finish inside docker's 20s stop_grace_period (docker-compose.yml)
// and systemd's default 90s, so the bot exits on its own rather than being killed.
const GRACE = 10_000;
let client = null;
let stopping = false;

export function setClient(discordClient) {
  client = discordClient;
}

export async function shutdown(code = 0, reason = "shutting down") {
  if (stopping) return;
  stopping = true;
  warn(`${reason}: finishing queued work before exiting…`);
  // A stuck send must not keep a crashed process alive; the restart matters more.
  setTimeout(() => process.exit(code), GRACE + 5000);
  try {
    await stopJobs(GRACE);
  } catch (e) {
    error(`Error while stopping jobs: ${e.message}`);
  }
  // Closing the gateway connection shows the bot offline straight away instead of
  // after Discord's heartbeat timeout.
  try {
    client?.destroy();
  } catch { /* exiting anyway */ }
  process.exit(code);
}

for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => shutdown(0, `Received ${signal}`));
}

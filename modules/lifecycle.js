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
const beforeExit = [];

export function setClient(discordClient) {
  client = discordClient;
}

// For work that only exists in memory and should be saved before exiting. Registered
// rather than imported here, because the modules that need it already import this one.
export function onShutdown(hook) {
  beforeExit.push(hook);
}

export async function shutdown(code = 0, reason = "shutting down") {
  if (stopping) return;
  stopping = true;
  warn(`${reason}: finishing queued work before exiting…`);
  // A stuck send must not keep a crashed process alive; the restart matters more.
  setTimeout(() => process.exit(code), GRACE + 5000);
  for (const hook of beforeExit) {
    try { await hook(); } catch (e) { error(`Error in a shutdown hook: ${e.message}`); }
  }
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

// Logging in, retried while Discord is unreachable. Exiting and letting systemd restart
// every few seconds would also work, but during a long outage that's thousands of
// attempts a day, and Discord resets a bot's token if it starts too many sessions.
// Errors that a retry can't fix (a wrong token, intents not enabled) still exit, so
// they show up in the service's status instead of being retried forever.
const PERMANENT = new Set(["TokenInvalid", "TokenMissing", "DisallowedIntents", "InvalidIntents"]);

export async function loginWithRetry(discordClient, token, {
  firstWait = 5_000, maxWait = 5 * 60_000,
  sleep = (ms) => new Promise(r => setTimeout(r, ms)),
  giveUp = () => shutdown(1, "Login failed"),
} = {}) {
  for (let wait = firstWait; ; wait = Math.min(wait * 2, maxWait)) {
    try {
      return await discordClient.login(token);
    } catch (e) {
      if (PERMANENT.has(e.code)) {
        error(`Couldn't log in to Discord: ${e.message}`);
        return giveUp(e);
      }
      warn(`Couldn't reach Discord (${e.message}). Trying again in ${Math.round(wait / 1000)}s.`);
      await discordClient.destroy?.().catch?.(() => {});
      await sleep(wait);
      if (stopping) return;
    }
  }
}

for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => shutdown(0, `Received ${signal}`));
}

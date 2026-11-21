// A small persistent job queue: send things now, later, or in batches.
//
//   registerJobType("reminder", { run: async (client, jobs) => { ... }, maxBatch: 1 });
//   const id = schedule("reminder", { userId, text }, { runAt: Date.now() + 3_600_000, lane: userId });
//   cancel(id);
//   findJobs(job => job.type === "reminder" && job.data.userId === userId);
//
// Why it works the way it does:
//   - Jobs are written to the database the moment they're scheduled, so a crash or
//     restart doesn't lose pending logs or reminders. That's also why job data has to
//     be plain JSON (Buffers as base64 strings).
//   - Lanes exist because order matters within a destination (one channel's log should
//     read in order) but not across destinations, which can run side by side.
//   - Batching isn't timed. While a lane waits on Discord's rate limit, new jobs pile up
//     and the next pass takes them together, so quiet periods send at once and bursts
//     batch themselves without adding a delay.
//   - run(client, jobs, { complete }) returns an array of the jobs it finished; anything
//     else (including nothing) means all of them.
//     The rest are retried with backoff, because most failures are Discord hiccups that
//     clear up. complete(job) removes a job the moment it's done, so a crash halfway
//     through a batch only repeats the unfinished part.
//   - Saved jobs are checked on load (modules/db.js) and one job type's errors are
//     caught, so bad data or a buggy handler can't stop every other job from running.

import { isPlainObject, openStore, quarantine } from "./db.js";
import { error, warn } from "./Logger.js";

const MAX_ATTEMPTS = 5;
// Doubled each attempt, so a Discord outage gets minutes to clear rather than being
// retried every few seconds.
const BACKOFF = 30 * 1000;
// setTimeout overflows past about 24.8 days, so a far-off reminder is reached by
// waking up regularly rather than with one long timer.
const MAX_SLEEP = 60 * 1000;

// Fills in what can be defaulted; a job with no type or data can't be run at all.
function validateJob(job, key) {
  if (!isPlainObject(job) || typeof job.type !== "string" || !job.type) return { drop: "job has no type" };
  if (!isPlainObject(job.data)) return { drop: "job has no data" };
  const fixed = {
    ...job,
    // The database key is what cancel() deletes by, so it wins over a stored id.
    id: key,
    lane: job.lane == null ? job.type : String(job.lane),
    runAt: Number.isFinite(job.runAt) ? job.runAt : Date.now(),
    seq: Number.isFinite(job.seq) ? job.seq : 0,
    attempts: Number.isFinite(job.attempts) ? job.attempts : 0,
    createdAt: Number.isFinite(job.createdAt) ? job.createdAt : Date.now(),
  };
  return JSON.stringify(fixed) === JSON.stringify(job) ? undefined : { value: fixed };
}

const store = openStore("jobs", { validate: validateJob });
const jobs = new Map();
const types = new Map();
const busyLanes = new Set();
// Kept so shutdown can wait for sends that are already under way.
const running = new Set();
let client = null;
let timer = null;
let sequence = 0;
let stopping = false;

export function registerJobType(type, { run, maxBatch = 1 }) {
  if (types.has(type)) throw new Error(`Job type "${type}" is already registered`);
  types.set(type, { run, maxBatch });
}

export function schedule(type, data, { runAt = Date.now(), lane = type } = {}) {
  const seq = sequence++;
  // The time part keeps IDs unique across restarts, where seq starts again from the
  // saved jobs.
  const id = `${Date.now().toString(36)}-${seq.toString(36)}`;
  const job = { id, type, lane: String(lane), runAt, seq, data, attempts: 0, createdAt: Date.now() };
  jobs.set(id, job);
  try {
    store.set(id, job);
  } catch (e) {
    // Still runs from memory; it just won't survive a restart.
    error(`Couldn't save job ${id} (${type}): ${e.message}`);
  }
  wake();
  return id;
}

export function cancel(id) {
  const existed = jobs.delete(id);
  try { store.delete(id); } catch (e) { error(`Couldn't remove job ${id}: ${e.message}`); }
  return existed;
}

export function findJobs(predicate = () => true) {
  return [...jobs.values()].filter(predicate);
}

// Called from ready because handlers need the client's channel cache, which is only
// filled by then.
export function startJobs(discordClient) {
  // ready can fire again after a full reconnect, and loading twice would run jobs twice.
  if (client) return;
  client = discordClient;
  let keys = [];
  try { keys = store.keys(); } catch (e) { error(`Couldn't load saved jobs: ${e.message}`); }
  for (const key of keys) {
    try {
      const job = store.get(key);
      if (!job) continue;
      jobs.set(job.id, job);
      sequence = Math.max(sequence, job.seq + 1);
    } catch (e) {
      error(`Skipping saved job ${key}: ${e.message}`);
    }
  }
  if (jobs.size) warn(`Resuming ${jobs.size} queued job(s).`);
  const unknown = new Set([...jobs.values()].map(j => j.type).filter(t => !types.has(t)));
  if (unknown.size) warn(`Saved jobs of unknown type(s) ${[...unknown].join(", ")} are kept but won't run until a handler is registered.`);
  wake();
}

// Stops starting new batches and waits (up to timeoutMs) for running ones to finish.
// Unfinished jobs stay saved and run on the next start.
export async function stopJobs(timeoutMs = 10_000) {
  stopping = true;
  clearTimeout(timer);
  if (!running.size) return;
  warn(`Waiting for ${running.size} job batch(es) to finish…`);
  await Promise.race([
    Promise.allSettled([...running]),
    new Promise(r => setTimeout(r, timeoutMs)),
  ]);
}

// Coalesces: scheduling 50 jobs in one tick still causes a single pass.
function wake(delay = 0) {
  if (!client || stopping) return;
  clearTimeout(timer);
  timer = setTimeout(tick, delay);
}

// Whatever goes wrong in a pass, the next one is still scheduled.
function tick() {
  try {
    pass();
  } catch (e) {
    error(`Job scheduler error: ${e.stack ?? e.message}`);
    wake(5000);
  }
}

function pass() {
  const now = Date.now();
  const lanes = new Map();
  let nextDue = Infinity;

  for (const job of jobs.values()) {
    const key = `${job.type}\u0000${job.lane}`;
    if (busyLanes.has(key)) continue;          // picked up when the lane finishes
    if (!types.has(job.type)) continue;        // handler not loaded; leave it stored
    if (job.runAt > now) { nextDue = Math.min(nextDue, job.runAt); continue; }
    // Lanes are per type too, so two job types can share a lane name without blocking
    // each other.
    if (!lanes.has(key)) lanes.set(key, []);
    lanes.get(key).push(job);
  }

  for (const [key, due] of lanes) {
    const { maxBatch } = types.get(due[0].type);
    // seq breaks ties, since jobs scheduled in the same millisecond must keep their order.
    due.sort((a, b) => a.runAt - b.runAt || a.seq - b.seq);
    const promise = runLane(key, due.slice(0, maxBatch));
    running.add(promise);
    promise.finally(() => running.delete(promise));
  }

  if (nextDue !== Infinity) wake(Math.min(nextDue - now, MAX_SLEEP));
}

async function runLane(key, batch) {
  busyLanes.add(key);
  try {
    let finished;
    const complete = (...done) => { for (const job of done.flat()) cancel(job.id); };
    try {
      const result = await types.get(batch[0].type).run(client, batch, { complete });
      // Anything but an array means "all done". A handler that ends with
      // `return channel.send(...)` returns a Message; treating that as a list used to
      // throw after the send, leaving the job unfinished so it was sent again forever.
      finished = Array.isArray(result) ? result : batch;
    } catch (e) {
      error(`Job batch ${batch[0].type}/${batch[0].lane} failed: ${e.stack ?? e.message}`);
      finished = [];
    }

    const finishedIds = new Set(finished.map(j => j.id));
    for (const job of batch) {
      if (!jobs.has(job.id)) continue;           // completed early or cancelled
      if (finishedIds.has(job.id)) { cancel(job.id); continue; }
      job.attempts++;
      if (job.attempts >= MAX_ATTEMPTS) {
        warn(`Giving up on job ${job.id} (${job.type}) after ${job.attempts} attempts.`);
        // Kept on record so a lost reminder or log entry can still be found later.
        quarantine("jobs", job.id, job, `failed ${job.attempts} times`);
        cancel(job.id);
        continue;
      }
      job.runAt = Date.now() + BACKOFF * 2 ** (job.attempts - 1);
      try { store.set(job.id, job); } catch (e) { error(`Couldn't save retry for job ${job.id}: ${e.message}`); }
    }
  } finally {
    busyLanes.delete(key);
    wake();
  }
}

import "./setup/tempDataDir.js";   // first
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "child_process";
import { ROOT } from "./helpers.js";
import * as jobs from "../modules/jobs.js";

const dir = process.cwd();
const wait = (ms) => new Promise(r => setTimeout(r, ms));

// Jobs that are still running when the tests finish would keep the process alive.
test.after(() => jobs.stopJobs(0));

const runs = [];
jobs.registerJobType("slow", {
  maxBatch: 10,
  async run(client, batch, { complete }) {
    runs.push(batch.map(j => j.data.n));
    for (const job of batch) { await wait(20); complete(job); }
  },
});
let failures = 1;
jobs.registerJobType("flaky", {
  async run() { if (failures-- > 0) throw new Error("simulated outage"); },
});
const fired = [];
jobs.registerJobType("reminder", { async run(client, batch) { fired.push(...batch.map(j => [j.data.text, Date.now()])); } });

test("a burst is sent in order, and jobs arriving while a lane is busy are batched", async () => {
  jobs.startJobs({});
  for (let n = 1; n <= 12; n++) jobs.schedule("slow", { n }, { lane: "channel-1" });
  await wait(600);
  assert.deepEqual(runs.flat(), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  assert.ok(runs.length < 12, `expected batching, got ${runs.length} batches`);
});

test("scheduled jobs wait for their time; cancelled ones never run", async () => {
  const start = Date.now();
  jobs.schedule("reminder", { text: "later" }, { runAt: start + 300 });
  jobs.cancel(jobs.schedule("reminder", { text: "cancelled" }, { runAt: start + 100 }));
  await wait(500);
  assert.deepEqual(fired.map(([text]) => text), ["later"]);
  assert.ok(fired[0][1] - start >= 290);
});

test("a failed job is kept and retried with backoff instead of lost", async () => {
  const id = jobs.schedule("flaky", {});
  await wait(100);
  const [job] = jobs.findJobs(j => j.id === id);
  assert.equal(job.attempts, 1);
  assert.ok(job.runAt > Date.now() + 20_000, "retry should be ~30s out");
});

test("jobs survive a restart", () => {
  // A separate process schedules a job and exits without running it...
  const script = `
    const jobs = await import(${JSON.stringify(new URL("modules/jobs.js", ROOT).href)});
    jobs.schedule("reminder", { text: "from before the restart" });
    process.exit(0);`;
  execFileSync(process.execPath, ["--input-type=module", "-e", script], { cwd: dir });
  // ...and this process, starting fresh, finds it in the database.
  const found = execFileSync(process.execPath, ["--input-type=module", "-e", `
    const jobs = await import(${JSON.stringify(new URL("modules/jobs.js", ROOT).href)});
    const ran = [];
    jobs.registerJobType("reminder", { run: async (c, b) => ran.push(...b.map(j => j.data.text)) });
    jobs.startJobs({});
    setTimeout(() => { console.log(JSON.stringify(ran)); process.exit(0); }, 200);`], { cwd: dir, encoding: "utf8" });
  assert.match(found, /from before the restart/);
});

test("a handler that returns something other than a list still completes its jobs (no resends)", async () => {
  let sends = 0;
  // Like a handler ending in `return channel.send(...)`, which returns a Message.
  jobs.registerJobType("returnsMessage", { async run() { sends++; return { id: "message", content: "sent" }; } });
  jobs.schedule("returnsMessage", {});
  await wait(300);
  assert.equal(sends, 1);
  assert.equal(jobs.findJobs(j => j.type === "returnsMessage").length, 0);
});

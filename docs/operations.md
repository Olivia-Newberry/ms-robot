# Running the bot

## Restarts

`ms-robot.service` (`Restart=always`) and `docker-compose.yml` (`restart:
unless-stopped`) bring the bot back after a crash or `/reboot`. A failed login (bad
token, Discord down) also exits, so it gets retried instead of sitting offline.

## Discord outages

During an outage, servers can drop out of Discord for a while and come back. The bot
handles that without losing anything:

- **A server that goes unavailable** keeps all its data. discord.js treats it as
  unavailable, not as the bot leaving, so nothing is deleted. The log notes
  `[GUILD UNAVAILABLE]`.
- **When it comes back** (`[GUILD AVAILABLE]`), the bot redoes that server's startup work
  if it missed it: loading the member list (for `/stats` bot counts), pinning role
  settings, and refilling recent messages for the message log.
- **Messages the bot couldn't send** (message log entries, reminders) are retried with
  growing waits, from 30 seconds up to 15 minutes, for up to a day. After that they're
  given up and recorded in `data/quarantine.jsonl`.
- **Starting while Discord is down:** login is retried inside the process, waiting 5
  seconds and doubling up to 5 minutes, instead of exiting and being restarted every few
  seconds. That matters because Discord resets a bot's token if it starts too many
  sessions in a day. A wrong token or missing intents still exit straight away, since
  retrying can't fix them.
- **Edits and deletes that happen during an outage** reach the bot only if Discord
  replays them when it reconnects, which it does for short drops but not long ones.

If the bot is really removed from a server (kicked, or the server deleted), that
server's settings and role panels are kept for 30 days, so re-adding it after a mistaken
kick keeps everything. After 30 days they're deleted.

## Shutting down without losing work

On a crash, `/reboot`, or `systemctl stop` / `docker stop`, the bot lets anything it's in
the middle of sending finish (up to 10 seconds), then exits. Everything still queued is
saved and carries on at the next start. Each message log entry is marked done as soon as
it's posted, so a hard kill repeats at most the message that was being sent.

## Damaged or old data

Every saved entry is checked at startup:

- Entries saved by older versions of the bot (before Enmap's current format) are
  converted.
- Values of the wrong type are fixed where the meaning is clear (`true` to `"true"`, a
  list of IDs to `"111 222"`), and dropped where it isn't, falling back to the default
  for that one setting.
- Anything that can't be recovered is removed from use and written, unchanged, to
  `data/quarantine.jsonl`. The startup log says which server it belonged to.

If the database file can't be opened at all, the bot runs on default settings from
memory and logs an error on every start until `data/enmap.sqlite` is restored. Back it up
before trying to repair it.

## Memory

Host resources are often small (about 1 GB, sometimes sharing with other services), so the caches are managed to help keep memory usage under control:

- **Messages** (`messageCache` in `config.js`): every channel keeps its last 200
  messages, as before 1.0, and a busy channel can hold up to 1,000 during a burst. There's
  no time limit. Every 5 minutes the bot checks two limits, both of which adapt to the
  server it runs on:
  - **`hostReservePercent` (30% in `config.js`):** if less than this share of the
    server's RAM is available, a quarter of the cache is dropped, and again at each check
    while it stays low. This keeps room for other bots on the server, surges and the OS.
  - **Node's own memory limit**, read at runtime: if JavaScript memory passes 75% of
    it, a quarter is dropped. On a small server Node's limit is much lower than the RAM,
    and running into it would slow the bot to a crawl and then crash it, possibly before
    the server itself runs low.

  The rest of the time the per-channel caps bound the cache.

- **Node's memory limit** (`nodeHeapPercent` in `config.js`, 70%): Node normally sets
  its own limit from the RAM, and on a small server that's far below what the bot could
  use. With this set, the bot uses that share of the server's RAM instead, leaving the
  30% reserve for other bots, surges and the OS. The limit can only be set as Node starts, so
  the bot restarts itself in place at startup with it applied (same process, so systemd
  doesn't notice). That needs Node 22.15 or newer; on older Node it logs the
  `Environment=NODE_OPTIONS=--max-old-space-size=…` line to add to `ms-robot.service`
  instead. `/stats` shows it on its own line with where it came from, e.g.
  `Mem Limit :: 670 MB (70% of RAM, from config.js)`, `(from NODE_OPTIONS)` or
  `(Node's default)`. Set it to `null` to keep Node's default.
  Burst extras (past a channel's newest 200) go first, then the oldest messages anywhere,
  and every channel keeps its newest 50. A bigger cache means fewer "original text isn't
  available" log entries.
- **Members:** the full member list is kept so `/stats` can count bots, about 6 MB for
  12,000 members.

For bot support, bot admins and the bot owner, `/stats` shows the bot's memory (JavaScript
and whole process), the message cache (messages held and estimated size), the server's
available memory, and the memory of each systemd service listed in `MONITOR_SERVICES` in
`.env` (e.g. `MONITOR_SERVICES=modmail.service`). Lines the bot can't read, e.g. when running in
Docker, are left out.

For reference, production on the 1.0 release (discord.js's default of 200 messages per
channel) showed 67 MB in `/stats` after two days, across 7 servers, 12,762 members and
1,059 channels. A cache check takes a few milliseconds even at 55,000 messages
across 1,000 channels.

## Docker

The database lives in `data/` inside the container, so rebuilding or recreating the
container starts it empty. To keep it, mount `./data:/usr/src/bot/data` as a volume,
after copying the current one out with `docker cp`.

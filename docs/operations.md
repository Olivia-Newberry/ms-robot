# Running the bot

## Restarts

`ms-robot.service` (`Restart=always`) and `docker-compose.yml` (`restart:
unless-stopped`) bring the bot back after a crash or `/reboot`. A failed login (bad
token, Discord down) also exits, so it gets retried instead of sitting offline.

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

## Docker

The database lives in `data/` inside the container, so rebuilding or recreating the
container starts it empty. To keep it, mount `./data:/usr/src/bot/data` as a volume,
after copying the current one out with `docker cp`.

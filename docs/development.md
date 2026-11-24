# Development

## Layout

| Folder | What's in it |
|---|---|
| `slash/` | Slash commands, one file each, loaded automatically |
| `commands/` | The remaining message commands (`!deploy`, `!user`, and `partialMessage.js` for chat features) |
| `components/` | Handlers for buttons, menus and forms |
| `events/` | Discord events; the file name is the event name |
| `modules/` | Shared code: settings, database, job queue, message log, role panels and so on |
| `tests/` | `npm test` |

## Adding a slash command

A file in `slash/` exports `run`, `commandData` and `conf`:

```js
import { ApplicationCommandOptionType } from "discord.js";

export async function run(client, interaction) {
  await interaction.reply(`Hello ${interaction.options.getUser("who") ?? interaction.user}`);
}

export const commandData = {
  name: "hello",
  description: "Say hello",
  options: [{ name: "who", description: "Who to greet", type: ApplicationCommandOptionType.User, required: false }],
};

// permLevel: the lowest level allowed to run it (see permLevels in config.js).
// guildOnly: hide it in DMs. category: its heading in /help.
export const conf = { permLevel: "User", guildOnly: false, category: "Fun" };
```

It's registered with Discord on the next start. `interaction.settings` holds the server's
settings.

## Buttons, menus and forms

Handled by files in `components/`, the same way `slash/` holds commands. A component's
custom ID is `<prefix>:<args...>`, built with `componentId()` from
`modules/components.js`, and the file whose `prefix` matches gets the click.

```js
// components/hello.js
export const prefix = "hello";
export const conf = { guildOnly: true };
export async function run(client, interaction, [userId]) { /* ... */ }

// wherever the button is sent
new ButtonBuilder().setCustomId(componentId("hello", user.id)).setLabel("Wave").setStyle(ButtonStyle.Primary);
```

Because all the state is in the ID, buttons keep working after a restart. IDs are
limited to 100 characters, so anything bigger is stored and looked up by a short key, the
way role panels store theirs (`components/rolepick.js`).

## Queued and scheduled jobs

`modules/jobs.js` is a small queue saved to the database, for anything that should be
sent later or could arrive faster than Discord accepts it. The message log uses it, and a
"remind me" feature would too:

```js
import { registerJobType, schedule, cancel, findJobs } from "../modules/jobs.js";

registerJobType("reminder", {
  async run(client, jobs) {
    for (const job of jobs) await (await client.users.fetch(job.data.userId)).send(job.data.text);
  },
});

const id = schedule("reminder", { userId, text }, { runAt: Date.now() + 60 * 60 * 1000, lane: userId });
```

- **Restarts:** jobs survive them, and anything that came due while the bot was down
  runs on startup.
- **Lanes:** jobs in the same `lane` run in order, one batch at a time; different lanes
  run side by side.
- **Batching:** `maxBatch` lets a job type take several due jobs at once. While a lane
  waits on a rate limit, new jobs pile up and the next batch takes them together.
- **Finishing:** `run` returns an array of the jobs it finished; anything else (including
  nothing) means all of them. The rest are retried with growing waits (30 seconds up to 15 minutes) for up to a day, so they survive a Discord outage.
  `complete(job)` marks one done straight away, so a crash mid-batch doesn't repeat it.
- **Job data** has to be plain JSON.

## Tests

```txt
npm test            offline, a few seconds: no Discord connection or internet needed
npm run test:live   also calls the real APIs the fun commands use
```

- **Tools:** the tests use Node's built-in test runner, so there's nothing extra to
  install.
- **Isolated:** each test file gets its own temporary database and never touches
  `data/`.
- **Realistic:** Discord is replaced by small look-alike objects in `tests/helpers.js`,
  and commands run through the real `interactionCreate` and `messageCreate` handlers, so
  permission checks, buttons and forms are covered too.

A test that touches the database imports `./setup/tempDataDir.js` first, before any
project module, because the database is opened as soon as `modules/settings.js` loads.

Run `npm run test:live` when a fun command starts failing: those services can shut down
(some-random-api.com did), and it shows which one.

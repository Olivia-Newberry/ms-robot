# ms-robot

A Discord bot for community servers: self-service role panels, moderation tools (an
edit/delete log, user lookups, role hand-outs), per-server settings, and some fun
commands.

## Setup

Needs Node 20.11 or newer.

```txt
npm ci
npm start
```

Copy `.env.example` to `.env` and fill it in. `TOKEN` and `OWNER` are required; the
rest are optional, and each one explains itself:

- `GIPHY_API_KEY` for `/gif`, and `MESSAGE_CONTENT_INTENT` (see below).
- `ALLOWED_BOTS`, `MOD_THREAD_SKIP_IDS` and `MONITOR_SERVICES` for working alongside
  other bots, such as a modmail bot.
- `VERIFICATION_*` only to carry an older setup of the `!verification` hand-off into
  `/settings` once; new servers set it up in `/settings` directly.

These are deployment details (IDs, service names), so they live in `.env` rather than
the code. `config.js` reads them. Anything a server might want differently goes in
`/settings` instead.

In the Discord Developer Portal, under the bot's **Privileged Gateway Intents**:

- **Server Members** is required: the bot won't connect without it. Welcome messages,
  member counts and `!user` name search use it.
- **Message Content** is optional, and is what Discord's intent review covers. Without
  it, the message log can't see text, the message count in user info is left out, chat
  features don't run, and message commands only work as `@ms robot user` instead of
  `!user`. The bot logs a warning at startup when it's off. Set
  `MESSAGE_CONTENT_INTENT=true` only after enabling it, or Discord refuses the
  connection.

Commands are slash commands, and the bot registers them itself on startup in every
server it's in. To keep it running, see [docs/operations.md](docs/operations.md)
(systemd, Docker, crash recovery).

## Commands

`/help` lists what each person can use.

| Area | Commands | Docs |
|---|---|---|
| Role panels | `/rolepanel` | [role-panels.md](docs/commands/role-panels.md) |
| Role hand-outs | `/addrole`, `/removerole`, `/roleconfig` | [role-commands.md](docs/commands/role-commands.md) |
| Message log | `/messagelog` | [message-log.md](docs/commands/message-log.md) |
| User info | `/userinfo`, `/threaduser`, `!user` | [user-info.md](docs/commands/user-info.md) |
| Settings | `/settings`, `/set`, `/config`, `/conf` | [settings.md](docs/commands/settings.md) |
| Chat features | `/reactions`, keyword replies, `!verification` | [chat-features.md](docs/commands/chat-features.md) |
| Fun | `/animal`, `/cat`, `/hug`, `/wink`, `/facepalm`, `/headpat`, `/joke`, `/define`, `/gif`, `/time`, `/movealong`, `/rejoice` | [fun.md](docs/commands/fun.md) |
| Utility | `/help`, `/ping`, `/stats`, `/botinfo`, `/mylevel`, `/timeout`, `/leave` | [utility.md](docs/commands/utility.md) |
| Bot admin | `/deploy`, `/reload`, `/reboot`, `/eval` | [admin.md](docs/commands/admin.md) |

## Development

```txt
npm test            offline, a few seconds
npm run test:live   also checks the outside APIs the fun commands use
```

See [docs/development.md](docs/development.md) for the project layout, adding commands
and buttons, the job queue, and how the tests work.

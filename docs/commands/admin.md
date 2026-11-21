# Bot admin commands

For the people running the bot. **Bot Owner** is the user ID in `OWNER` in `.env`;
**Bot Admin** is anyone in `admins` in `config.js`. These commands are also hidden from
server members without Administrator.

| Command | Who | What it does |
|---|---|---|
| `/deploy`, `!deploy` | Bot Owner | Re-register all slash commands with Discord |
| `/reload command:` | Bot Admin | Load a changed command file without restarting |
| `/reboot` | Bot Admin | Restart the bot (see [../operations.md](../operations.md)) |
| `/eval code:` | Bot Owner | Run JavaScript inside the bot. It can do anything the bot's process can. |
| `/conf` | Bot Admin | Bot-wide default settings, see [settings.md](settings.md) |

Slash commands are registered globally, so they work in every server the bot is in,
including ones it joins later, without a restart or deploy. They're compared with
Discord's copy and re-registered on every start and after every `/reload`, but only when
something changed. `/deploy` forces a re-register anyway. `!deploy` stays a message
command in case slash commands are ever missing; `@ms robot deploy` works without the
Message Content intent.

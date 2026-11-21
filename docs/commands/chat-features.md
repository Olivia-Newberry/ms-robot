# Chat features

These run on ordinary messages rather than commands (`commands/partialMessage.js`), so
they need the Message Content intent.

## Automatic reactions

| Reaction | Setting | Default |
|---|---|---|
| Reacts to messages mentioning "minecraft" | `/reactions minecraft chance:` 0–100% (0 turns it off) | 100% |
| Reacts to pictures posted in channels with "selfie" in the name | `/reactions selfies enabled:` | on |

The minecraft reaction is a chance so busy servers can keep the joke without a reaction
on every mention. Selfie reactions are on/off only: the point is that every selfie gets
one, to encourage posting and reacting.

`/reactions view` shows the current settings, and changing them needs Manage Server.
They're also on the Reactions page of `/settings`.

Both use custom emoji from one particular server. In other servers, the bot needs the
**Use External Emojis** permission, or the reaction quietly doesn't happen.

## Replies

- "ms robot test" / "anyone listening?" → "I'm listening!"
- "hi ms robot" → a greeting.
- `!verification` (only in server 438306949285806082, where that verification flow
  exists) → hands off to the verification bot, or points newcomers to the sticky message.

## Old prefix commands

Mentioning the bot with a command that became a slash command, e.g. `@ms robot dog`,
replies with what replaced it (`/animal kind:dog`). A plain `!dog` gets no reply, because
other bots share the `!` prefix and their commands shouldn't set this one off.

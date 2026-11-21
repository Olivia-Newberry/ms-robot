# Message log

`/messagelog` posts edited and deleted messages to a moderator channel. It's off until
someone with Manage Server turns it on.

```txt
/messagelog enable channel:#message-log
/messagelog ignore channel:#staff-chat     (a category works too; run again to undo)
/messagelog status
/messagelog disable
```

It can also be set up from `/settings` → Logging.

## What an entry shows

- **The user and their ID,** in the message text rather than the embed, so Discord
  search finds every entry for a user by ID.
- **The full message.** For edits, removed text is ~~struck through~~ and added text is
  __**bold and underlined**__, in place. Emoji changes are labelled `[+ 🙂]` / `[− 🙂]`,
  because strikethrough and underline don't show on emoji. Code blocks stay code blocks,
  and edits to them show as a line-by-line diff.
- **Long messages** continue into extra fields. Only when an edit is too big for one
  Discord message is unchanged text shortened, with the full before/after attached as a
  `.diff` file.
- **Deletes** also show attachment names and what the message was replying to.
- **Purges** come through as one entry with a transcript file.

Under each entry:

- **View context** shows the clicking moderator, privately, the messages around it in
  the channel. It's fetched when clicked, so it shows the channel as it is now. You need
  to be able to read the original channel.
- **Jump to message** opens the message, or where a deleted one used to be.

During a burst, entries that queue up behind Discord's rate limit are sent up to 5 per
message, numbered so each one's buttons are clear (`View context #2`). Nothing is
skipped. Bot and webhook messages aren't logged, and neither is anything in the log
channel itself.

## What's stored

Nothing beyond the log channel. Message text only lives in discord.js's in-memory cache
(the last 200 messages per channel), and in the job queue until an entry is posted.
Edits or deletes of messages older than the cache are still logged, without the original
text.

## Requirements

The Message Content intent; see the README's setup section.

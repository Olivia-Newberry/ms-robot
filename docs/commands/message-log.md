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
  __**bold and underlined**__, in place. Emoji changes and small punctuation changes (a
  full stop, `?!`) are labelled `[+ 🙂]` / `[− .]`, because strikethrough and underline
  don't show on emoji and are near invisible on a single character. Code blocks stay code blocks,
  and edits to them show as a line-by-line diff.
- **Long messages** continue into extra fields. Only when an edit is too big for one
  Discord message is unchanged text shortened, with the full before/after attached as a
  `.diff` file.
- **Deletes** also show attachment names and what the message was replying to. Deletes
  of messages too old to be cached are grouped into one summary per channel (see below).
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

Nothing beyond the log channel. Message text only lives in discord.js's in-memory cache,
and in the job queue until an entry is posted.

The original text of an edited or deleted message can only be shown if it's still in
that cache: Discord never sends the old text with an edit, and a deleted message can't be
fetched. So every channel keeps its last 200 messages, as the bot did for a year before
1.0, and a busy channel can hold up to 1,000 during a burst. There's no time limit. The
cache is only cut back when the server runs low on memory, or the cache passes a size
ceiling: burst extras go first, then the oldest messages anywhere, while every channel
keeps its newest 50.

After a restart the bot fetches recent messages again from every logged channel and
thread: the last 100 from ones active in the last 3 days, and the last 50 from quieter
ones (the most any cleanup leaves a channel with), since their newest messages are still
the likeliest to be edited or deleted. It's one request per
channel, done in the background, and every server's active channels are done before
any quiet ones, so busy channels are covered within moments of a restart even when
there are hundreds of quiet channels to get through afterwards.

The bot stays in every active thread it can see, so edits and deletes there are seen. It
joins threads when they're created or reopened, when it's given access to a channel
that has threads, at startup (for threads created while it was offline), and in a check
every 10 minutes for any it missed. Private threads it hasn't been added to can't be
joined, unless it has Manage Threads.

These numbers are `messageCache` in `config.js`; see
[operations.md](../operations.md) for the memory they cost.

Deletes of messages older than the cache, such as a bot clearing out months-old
messages one at a time, have no author or text to show. Instead of an entry each, they're
counted per channel and posted as one summary once the deletes stop for 5 minutes:
"**Deleted** 37 older messages in #channel, sent between 3 Sep and 5 Sep". A summary
still waiting when the bot shuts down is saved and posted after the restart. Edits or deletes of anything older are
still logged, without the original text. These numbers are `messageCache` in
`config.js`; see [operations.md](../operations.md) for the memory they cost.

## Requirements

The Message Content intent; see the README's setup section.

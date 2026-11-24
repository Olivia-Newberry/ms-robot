# User info

| Command | What it does |
|---|---|
| `/userinfo [user] [id]` | Info about a user, or yourself. `id` works for people who've left. |
| `/threaduser` | In a mod thread: the user the thread is about |
| `!user` (also `!threaduser`, `!userinfo`) | Both of the above as a message command |

The info shows:

- the user and their ID (in its own field, so it can be long-pressed to copy on mobile),
- their permission level,
- nickname, join date and account age,
- roles,
- **messages sent** in the server.

## People who aren't in the server

Members of the server always come first. Someone who isn't a member can still be looked
up by ID or mention (`/userinfo id:`, `!user 123…`), and the reply says clearly that
they're **not a member of this server**. It shows:

- their public profile (username, ID, avatar, account age), which Discord gives any bot,
- whether they're banned from this server, and the ban reason,
- how many messages they sent in this server.

`!user name` looks through current members first; if none match, it searches this
server's ban list, and lists the matches by ID if there are several.

Other servers the bot is in are never searched or mentioned. Discord's Developer Policy
restricts using one server's data to track people across servers, and those communities
haven't agreed to share their member lists. Ban details need the bot to have **Ban
Members**; without it they're left out.

## !user

Kept as a message command because moderators use it from habit:

```txt
!user @someone | !user 123456789012345678 | !user name#1234 | !user name
!user            in a mod thread: the thread's user; anywhere else: yourself
```

In a mod thread it also posts `Thread userID = …` and `Tag = <@…>`, which pings that
user as it always has.

A mod thread is a channel under a category with "thread" or "ticket" in its name (e.g.
"Mod Tickets"). The member's ID is read from the first message, skipping one from the
modmail bot that posts first in some threads.

Without the Message Content intent, use it as `@ms robot user …`.

## Message count

Comes from Discord's message search.

- It needs the Message Content intent and Read Message History. Without them the field is
  left out.
- The first time a server is searched, Discord builds an index and the count says
  "still indexing".
- Discord says the total can be slightly off while messages are actively being sent or
  deleted.

# Server settings

| Command | Who | What it does |
|---|---|---|
| `/settings` | Administrator level, Manage Server to see it | Menu for browsing and editing settings |
| `/set` | Administrator level, Manage Server to see it | Change one setting by typing it |
| `/config` | Moderator level and up | Read-only view of every setting |
| `/conf` | Bot Admin | Change the bot-wide defaults every server falls back on |

The Moderator and Administrator levels come from the `modRole` and `adminRole` settings:
members with any of the listed roles have that level.

Role settings store a comma-separated list of role IDs, so which roles count is pinned
down even when "Verified", "verified" and "vҽrified" (Cyrillic ҽ) all exist. Older
versions stored a name, which counted every role with that name in any capitals. At
startup, and when the bot joins a server, such names are converted to the IDs of exactly
those roles, so the same roles keep counting. A name that matches no role is left as it
is and still works if the role is created later.

## /settings

Opens a private panel, one topic per page: General, Roles, Welcome, Logging, Reactions,
plus "Other" for custom keys added with `/conf`. Move between pages with the menu or the
arrows.

**Edit** opens a form filled in with the current values:

- checkboxes for on/off settings, and dropdowns for settings with fixed choices,
- channel and role pickers for channels and roles (role settings can hold several),
- text boxes for the rest.

Clearing a text box or picker puts that setting back to its default, or turns the
feature off where the field says so. A value that doesn't fit is refused with a note,
and the other fields in the form still save.

Only the person who opened a panel can use it, and their permission is checked again on
every click.

## /set

```txt
/set view
/set get   key:prefix
/set edit  key:selfieReact value:false
/set edit  key:modRole     value:@Mods, @Helpers   (mentions or IDs, comma-separated; a
                                                  name adds every role with that name in
                                                  any capitals)
/set reset key:prefix          (asks for confirmation with a button)
```

Keys autocomplete. Values are checked the same way as in `/settings`, so a typo like
`ture` is refused instead of silently breaking the feature that reads it.

## /config

Shows every setting grouped like the `/settings` pages, plus the `/roleconfig` role
lists. Values that haven't been changed are marked *(default)*, and each line ends with
the setting's key so a moderator can tell an admin exactly what to change. The reply is
private, has no buttons, and its mentions never ping.

## /conf

Changes the defaults that every server uses until it sets its own value.

```txt
/conf view
/conf get    key:prefix
/conf edit   key:prefix value:!
/conf add    key:partyMode value:on
/conf delete key:partyMode     (removes it from every server; asks for confirmation)
```

Keys defined in `config.js` can't be deleted here, because they're put back on every
start; remove them from `config.js` instead.

## The settings

| Key | Meaning |
|---|---|
| `prefix` | Prefix for the remaining message commands |
| `commandReply` | Ping people when replying to their message commands |
| `systemNotice` | Explain when a command is refused |
| `selfTimeout` | Whether members can use `/timeout` on themselves |
| `modRole`, `adminRole` | Roles that give the Moderator / Administrator level |
| `verifiedRole` | Verified roles, or `false` if the server has none |
| `rolePanelAccess` | Who can set up role panels: `administrator` (default) or `moderator` |
| `welcomeEnabled`, `welcomeChannel`, `welcomeMessage` | Welcome messages; `{{user}}` is replaced with the new member |
| `modLogChannel` | Channel name where `/addrole` and `/removerole` are logged |
| `messageLogChannel`, `messageLogIgnore` | See [message-log.md](message-log.md) |
| `minecraftReactChance`, `selfieReact` | See [chat-features.md](chat-features.md) |

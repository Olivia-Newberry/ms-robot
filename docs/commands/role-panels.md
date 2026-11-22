# Role panels

A role panel is a message members use to give themselves roles.

Setting panels up needs the Administrator level (a role in the `adminRole` setting), or
the Moderator level and up if the server's `rolePanelAccess` setting is `moderator`. The
server owner and bot admins always can. Change it on the Roles page of `/settings`, or
with `/set edit key:rolePanelAccess value:moderator`. Moderators don't need Manage Roles
themselves; the bot makes the role changes.

```txt
/rolepanel create title:Colours style:Buttons mode:Pick one channel:#roles
/rolepanel add    panel:Colours role:@Red emoji:🔴
/rolepanel add    panel:Extras  role:@Artist label:Artists requires:@Level 10
/rolepanel edit   panel:Colours style:Emoji reactions
/rolepanel remove panel:Colours role:@Red
/rolepanel list
/rolepanel delete panel:Colours
```

## Options

- **Style:** buttons, or emoji reactions.
  - With buttons, members get a private reply saying what changed, or why they can't
    have a role.
  - Reactions can't reply privately, so a refusal takes the reaction back and explains
    by DM, if the member's DMs are open. Every role on a reaction panel needs an emoji.
- **Mode:**
  - *Pick one* swaps out the member's other role from that panel, e.g. colours or
    pronouns. On a reaction panel the old reaction is taken back too.
  - *Pick any* lets them hold several.
  - In both, picking a role you already have removes it.
- **Requires:** optionally, any role the member must already have. Losing it later
  doesn't remove anything.
- **Picking roles:** `role` and `requires` list roles with their member count and ID,
  flagged when another role's name looks the same; replies show the ID too.
- **Label and emoji:** the button text (the role name if left out) and its emoji. Custom
  emoji must come from a server the bot is in.

Discord allows 25 buttons or 20 reactions on one message.

## Which roles can go on a panel

These are refused when added, and again when someone picks them, in case a role changed
since:

- @everyone,
- roles managed by a bot or integration,
- roles at or above the bot's own highest role,
- roles with powerful permissions: Administrator, Manage Server, Manage Roles, Manage
  Channels, Kick/Ban, Timeout, Manage Messages and similar.

## Looking after panels

- Changing a panel edits its message in place. If the message was deleted, the next
  change posts it again.
- Switching style converts the message between buttons and reactions.
- Deleting a panel deletes its message but leaves people's roles alone.
- Reaction panels keep working after a restart, and don't need the Message Content
  intent.

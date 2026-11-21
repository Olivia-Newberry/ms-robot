# Role commands

`/addrole` and `/removerole` let chosen members hand out roles from a per-server list.
`/roleconfig` sets up that list, and needs Manage Roles. For roles members pick for
themselves, see [role-panels.md](role-panels.md).

```txt
/roleconfig managers   add role:@mods     confirm:iknowwhatimdoing
/roleconfig assignable add role:@verified confirm:iknowwhatimdoing
/roleconfig list
/addrole    user:@someone role:@verified
/removerole user:@someone role:@verified
```

- **`managers`** is who can use `/addrole` and `/removerole`.
- **`assignable`** is what they can hand out.

Roles are picked from the bot's own list rather than Discord's role picker. Each entry
shows the role's member count and ID, and is flagged "⚠ lookalike" when another role's
name looks the same ("Verified", "verified" and "vҽrified" with a Cyrillic letter all
look alike in Discord). `/addrole` and `/removerole` only list assignable roles. Replies
and the mod log show the role as a mention plus its ID, and adding a lookalike to a list
warns you.

Nothing works until both lists have something in them. The confirm word is only there so
the lists aren't changed by accident; it isn't a secret.

The bot needs Manage Roles too, and its own role has to sit above anything assignable, or
Discord won't let it. Changes are logged to the channel named in the `modLogChannel`
setting.

Two things to watch:

- Don't put a managers role in the assignable list, or managers can hand out access to
  the commands themselves.
- Anything assignable can go to anyone, even roles ranked above whoever ran the command,
  so keep it to harmless roles.

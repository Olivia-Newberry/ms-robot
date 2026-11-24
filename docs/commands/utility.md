# Utility commands

| Command | What it does |
|---|---|
| `/help` | Lists the commands you can use where you are |
| `/ping` | Response and API latency |
| `/stats` | Uptime, members (people and bots), servers, channels. Bot support, bot admins and the bot owner also see memory use and its limit, the message cache, the server's memory and uptime, and versions. |
| `/botinfo` | GitHub and invite links |
| `/mylevel` | Your permission level in this server |
| `/leave` | Removes you from the server, after a DM saying you can rejoin |
| `/timeout [duration]` | Times yourself out, e.g. to take a break (see below) |

`/stats` counts bots from each server's member list, which the bot downloads once at
startup and then keeps current. For a few seconds after a restart it shows only the
total, until that's done.

## /timeout

Members can time themselves out for 5 minutes to 7 days (10 minutes if left out). It
asks for confirmation first, because once applied only a moderator can end it early.
The audit log shows the reason as *"Self requested with /timeout for 10 minutes"*.

Discord doesn't allow timing out the server owner, members with Administrator, or
members whose highest role is at or above the bot's, and the bot needs the **Timeout
Members** permission; each case gets an explanation instead. Servers can turn it off with
the `selfTimeout` setting (General page of `/settings`).

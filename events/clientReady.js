// Named clientReady because discord.js 14 deprecated the "ready" event name; the file
// name is the event name (see index.js).
import { ActivityType, GatewayIntentBits } from "discord.js";
import config from "../config.js";
import { deployCommands, describeDeploy } from "../modules/deploy.js";
import { error, log, warn } from "../modules/Logger.js";
import { startJobs } from "../modules/jobs.js";
import { prepareGuild } from "../modules/guildSetup.js";
import { startCacheTrimming } from "../modules/messageCache.js";
import { startThreadSweep } from "../modules/threadJoin.js";
export default async client => {
  // Log that the bot is online.
  // The 0 start value keeps this from throwing when the bot isn't in any server yet.
  log(`${client.user.tag}, ready to serve ${client.guilds.cache.map(g => g.memberCount).reduce((a, b) => a + b, 0)} users in ${client.guilds.cache.size} servers.`, "ready");
  
  // Jobs start here rather than at load because they send through the client's channel
  // cache, which is only filled once the bot is ready.
  startJobs(client);

  // Shown as the bot's status so people know where to start.
  client.user.setActivity("/help", { type: ActivityType.Playing });

  // Without the intent Discord sends message text only when the bot is mentioned, so
  // "!user" silently does nothing while "@bot user" works. Said once here so it isn't
  // mistaken for broken commands.
  if (!client.options.intents.has(GatewayIntentBits.MessageContent)) {
    warn("Message Content intent is off: message commands only work as \"@bot command\", and the message log can't see text. Set MESSAGE_CONTENT_INTENT=true once it's enabled in the Developer Portal.");
  }

  // Keeps the message cache within its memory limits (messageCache in config.js).
  startCacheTrimming(client, log);
  // Joins any active thread the bot isn't in yet (see modules/threadJoin.js).
  startThreadSweep(client);

  // Per-server setup: role settings, member lists, recent messages (see guildSetup.js).
  // Servers unavailable right now, e.g. during a Discord outage, get it when they come
  // back (events/guildAvailable.js).
  for (const guild of client.guilds.cache.values()) prepareGuild(client, guild);

  if (!config.giphyApiKey) warn("GIPHY_API_KEY isn't set: /gif will say it isn't set up. Add a Giphy API key to .env to enable it.");

  // Not awaited so a slow or failing deploy doesn't hold up anything else; existing
  // commands keep working if it fails.
  deployCommands(client)
    .then(result => log(`Slash commands: ${describeDeploy(result)}`, "ready"))
    .catch(e => error(`Couldn't deploy slash commands: ${e.message}`));
};

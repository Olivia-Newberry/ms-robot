// A server is back after a Discord outage (see modules/guildSetup.js). If it was
// unavailable when the bot started, it missed the startup work, so it runs now.
import { log } from "../modules/Logger.js";
import { prepareGuild } from "../modules/guildSetup.js";

export default (client, guild) => {
  // While connecting, Discord lists every server as unavailable and then sends each one,
  // which discord.js also reports as "available". Those are handled by clientReady; only
  // a server returning after the bot is up is a real outage ending.
  if (!client.isReady?.()) return;
  log(`[GUILD AVAILABLE] ${guild.name} (${guild.id}) is available again.`);
  prepareGuild(client, guild);
};

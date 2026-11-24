import { log } from "../modules/Logger.js";
import { guildLeft } from "../modules/guildSetup.js";

// The bot was really removed from a server (kicked, or the server deleted). discord.js
// doesn't fire this for outages, and the availability check is a second safety net.
export default (client, guild) => {
  if (!guild.available) return;

  log(`[GUILD LEAVE] ${guild.id} removed the bot. Its settings and role panels are kept for 30 days in case it's re-added.`);
  guildLeft(guild);
};

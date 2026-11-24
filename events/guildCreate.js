import { log } from "../modules/Logger.js";
import { guildRejoined, prepareGuild } from "../modules/guildSetup.js";
// This event executes when a new guild (server) is joined. Not when one comes back after
// an outage; that's guildAvailable.

export default (client, guild) => {
  log(`[GUILD JOIN] ${guild.id} added the bot. Owner: ${guild.ownerId}`);
  // Re-added within 30 days of leaving: keep its settings and role panels.
  guildRejoined(guild);
  prepareGuild(client, guild);
};

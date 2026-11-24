// A server has gone unavailable, usually a Discord outage. discord.js keeps it and its
// data; nothing is deleted, and guildAvailable fires when it's back.
import { warn } from "../modules/Logger.js";

export default (client, guild) => {
  warn(`[GUILD UNAVAILABLE] ${guild.id} is unavailable, probably a Discord outage. It'll be picked up again when it's back.`);
};

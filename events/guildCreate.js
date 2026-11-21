import { log } from "../modules/Logger.js";
import { cacheMembers } from "../modules/memberCounts.js";
import { migrateRoleSettings } from "../modules/settingsUi.js";
// This event executes when a new guild (server) is joined.

export default (client, guild) => {
  log(`[GUILD JOIN] ${guild.id} added the bot. Owner: ${guild.ownerId}`);
  // So /stats can count this server's bots too (see modules/memberCounts.js).
  cacheMembers([guild]);
  // The defaults ("Moderator", "Administrator") are names; pin them to this server's roles.
  for (const change of migrateRoleSettings(guild)) log(`Role setting in ${guild.name}: ${change}`);
};

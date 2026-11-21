import { logBulkDelete } from "../modules/messageLog.js";
import { error } from "../modules/Logger.js";

// Handled separately because purges and bans with "delete message history" arrive as
// one bulk event, and logging each message would flood the log channel.
export default async (client, messages) => {
  try {
    logBulkDelete(messages);
  } catch (e) {
    error(`Bulk delete log failed: ${e.message}`);
  }
};

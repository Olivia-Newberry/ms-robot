import { logDelete } from "../modules/messageLog.js";
import { error } from "../modules/Logger.js";

// A logging failure is reported, never thrown, so it can't turn into an unhandled
// rejection on every delete.
export default async (client, message) => {
  try {
    logDelete(message);
  } catch (e) {
    error(`Message delete log failed: ${e.message}`);
  }
};

import { logEdit } from "../modules/messageLog.js";
import { error } from "../modules/Logger.js";

// Without the MESSAGE partial in config.js this wouldn't fire at all for uncached
// messages; with it, oldMessage arrives partial and the log says the original is unknown.
export default async (client, oldMessage, newMessage) => {
  try {
    // A partial new message has no text to diff, so it's fetched in full.
    if (newMessage.partial) newMessage = await newMessage.fetch();
    logEdit(oldMessage, newMessage);
  } catch (e) {
    error(`Message edit log failed: ${e.message}`);
  }
};

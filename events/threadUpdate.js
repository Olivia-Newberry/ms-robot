// An archived thread that's reopened may never have been joined, e.g. if it was created
// and archived while the bot was offline (modules/threadJoin.js).
import { joinThread } from "../modules/threadJoin.js";

export default (client, oldThread, newThread) => {
  if (oldThread.archived && !newThread.archived) return joinThread(newThread);
};

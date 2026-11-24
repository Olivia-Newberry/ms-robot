// New threads are joined straight away so the message log sees their messages
// (modules/threadJoin.js).
import { joinThread } from "../modules/threadJoin.js";

export default (client, thread) => joinThread(thread);

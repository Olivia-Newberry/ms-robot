// Sent when the bot gains access to a channel: its active threads arrive here rather
// than as threadCreate, so they're joined here (modules/threadJoin.js).
import { joinThreads } from "../modules/threadJoin.js";

export default (client, threads) => joinThreads(threads.values());

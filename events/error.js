import { log } from "../modules/Logger.js";
export default async (client, error) => {
  // JSON.stringify turns an Error into "{}", which hid every error this ever logged.
  log(`An error event was sent by Discord.js: \n${error?.stack ?? error}`, "error");
};

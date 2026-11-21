import { reactionCommand } from "../modules/fun.js";

export const { run, commandData, conf } = reactionCommand({
  name: "hug",
  description: "Give a hug",
  endpoint: "hug",
  replaces: ["hug"],
});

import { reactionCommand } from "../modules/fun.js";

export const { run, commandData, conf } = reactionCommand({
  name: "wink",
  description: "Give a wink",
  endpoint: "wink",
  replaces: ["wink"],
});

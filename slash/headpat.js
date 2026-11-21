import { reactionCommand } from "../modules/fun.js";

export const { run, commandData, conf } = reactionCommand({
  name: "headpat",
  description: "Give someone a headpat",
  endpoint: "pat",
  suffix: "**Have a pat on the head.**",
  replaces: ["headpat", "pat"],
});

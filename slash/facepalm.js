import { reactionCommand } from "../modules/fun.js";

export const { run, commandData, conf } = reactionCommand({
  name: "facepalm",
  description: "Palm your face",
  endpoint: "facepalm",
  replaces: ["facepalm", "palm"],
});

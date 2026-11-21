// Commands deploy themselves on startup (see modules/deploy.js), so this is only for
// forcing a re-register, e.g. after /reload changed a command's options. Kept as a
// message command in case slash commands are ever missing; "@bot deploy" works even
// without the Message Content intent.
import { deployCommands, describeDeploy } from "../modules/deploy.js";

export async function run(client, message, args, level) { // eslint-disable-line no-unused-vars
  await message.channel.send("Deploying commands!");
  await message.channel.send(describeDeploy(await deployCommands(client, { force: true })));
}

export const conf = {
  enabled: true,
  guildOnly: true,
  aliases: [],
  permLevel: "Bot Owner"
};

export const help = {
  name: "deploy",
  category: "System",
  description: "This will deploy all slash commands.",
  usage: "deploy"
};

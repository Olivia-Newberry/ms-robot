import { MessageFlags, PermissionFlagsBits } from "discord.js";
import { deployCommands, describeDeploy } from "../modules/deploy.js";

// Commands already deploy on startup; this forces it, e.g. after /reload changed a
// command's options.
export async function run(client, interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  await interaction.editReply(describeDeploy(await deployCommands(client, { force: true })));
}

export const commandData = {
  name: "deploy",
  description: "Re-register all slash commands.",
  defaultMemberPermissions: PermissionFlagsBits.Administrator,
  options: [],
};

export const conf = { permLevel: "Bot Owner", guildOnly: true, category: "System" };

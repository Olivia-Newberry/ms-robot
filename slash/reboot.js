import { MessageFlags, PermissionFlagsBits } from "discord.js";
import { shutdown } from "../modules/lifecycle.js";

export async function run(client, interaction) { // eslint-disable-line no-unused-vars
  await interaction.reply({ content: "Bot is shutting down.", flags: MessageFlags.Ephemeral });
  // Goes through shutdown() rather than exiting straight away so sends already under
  // way can finish. The service manager (systemd Restart=always, docker restart:
  // unless-stopped, or PM2) is what starts the bot again.
  await shutdown(0, "Reboot requested");
}

export const commandData = {
  name: "reboot",
  description: "Restart the bot.",
  defaultMemberPermissions: PermissionFlagsBits.Administrator,
  options: [],
};

export const conf = { permLevel: "Bot Admin", guildOnly: true, category: "System", replaces: ["reboot", "restart"] };

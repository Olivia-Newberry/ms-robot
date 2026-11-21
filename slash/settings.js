import { MessageFlags, PermissionFlagsBits } from "discord.js";
import { buildPanel } from "../modules/settingsPanel.js";

export async function run(client, interaction) { // eslint-disable-line no-unused-vars
  await interaction.reply({ ...buildPanel(interaction.guild, interaction.user.id, 0), flags: MessageFlags.Ephemeral });
}

export const commandData = {
  name: "settings",
  description: "Browse and edit this server's settings.",
  defaultMemberPermissions: PermissionFlagsBits.ManageGuild,
  options: [],
};

export const conf = {
  permLevel: "Administrator",
  guildOnly: true,
  category: "System",
  replaces: { settings: "/settings", setting: "/settings" },
};

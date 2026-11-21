import { MessageFlags } from "discord.js";
import config from "../config.js";
import { permlevel } from "../modules/functions.js";

export async function run(client, interaction) { // eslint-disable-line no-unused-vars
  const level = permlevel(interaction);
  const embed = {
    title: "Permission Level",
    description: `Your permission level is: ${level} - ${config.permLevels.find(l => l.level === level).name}`,
    fields: [],
  };
  if (process.env.NODE_ENV === "test" || interaction.user.id === process.env.OWNER) {
    embed.fields.push({ name: "Debugging Info", value: `Guild ID: ${interaction.guildId}\nUser ID: ${interaction.user.id}` });
  }
  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

export const commandData = { name: "mylevel", description: "Tells you your permission level here", options: [] };

export const conf = { permLevel: "User", guildOnly: true, category: "Miscellaneous", replaces: ["mylevel"] };

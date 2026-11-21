import { animalEmbed } from "../modules/fun.js";

export async function run(client, interaction) { // eslint-disable-line no-unused-vars
  await interaction.deferReply();
  await interaction.editReply({ embeds: [await animalEmbed("cat")] });
}

export const commandData = {
  name: "cat",
  description: "Grab a random cat fact and cute picture",
  options: [],
};

export const conf = {
  permLevel: "User",
  guildOnly: true,
  category: "Fun",
  replaces: ["cat"],
};

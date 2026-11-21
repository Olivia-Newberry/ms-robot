import { ApplicationCommandOptionType } from "discord.js";
import { ANIMAL_KINDS, animalEmbed } from "../modules/fun.js";

// One command with a choice instead of a command per animal, which keeps the slash
// command list readable. /cat stays separate because people already use it.
export async function run(client, interaction) { // eslint-disable-line no-unused-vars
  await interaction.deferReply();
  await interaction.editReply({ embeds: [await animalEmbed(interaction.options.getString("kind"))] });
}

export const commandData = {
  name: "animal",
  description: "Grab a random animal picture (and a fact, where there is one)",
  options: [{
    name: "kind", description: "Which animal", type: ApplicationCommandOptionType.String, required: true,
    choices: ANIMAL_KINDS.map(name => ({ name, value: name })),
  }],
};

export const conf = {
  permLevel: "User",
  guildOnly: false,
  category: "Fun",
  replaces: { dog: "/animal kind:dog", fox: "/animal kind:fox" },
};

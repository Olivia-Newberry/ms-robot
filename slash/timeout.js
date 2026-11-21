// /timeout: time yourself out (see modules/selfTimeout.js). Asks first, because once
// it's applied only a moderator can lift it.

import { ActionRowBuilder, ApplicationCommandOptionType, ButtonBuilder, ButtonStyle, MessageFlags } from "discord.js";
import { componentId } from "../modules/components.js";
import { DEFAULT_MINUTES, DURATIONS, describeDuration, timeoutProblem } from "../modules/selfTimeout.js";

export async function run(client, interaction) { // eslint-disable-line no-unused-vars
  const minutes = interaction.options.getInteger("duration") ?? DEFAULT_MINUTES;
  const problem = timeoutProblem(interaction.member, interaction.settings);
  if (problem) return interaction.reply({ content: problem, flags: MessageFlags.Ephemeral });

  const until = Math.floor((Date.now() + minutes * 60_000) / 1000);
  await interaction.reply({
    content: `Time yourself out for **${describeDuration(minutes)}**, until <t:${until}:t>? You won't be able to send messages, react or talk in voice, and only a moderator can end it early.`,
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(componentId("selftimeout", interaction.user.id, minutes)).setLabel(`Time me out for ${describeDuration(minutes)}`).setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(componentId("selftimeout", interaction.user.id, 0)).setLabel("Cancel").setStyle(ButtonStyle.Secondary),
    )],
    flags: MessageFlags.Ephemeral,
  });
}

export const commandData = {
  name: "timeout",
  description: "Time yourself out for a while (only a moderator can end it early).",
  options: [{
    name: "duration", description: `How long (${describeDuration(DEFAULT_MINUTES)} if left out)`, type: ApplicationCommandOptionType.Integer, required: false,
    choices: DURATIONS.map(minutes => ({ name: describeDuration(minutes), value: minutes })),
  }],
};

export const conf = { permLevel: "User", guildOnly: true, category: "Miscellaneous" };

// Confirm/cancel buttons for /timeout: selftimeout:<userId>:<minutes>, 0 meaning cancel.

import { MessageFlags } from "discord.js";
import { auditReason, DURATIONS, describeDuration, timeoutProblem } from "../modules/selfTimeout.js";

export const prefix = "selftimeout";
export const conf = { guildOnly: true };

export async function run(client, interaction, [userId, minutesText]) {
  // The reply is private, but a self-timeout must only ever apply to the person who asked.
  if (interaction.user.id !== userId) return interaction.reply({ content: "This isn't your timeout.", flags: MessageFlags.Ephemeral });
  const minutes = Number(minutesText);
  if (!minutes) return interaction.update({ content: "Cancelled, you haven't been timed out.", components: [] });
  if (!DURATIONS.includes(minutes)) return interaction.update({ content: "That isn't a duration /timeout offers.", components: [] });

  // Checked again: the setting or their roles may have changed since they ran /timeout.
  const problem = timeoutProblem(interaction.member, interaction.settings);
  if (problem) return interaction.update({ content: problem, components: [] });

  await interaction.member.timeout(minutes * 60_000, auditReason(minutes));
  const until = Math.floor((Date.now() + minutes * 60_000) / 1000);
  return interaction.update({ content: `You're timed out for ${describeDuration(minutes)}, until <t:${until}:t>. Take care!`, components: [] });
}

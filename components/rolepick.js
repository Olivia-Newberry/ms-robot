// Role panel buttons: rolepick:<panelId>:<roleId>. See modules/rolePanels.js.

import { MessageFlags } from "discord.js";
import { getPanel, pick, PICK } from "../modules/rolePanels.js";

export const prefix = PICK;
export const conf = { guildOnly: true };

export async function run(client, interaction, [panelId, roleId]) {
  const panel = getPanel(panelId);
  if (!panel) return interaction.reply({ content: "This role panel has been deleted.", flags: MessageFlags.Ephemeral });
  const { text } = await pick(interaction.member, panel, roleId);
  // Private, so a busy panel doesn't fill the channel with "added @role" messages.
  await interaction.reply({ content: text, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
}

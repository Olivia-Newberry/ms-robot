// Confirmation buttons for /set reset and /conf delete.
//
//   settings:<reset|delete|cancel>:<userId>:<key>

import { MessageFlags } from "discord.js";
import { permlevel } from "../modules/functions.js";
import { deleteDefaultKey, saveOverride } from "../modules/settingsUi.js";

export const prefix = "settings";
export const conf = { guildOnly: true };

// Same levels as the commands that made the buttons. Checked again on click because
// the buttons stay usable after someone's roles change.
const NEEDS = { reset: "Administrator", delete: "Bot Admin" };

export async function run(client, interaction, [action, userId, key]) {
  if (interaction.user.id !== userId) {
    return interaction.reply({ content: "Only the person who ran the command can use these buttons.", flags: MessageFlags.Ephemeral });
  }
  const done = (content) => interaction.update({ content, components: [] });
  if (action === "cancel") return done("Cancelled, nothing was changed.");
  if (!(action in NEEDS)) return done("This button no longer does anything.");
  if (permlevel(interaction) < client.container.levelCache[NEEDS[action]]) return done("You no longer have permission to do that.");

  if (action === "reset") {
    saveOverride(interaction.guildId, key, undefined);
    return done(`\`${key}\` was successfully reset to default.`);
  }
  deleteDefaultKey(key);
  return done(`\`${key}\` was successfully deleted.`);
}

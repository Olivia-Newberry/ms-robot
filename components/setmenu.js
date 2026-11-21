// Buttons, menu and form of the /settings panel (modules/settingsPanel.js).

import { MessageFlags } from "discord.js";
import { permlevel } from "../modules/functions.js";
import { buildForm, buildPanel, saveForm } from "../modules/settingsPanel.js";

export { PREFIX as prefix } from "../modules/settingsPanel.js";
export const conf = { guildOnly: true };

export async function run(client, interaction, [action, userId, page]) {
  // The panel is private, but its buttons can still be reached through a forwarded or
  // stale message, so the owner check stays.
  if (interaction.user.id !== userId) {
    return interaction.reply({ content: "Open your own panel with /settings.", flags: MessageFlags.Ephemeral });
  }
  // Same level as /settings. Checked on every click because the panel stays usable
  // after someone's roles change.
  if (permlevel(interaction) < client.container.levelCache[client.container.slashcmds.get("settings").conf.permLevel]) {
    return interaction.update({ content: "You no longer have permission to change settings.", embeds: [], components: [] });
  }

  switch (action) {
    case "page":
      return interaction.update(buildPanel(interaction.guild, userId, page));
    case "jump":
      return interaction.update(buildPanel(interaction.guild, userId, interaction.values[0]));
    case "edit":
      // A form has to be the first response to a click, so it can't be deferred.
      return interaction.showModal(buildForm(interaction.guild, userId, page));
    case "save": {
      const notice = saveForm(interaction.guild, interaction.fields);
      return interaction.update(buildPanel(interaction.guild, userId, page, notice));
    }
  }
}

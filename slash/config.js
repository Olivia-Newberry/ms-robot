// Read-only view of this server's settings for moderators. Changing them stays with
// admins (/settings, /set); moderators still need to see them, e.g. to check which
// channel the message log goes to, which /set view used to show them.

import { MessageFlags } from "discord.js";
import { idList } from "../modules/roleTools.js";
import { describe, display, pagesFor } from "../modules/settingsSchema.js";
import { overridesFor } from "../modules/settingsUi.js";

// Set with /roleconfig rather than /set, so they aren't settings pages of their own.
const ROLE_LISTS = { roleManagerRoles: "Can use /addrole and /removerole", assignableRoles: "Can be handed out" };

export async function run(client, interaction) { // eslint-disable-line no-unused-vars
  const current = interaction.settings;
  const overridden = overridesFor(interaction.guildId);
  const keys = Object.keys(current).filter(k => !(k in ROLE_LISTS));

  const fields = pagesFor(keys).map(({ title, keys: pageKeys }) => ({
    name: title,
    value: pageKeys.map(key => `${describe(key).label}: ${display(key, current[key])}${key in overridden ? "" : " *(default)*"} · \`${key}\``).join("\n").slice(0, 1024),
  }));

  const roles = (key) => {
    const ids = idList(current[key]);
    return ids.length ? ids.map(id => `<@&${id}>`).join(" ") : "*none*";
  };
  fields.push({ name: "Role commands", value: Object.entries(ROLE_LISTS).map(([key, label]) => `${label}: ${roles(key)}`).join("\n") });

  await interaction.reply({
    embeds: [{
      title: `Settings for ${interaction.guild.name}`,
      description: "Read-only. Admins can change these with /settings.",
      color: 0x5865f2,
      fields,
    }],
    flags: MessageFlags.Ephemeral,
    // Shown as mentions to be readable, never to ping.
    allowedMentions: { parse: [] },
  });
}

export const commandData = { name: "config", description: "Show this server's settings (read-only).", options: [] };

export const conf = { permLevel: "Moderator", guildOnly: true, category: "Moderation" };

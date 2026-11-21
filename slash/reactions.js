// Per-server switches for the automatic reactions in commands/partialMessage.js.
// They're ordinary settings, so /set shows them too; this command exists to give them
// a 0-100 number field and an on/off choice instead of free text.

import { ApplicationCommandOptionType, MessageFlags, PermissionFlagsBits } from "discord.js";
import { saveOverride } from "../modules/settingsUi.js";

export async function run(client, interaction) { // eslint-disable-line no-unused-vars
  const reply = (content) => interaction.reply({ content, flags: MessageFlags.Ephemeral });
  if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild))
    return reply("You need the **Manage Server** permission to change this.");

  const { minecraftReactChance, selfieReact } = interaction.settings;
  switch (interaction.options.getSubcommand()) {
    case "view":
      return reply(`**Minecraft reactions:** ${minecraftReactChance}% of messages\n**Selfie reactions:** ${selfieReact === "false" ? "off" : "on"}`);
    case "minecraft": {
      const chance = interaction.options.getInteger("chance");
      saveOverride(interaction.guildId, "minecraftReactChance", String(chance));
      return reply(chance === 0 ? "Minecraft reactions are off." : `The bot will react to ${chance}% of messages mentioning minecraft.`);
    }
    case "selfies": {
      const enabled = interaction.options.getBoolean("enabled");
      saveOverride(interaction.guildId, "selfieReact", String(enabled));
      return reply(`Selfie reactions are ${enabled ? "on" : "off"}.`);
    }
  }
}

export const commandData = {
  name: "reactions",
  description: "Choose how often the bot reacts to messages in this server.",
  defaultMemberPermissions: PermissionFlagsBits.ManageGuild,
  options: [
    { name: "view", description: "Show the current settings", type: ApplicationCommandOptionType.Subcommand },
    {
      name: "minecraft", description: "How often to react to messages mentioning minecraft", type: ApplicationCommandOptionType.Subcommand,
      options: [{ name: "chance", description: "Percent of messages, 0 to turn it off", type: ApplicationCommandOptionType.Integer, required: true, minValue: 0, maxValue: 100 }],
    },
    {
      name: "selfies", description: "React to pictures posted in selfie channels", type: ApplicationCommandOptionType.Subcommand,
      options: [{ name: "enabled", description: "On or off", type: ApplicationCommandOptionType.Boolean, required: true }],
    },
  ],
};

export const conf = { permLevel: "User", guildOnly: true, category: "Fun" };

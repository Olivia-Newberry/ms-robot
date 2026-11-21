import { ApplicationCommandOptionType, MessageFlags, PermissionFlagsBits } from "discord.js";
import { normalize } from "../modules/settingsSchema.js";
import { confirmButtons, defaults, overridesFor, saveOverride, suggestKeys, table } from "../modules/settingsUi.js";

export async function run(client, interaction) { // eslint-disable-line no-unused-vars
  const reply = (content, extra = {}) => interaction.reply({ content, flags: MessageFlags.Ephemeral, ...extra });
  const current = interaction.settings;
  const key = interaction.options.getString("key");
  if (key && !(key in defaults())) return reply(`\`${key}\` isn't a setting. Pick one from the list.`);

  switch (interaction.options.getSubcommand()) {
    case "view":
      return reply(table("Current Guild Settings", current));
    case "get": {
      const isDefault = key in overridesFor(interaction.guildId) ? "" : "\nThis is the global default value.";
      return reply(`The value of \`${key}\` is currently \`${current[key]}\`${isDefault}`);
    }
    case "edit": {
      // Same checks as the /settings form, so both reject the same typos.
      const { value, error } = normalize(key, interaction.options.getString("value"), interaction.guild);
      if (error) return reply(`\`${key}\` ${error}.`);
      if (value === current[key]) return reply("This setting already has that value!");
      saveOverride(interaction.guildId, key, value);
      return reply(`\`${key}\` successfully edited to \`${value}\``);
    }
    case "reset":
      if (!(key in overridesFor(interaction.guildId))) return reply("This key does not have an override and is already using defaults.");
      return reply(`Are you sure you want to reset \`${key}\` to the default value?`, {
        components: confirmButtons("reset", interaction.user.id, key, "Reset"),
      });
  }
}

export const autocomplete = (client, interaction) => suggestKeys(interaction);

const keyOption = { name: "key", description: "The setting", type: ApplicationCommandOptionType.String, required: true, autocomplete: true };

export const commandData = {
  name: "set",
  description: "Change one server setting directly. /settings has a menu.",
  defaultMemberPermissions: PermissionFlagsBits.ManageGuild,
  options: [
    { name: "view", description: "Show every setting", type: ApplicationCommandOptionType.Subcommand },
    { name: "get", description: "Show one setting", type: ApplicationCommandOptionType.Subcommand, options: [keyOption] },
    {
      name: "edit", description: "Change a setting", type: ApplicationCommandOptionType.Subcommand,
      options: [keyOption, { name: "value", description: "The new value", type: ApplicationCommandOptionType.String, required: true, maxLength: 1000 }],
    },
    { name: "reset", description: "Put a setting back to the default", type: ApplicationCommandOptionType.Subcommand, options: [keyOption] },
  ],
};

export const conf = {
  permLevel: "Administrator",
  guildOnly: true,
  category: "System",
  replaces: { set: "/set" },
};

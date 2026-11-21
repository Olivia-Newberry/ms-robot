// Changes the bot-wide defaults that every server falls back on. Per-server settings
// are /set.

import { ApplicationCommandOptionType, MessageFlags, PermissionFlagsBits } from "discord.js";
import config from "../config.js";
import { confirmButtons, defaults, suggestKeys, table } from "../modules/settingsUi.js";
import { settings } from "../modules/settings.js";

export async function run(client, interaction) { // eslint-disable-line no-unused-vars
  const reply = (content, extra = {}) => interaction.reply({ content, flags: MessageFlags.Ephemeral, ...extra });
  const all = defaults();
  const key = interaction.options.getString("key");
  const value = interaction.options.getString("value");
  const sub = interaction.options.getSubcommand();
  if (key && sub !== "add" && !(key in all)) return reply(`\`${key}\` isn't a setting. Pick one from the list.`);

  switch (sub) {
    case "view":
      return reply(table("Bot Default Settings", all));
    case "get":
      return reply(`The value of \`${key}\` is currently \`${all[key]}\``);
    case "add":
      if (key in all) return reply("This key already exists in the default settings");
      // ":" would break the confirmation buttons, which carry the key in their ID.
      if (!/^[\w-]+$/.test(key)) return reply("Keys can only use letters, numbers, - and _.");
      settings.set("default", { ...all, [key]: value });
      return reply(`\`${key}\` successfully added with the value of \`${value}\``);
    case "edit":
      settings.set("default", { ...all, [key]: value });
      return reply(`\`${key}\` successfully edited to \`${value}\``);
    case "delete":
      // Keys in config.js are put back on every start, so deleting one here wouldn't stick.
      if (key in config.defaultSettings) return reply(`\`${key}\` is defined in config.js; remove it there instead.`);
      return reply(`Are you sure you want to permanently delete \`${key}\` from all servers? This **can't** be undone.`, {
        components: confirmButtons("delete", interaction.user.id, key, "Delete"),
      });
  }
}

export const autocomplete = (client, interaction) => suggestKeys(interaction);

const keyOption = { name: "key", description: "The setting", type: ApplicationCommandOptionType.String, required: true, autocomplete: true };
const valueOption = { name: "value", description: "The value", type: ApplicationCommandOptionType.String, required: true, maxLength: 1000 };

export const commandData = {
  name: "conf",
  description: "View or change the bot-wide default settings.",
  defaultMemberPermissions: PermissionFlagsBits.Administrator,
  options: [
    { name: "view", description: "Show every default", type: ApplicationCommandOptionType.Subcommand },
    { name: "get", description: "Show one default", type: ApplicationCommandOptionType.Subcommand, options: [keyOption] },
    { name: "edit", description: "Change a default", type: ApplicationCommandOptionType.Subcommand, options: [keyOption, valueOption] },
    {
      name: "add", description: "Add a new setting for every server", type: ApplicationCommandOptionType.Subcommand,
      options: [{ name: "key", description: "Name of the new setting", type: ApplicationCommandOptionType.String, required: true, maxLength: 50 }, valueOption],
    },
    { name: "delete", description: "Remove a setting from every server", type: ApplicationCommandOptionType.Subcommand, options: [keyOption] },
  ],
};

export const conf = {
  permLevel: "Bot Admin",
  guildOnly: true,
  category: "System",
  replaces: { conf: "/conf", defaults: "/conf" },
};

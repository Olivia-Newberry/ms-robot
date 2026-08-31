import { defaultSettings } from "../config.js";
import { settings } from "../modules/settings.js";

export async function run(client, message, args, level) { // eslint-disable-line no-unused-vars
  // Grab the container from the client to reduce line length.
  const { container } = client;
  const replying = settings.ensure(message.guild.id, defaultSettings).commandReply;
  if (!args || args.length < 1) return message.reply("Must provide a command name to reload.");
  const command = container.commands.get(args[0]) || container.commands.get(container.aliases.get(args[0]));
  // Check if the command exists and is valid
  if (!command) {
    return message.reply("That command does not exist");
  }
  // the path is relative to the *current folder*, so just ./filename.js
  try {
    // reimport and replace cache
    const commandPath = `./${command.help.name}.js`;
    const imported = await import(`${commandPath}?update=${Date.now()}`);

    // Assign the new properties (supporting both named exports and default exports)
    const props = imported.default || imported;
    container.commands.delete(command.help.name);
    container.commands.set(command.help.name, props);

    message.reply({
      content: `The command \`${command.help.name}\` has been reloaded`,
      allowedMentions: { repliedUser: (replying === "true") }
    });
  } catch (error) {
    message.reply(`Error reloading command \`${command.help.name}\`: \`${error.message}\``);
  }
}

export const conf = {
  enabled: true,
  guildOnly: false,
  aliases: ["update"],
  permLevel: "Bot Admin"
};

export const help = {
  name: "reload",
  category: "System",
  description: "Reloads a command that\"s been modified.",
  usage: "reload [command]"
};
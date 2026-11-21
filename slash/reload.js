// Re-imports a command's file so a change takes effect without a restart. Discord holds
// slash commands' names, options and descriptions, so after reloading one, those are
// compared with Discord's copy and re-registered if they changed.

import { ApplicationCommandOptionType, MessageFlags, PermissionFlagsBits } from "discord.js";
import { deployCommands, describeDeploy } from "../modules/deploy.js";

export async function run(client, interaction) {
  const { container } = client;
  const name = interaction.options.getString("command");
  const entry = container.files.get(name);
  if (!entry) return interaction.reply({ content: "That command does not exist", flags: MessageFlags.Ephemeral });

  try {
    // The query string makes Node load a fresh copy instead of its cached module.
    const fresh = await import(`${entry.url}?update=${Date.now()}`);
    if (entry.kind !== "slash") {
      container.commands.set(fresh.help.name, fresh);
      return interaction.reply({ content: `The command \`${name}\` has been reloaded`, flags: MessageFlags.Ephemeral });
    }
    // Renaming a command would otherwise leave the old name registered too.
    if (fresh.commandData.name !== name) container.slashcmds.delete(name);
    container.slashcmds.set(fresh.commandData.name, fresh);
    container.files.set(fresh.commandData.name, entry);
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const deployed = await deployCommands(client).then(
      result => `Slash commands: ${describeDeploy(result)}`,
      e => `Re-registering it with Discord failed (${e.message}); try /deploy.`,
    );
    await interaction.editReply(`The command \`${name}\` has been reloaded. ${deployed}`);
  } catch (error) {
    const send = interaction.deferred ? interaction.editReply.bind(interaction) : (p) => interaction.reply({ ...p, flags: MessageFlags.Ephemeral });
    await send({ content: `Error reloading command \`${name}\`: \`${error.message}\`` });
  }
}

export async function autocomplete(client, interaction) {
  const typed = interaction.options.getFocused().toLowerCase();
  const names = [...client.container.files.keys()].filter(n => n.toLowerCase().includes(typed)).slice(0, 25);
  await interaction.respond(names.map(n => ({ name: n, value: n })));
}

export const commandData = {
  name: "reload",
  description: "Reload a command that's been modified.",
  defaultMemberPermissions: PermissionFlagsBits.Administrator,
  options: [{ name: "command", description: "The command", type: ApplicationCommandOptionType.String, required: true, autocomplete: true }],
};

export const conf = { permLevel: "Bot Admin", guildOnly: true, category: "System", replaces: ["reload", "update"] };

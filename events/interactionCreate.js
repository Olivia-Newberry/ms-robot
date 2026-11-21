import { MessageFlags } from "discord.js";
import { log } from "../modules/Logger.js";
import { getSettings, permlevel } from "../modules/functions.js";
import { permLevels } from "../config.js";
import { parseComponentId } from "../modules/components.js";

// Buttons, select menus and modals. See modules/components.js.
async function runComponent(client, interaction) {
  const { prefix, args } = parseComponentId(interaction.customId);
  const handler = client.container.components.get(prefix);
  // Every interaction needs a reply, or Discord shows the clicker "interaction failed".
  if (!handler) {
    return interaction.reply({ content: "This button no longer does anything.", flags: MessageFlags.Ephemeral });
  }
  if (handler.conf?.guildOnly && !interaction.guild) {
    return interaction.reply({ content: "This only works in a server.", flags: MessageFlags.Ephemeral });
  }
  // Handlers can rely on interaction.settings the same way commands do.
  interaction.settings = getSettings(interaction.guild);
  try {
    await handler.run(client, interaction, args);
  } catch (e) {
    console.error(e);
    const reply = { content: "Something went wrong handling that.", flags: MessageFlags.Ephemeral };
    const send = interaction.replied || interaction.deferred ? interaction.followUp(reply) : interaction.reply(reply);
    await send.catch(err => console.error("An error occurred replying on an error", err));
  }
}

export default async (client, interaction) => {
  if (interaction.isMessageComponent() || interaction.isModalSubmit()) return runComponent(client, interaction);

  // Suggestions are only text, so they skip the permission check; the command itself
  // still checks when it's run.
  if (interaction.isAutocomplete()) {
    interaction.settings = getSettings(interaction.guild);
    const cmd = client.container.slashcmds.get(interaction.commandName);
    return cmd?.autocomplete?.(client, interaction).catch(e => console.error("Autocomplete failed", e));
  }

  // If it's not a command, stop.
  if (!interaction.isChatInputCommand()) return;

  // Grab the settings for this server from Enmap.
  // If there is no guild, get default conf (DMs)
  const settings = interaction.settings = getSettings(interaction.guild);

  // Get the user or member's permission level from the elevation
  const level = permlevel(interaction);
  
  // Grab the command data from the client.container.slashcmds Collection
  const cmd = client.container.slashcmds.get(interaction.commandName);
  
  // If that command doesn't exist, silently exit and do nothing
  if (!cmd) return;

  // Since the permission system from Discord is rather limited in regarding to
  // Slash Commands, we'll just utilise our permission checker.
  if (level < client.container.levelCache[cmd.conf.permLevel]) {
    // Due to the nature of interactions we **must** respond to them otherwise
    // they will error out because we didn't respond to them.
    return await interaction.reply({
      content: `This command can only be used by ${cmd.conf.permLevel}'s only`,
      // This will basically set the ephemeral response to either announce
      // to everyone, or just the command executioner. But we **HAVE** to 
      // respond.
      flags: settings.systemNotice !== "true" ? MessageFlags.Ephemeral : undefined
    });
  }

  // If everything checks out, run the command
  try {
    await cmd.run(client, interaction);
    log(`${permLevels.find(l => l.level === level).name} ${interaction.user.id} ran slash command ${interaction.commandName}`, "cmd");

  } catch (e) {
    console.error(e);
    if (interaction.replied) 
      interaction.followUp({ content: `There was a problem with your request.\n\`\`\`${e.message}\`\`\``, flags: MessageFlags.Ephemeral })
        .catch(e => console.error("An error occurred following up on an error", e));
    else 
    if (interaction.deferred)
      interaction.editReply({ content: `There was a problem with your request.\n\`\`\`${e.message}\`\`\`` })
        .catch(e => console.error("An error occurred following up on an error", e));
    else 
      interaction.reply({ content: `There was a problem with your request.\n\`\`\`${e.message}\`\`\``, flags: MessageFlags.Ephemeral })
        .catch(e => console.error("An error occurred replying on an error", e));
  }
};

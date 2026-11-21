// Sets up message edit/delete logging (see modules/messageLog.js).
//
//   /messagelog enable  channel:<channel>
//   /messagelog disable
//   /messagelog ignore  channel:<channel or category>   (toggles)
//   /messagelog status
//
// Off until someone with Manage Server turns it on. Uses the Discord permission rather
// than conf.permLevel for the same reason as /roleconfig: the Administrator level
// matches the admin role by name.

import { ApplicationCommandOptionType, ChannelType, MessageFlags, PermissionFlagsBits } from "discord.js";
import { settings } from "../modules/settings.js";
import { idList } from "../modules/roleTools.js";

function save(interaction, key, value) {
  if (!settings.has(interaction.guild.id)) settings.set(interaction.guild.id, {});
  settings.set(interaction.guild.id, value, key);
}

// Checked when logging is enabled, so a missing permission is reported to the admin
// setting it up rather than logs silently never appearing.
const NEEDED = {
  "View Channel": PermissionFlagsBits.ViewChannel,
  "Send Messages": PermissionFlagsBits.SendMessages,
  "Embed Links": PermissionFlagsBits.EmbedLinks,
  "Attach Files": PermissionFlagsBits.AttachFiles,
};

export async function run(client, interaction) { // eslint-disable-line no-unused-vars
  const reply = (content) => interaction.reply({ content, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });

  if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild))
    return reply("You need the **Manage Server** permission to change this.");

  const current = interaction.settings.messageLogChannel;
  const ignored = idList(interaction.settings.messageLogIgnore);

  switch (interaction.options.getSubcommand()) {
    case "enable": {
      const channel = interaction.options.getChannel("channel");
      if (!channel.isTextBased()) return reply("Pick a text channel.");
      const missing = Object.keys(NEEDED).filter(name => !channel.permissionsFor(interaction.guild.members.me).has(NEEDED[name]));
      if (missing.length) return reply(`I need ${missing.map(p => `\`${p}\``).join(", ")} in ${channel} first.`);
      save(interaction, "messageLogChannel", channel.id);
      return reply(`Edited and deleted messages will be logged in ${channel}. Only moderators should be able to see that channel.`);
    }
    case "disable":
      save(interaction, "messageLogChannel", "false");
      return reply("Message logging is off.");
    case "ignore": {
      const channel = interaction.options.getChannel("channel");
      const next = ignored.includes(channel.id) ? ignored.filter(id => id !== channel.id) : [...ignored, channel.id];
      save(interaction, "messageLogIgnore", next.length ? next.join(" ") : "false");
      return reply(ignored.includes(channel.id) ? `${channel} will be logged again.` : `${channel} will no longer be logged.`);
    }
    case "status": {
      const where = current && current !== "false" ? `<#${current}>` : "off";
      const list = ignored.length ? ignored.map(id => `<#${id}>`).join(", ") : "_none_";
      return reply(`**Logging to:** ${where}\n**Ignored:** ${list}`);
    }
  }
}

export const commandData = {
  name: "messagelog",
  description: "Log edited and deleted messages to a moderator channel.",
  options: [
    {
      name: "enable",
      description: "Start logging to a channel",
      type: ApplicationCommandOptionType.Subcommand,
      options: [{ name: "channel", description: "Where logs are posted", type: ApplicationCommandOptionType.Channel, channelTypes: [ChannelType.GuildText], required: true }],
    },
    { name: "disable", description: "Stop logging", type: ApplicationCommandOptionType.Subcommand },
    {
      name: "ignore",
      description: "Stop or resume logging a channel or category",
      type: ApplicationCommandOptionType.Subcommand,
      options: [{ name: "channel", description: "Channel or category", type: ApplicationCommandOptionType.Channel, required: true }],
    },
    { name: "status", description: "Show the current setup", type: ApplicationCommandOptionType.Subcommand },
  ],
  // Hidden from members who couldn't use it anyway; run() still checks, since server
  // admins can change who sees a command.
  defaultMemberPermissions: PermissionFlagsBits.ManageGuild,
};

export const conf = {
  permLevel: "User",
  guildOnly: true,
  category: "Moderation",
};

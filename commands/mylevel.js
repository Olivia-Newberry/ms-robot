import { permLevels, defaultSettings } from "../config.js";
import { settings } from "../modules/settings.js";
import { MessageEmbed } from "discord.js";

export async function run(client, message, args, level) {
  const friendly = permLevels.find(l => l.level === level).name;
  const replying = settings.ensure(message.guild.id, defaultSettings).commandReply;
  const embed = new MessageEmbed();
  embed.setColor("RANDOM")
  embed.setTitle("Permission Level")
  embed.setDescription(`Your permission level is: ${level} - ${friendly}`)

  // debugging info on test environment or bot owner
  if (process.env.NODE_ENV === "test" || message.author.id === process.env.OWNER) {
    embed.addField("Debugging Info", `Guild ID: ${message.guild.id}\nUser ID: ${message.author.id}`);
  }

  embed.setFooter(`Replying to ${message.author.username}#${message.author.discriminator}`)

  message.reply({ embeds: [embed], allowedMentions: { repliedUser: (replying === "true") } });
}

export const conf = {
  enabled: true,
  guildOnly: true,
  aliases: [],
  permLevel: "User"
};

export const help = {
  name: "mylevel",
  category: "Miscellaneous",
  description: "Tells you your permission level for the current message location.",
  usage: "mylevel"
};

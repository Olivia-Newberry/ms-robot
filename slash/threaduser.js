import { MessageFlags } from "discord.js";
import { isModThread, lookUp, threadUserId, userInfoEmbed } from "../modules/userInfo.js";

export async function run(client, interaction) {
  if (!isModThread(interaction.channel)) {
    return interaction.reply({ content: "This only works in a mod thread.", flags: MessageFlags.Ephemeral });
  }
  await interaction.deferReply();
  const userId = await threadUserId(interaction.channel);
  if (!userId) return interaction.editReply("I couldn't find a user ID at the start of this thread.");

  const user = await client.users.fetch(userId).catch(() => null);
  if (!user) return interaction.editReply(`Thread userID = ${userId}, but I couldn't find that user.`);
  const { member, messages, ban } = await lookUp(client, interaction.guild, user);
  const ctx = { guild: interaction.guild, settings: interaction.settings, requester: interaction.user };
  await interaction.editReply({ content: `Thread userID = ${userId}\nTag = <@${userId}>`, embeds: [userInfoEmbed(ctx, user, member, messages, { ban })] });
}

export const commandData = {
  name: "threaduser",
  description: "Repost the ID and info of the user a mod thread is about",
  options: [],
};

// !threaduser is still a message command (commands/user.js), so it isn't listed here.
export const conf = { permLevel: "User", guildOnly: true, category: "Moderation" };

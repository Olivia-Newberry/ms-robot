import { ApplicationCommandOptionType, MessageFlags } from "discord.js";
import { lookUp, userInfoEmbed } from "../modules/userInfo.js";

export async function run(client, interaction) {
  // The user picker only offers people Discord can resolve, so a raw ID is accepted too
  // for looking up someone who has already left.
  const id = interaction.options.getString("id");
  const user = id ? await client.users.fetch(id).catch(() => null) : interaction.options.getUser("user") ?? interaction.user;
  if (!user) return interaction.reply({ content: "I couldn't find a user with that ID.", flags: MessageFlags.Ephemeral });
  // Deferred because the message count is a search on Discord's side and can be slow.
  await interaction.deferReply();
  const { member, messages } = await lookUp(client, interaction.guild, user);
  const ctx = { guild: interaction.guild, settings: interaction.settings, requester: interaction.user };
  await interaction.editReply({ embeds: [userInfoEmbed(ctx, user, member, messages)] });
}

export const commandData = {
  name: "userinfo",
  description: "Show information about a user (yourself if left out)",
  options: [
    { name: "user", description: "The user", type: ApplicationCommandOptionType.User, required: false },
    { name: "id", description: "A user ID, for someone no longer in the server", type: ApplicationCommandOptionType.String, required: false, minLength: 17, maxLength: 20 },
  ],
};

// !user and !userinfo are still a message command (commands/user.js), so no redirect.
export const conf = { permLevel: "User", guildOnly: true, category: "Moderation" };

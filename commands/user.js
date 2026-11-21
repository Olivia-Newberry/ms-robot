// !user, kept as a message command because mods use it from habit in mod threads.
// Behaves like the old threadUser command:
//   !user <mention | ID | name#1234 | name>   info about that user
//   !user                                      in a mod thread: the thread's user
//                                              anywhere else: yourself
// /userinfo and /threaduser do the same as slash commands.

import { findUser, isModThread, lookUp, threadUserId, userInfoEmbed } from "../modules/userInfo.js";

export async function run(client, message, args, level) { // eslint-disable-line no-unused-vars
  const ctx = { guild: message.guild, settings: message.settings, requester: message.author };
  // Only the thread line's "Tag = <@id>" may ping, as it always has.
  const send = async (user, content, ping = []) => {
    const { member, messages } = await lookUp(client, message.guild, user);
    return message.channel.send({ content, embeds: [userInfoEmbed(ctx, user, member, messages)], allowedMentions: { users: ping } });
  };

  if (args[0]) {
    // "@bot user @someone" mentions the bot too, as the prefix; that isn't who to look up.
    const mentioned = message.mentions.users.find(u => u.id !== client.user.id);
    const user = await findUser(client, message.guild, args.join(" "), mentioned);
    if (!user) return message.channel.send("I couldn't find a matching member");
    return send(user);
  }

  if (isModThread(message.channel)) {
    const userId = await threadUserId(message.channel);
    if (!userId) return message.channel.send("I couldn't find a user ID at the start of this thread.");
    const user = await client.users.fetch(userId).catch(() => null);
    if (!user) return message.channel.send(`Thread userID = ${userId}, but I couldn't find that user.`);
    return send(user, `Thread userID = ${userId}\nTag = <@${userId}>`, [userId]);
  }

  return send(message.author);
}

export const conf = {
  enabled: true,
  guildOnly: true,
  aliases: ["threaduser", "userinfo"],
  permLevel: "User"
};

export const help = {
  name: "user",
  category: "Moderation",
  description: "Show a user's info, or the user a mod thread is about",
  usage: "user [mention/id/name]"
};

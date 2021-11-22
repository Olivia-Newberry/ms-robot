exports.run = async (client, message, args, level) => { // eslint-disable-line no-unused-vars
  ;(async () => {
    const { MessageEmbed } = require("discord.js");
    const moment = require('moment');
    const regex = /(\d){18}/;
    /*userID = await message.channel.messages.fetch().then((messages) => {
      return messages.array()[messages.array().length-2].content.match(/(\d){18}/)[0];
    })
    if(!userID) */userID = await message.channel.messages.fetch().then(([...messages]) => {
      var msgCount = messages.length
      if(msgCount == 50) message.channel.send('This is a long thread, you may have to manually add the role');
      var targetMsg = messages[msgCount-1];
      var targetMsgContent = [...targetMsg][1].content;
      return targetMsgContent.match(regex)[0];
    })
    if(userID == '651034500897439745')userID = await message.channel.messages.fetch().then(([...messages]) => {
      var msgCount = messages.length
      var targetMsg = messages[msgCount-2];
      var targetMsgContent = [...targetMsg][1].content;
      return targetMsgContent.match(regex)[0];
    })
    const user = await client.users.fetch(userID);
    const embeduserinfo = new MessageEmbed()
      .setColor("RANDOM")
      .setThumbnail(user.displayAvatarURL())
      .addField(`${user.tag}`, `${user}`, true)
      .addField("ID:", `${user.id}`, true)
      //.addField("Permissions:", `${user.permLevel}`, true)
      //.addField("Nickname:", `${member.nickname}`, true)
      //.addField("Status:", `${user.presence.status}`, true)
      .addField("In Server", message.guild.name, true)
      //.addField("Game:", `${user.presence.game ? user.presence.game.name : 'None'}`, true)
      .addField("Bot:", `${user.bot}`, true)
      //.addField("Joined The Server On:", `${moment.utc(user.joinedAt).format("dddd, MMMM Do YYYY")}\n<t: ${moment.unix(user.joinedAt)} :R>`, true)
      .addField("Account Created On:", `${moment.utc(user.createdAt).format("dddd, MMMM Do YYYY")}`, true) 
      .setFooter(`Replying to ${message.author.username}#${message.author.discriminator}`)
    message.channel.send({embeds:[embeduserinfo]})


    return message.channel.send('UserID = '+userID+" \nTag = <@"+userID+'>');
  })().catch( e => { console.error(e) })
};

exports.conf = {
  enabled: true,
  guildOnly: true,
  aliases: ['user'],
  permLevel: "Moderator"
};

exports.help = {
  name: "threadUser",
  category: "Moderation",
  description: "Reposts the userID of the user in a mod thread",
  usage: "threadUser"
};

exports.run = async (client, message, args, level) => { // eslint-disable-line no-unused-vars
  const { MessageEmbed } = require("discord.js");
  const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
  
  const member = (message.guild) ? message.mentions.members.first() || message.guild.members.cache.get(args[0]) || message.member : message.member || message.guild.members.cache.get(args[0]) ;
  if (!member) return message.channel.send('Please mention the user for the userinfo..');
  const user = member.user;
  var avatar = user.displayAvatarURL()
  var jailAvatar = ('https://some-random-api.ml/canvas/jail?avatar='+avatar) 
    const embeduserinfo = new MessageEmbed()
      .setColor("RANDOM")
      .setThumbnail(user.displayAvatarURL())
      .addField(`${user.tag}`, `${user}`, true)
      .addField("Nickname:", `${member.nickname}`, true)
      .setImage(jailAvatar)
      .setFooter(`Replying to ${message.author.username}#${message.author.discriminator}`)
    message.channel.send({embeds:[embeduserinfo]})
  }

 exports.conf = {
  enabled: true,
  guildOnly: true,
  aliases: ['hornyjail', "cage"],
  permLevel: "User"
};

exports.help = {
  name: "jail",
  category: "Miscellaneous",
  description: "Put user in jail",
  usage: "jail [user/id]"
};

exports.run = async (client, message, args, level) => { // eslint-disable-line no-unused-vars
  const { MessageEmbed } = require("discord.js");
  const fetch = (...args) => import("node-fetch").then(({default: fetch}) => fetch(...args));
  
  const member = (message.guild) ? message.mentions.members.first() || message.guild.members.cache.get(args[0]) || message.member : message.member || message.guild.members.cache.get(args[0]) ;
  if (!member) return message.channel.send('Please mention the user for the userinfo..');
  const user = member.user;
  var avatar = user.displayAvatarURL()
  var wastedAvatar = ('https://some-random-api.com/canvas/wasted?avatar='+avatar) 
  //replace webp with png
  wastedAvatar = wastedAvatar.replace(".webp", ".png")
  
    const embeduserinfo = new MessageEmbed()
      .setColor("RANDOM")
      .addField(`${user.tag}`, `${user}`, true)
      .setImage(wastedAvatar)
      .setFooter(`Initiated by ${message.author.username}#${message.author.discriminator}`)
    message.channel.send({embeds:[embeduserinfo]})
  }

 exports.conf = {
  enabled: true,
  guildOnly: true,
  aliases: [],
  permLevel: "User"
};

exports.help = {
  name: "wasted",
  category: "Avatar stuff",
  description: "overlay effect",
  usage: "wasted [user/id]"
};

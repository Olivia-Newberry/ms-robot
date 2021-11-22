exports.run = async (client, message, args, level) => { // eslint-disable-line no-unused-vars
  const { MessageEmbed } = require("discord.js");
  const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
  
  const member = (message.guild) ? message.mentions.members.first() || message.guild.members.cache.get(args[0]) || message.member : message.member || message.guild.members.cache.get(args[0]) ;
  if (!member) return message.channel.send('unable to find any member..');
  const user = member.user;
  var avatar = user.displayAvatarURL()
  var headpatAvatar = ('https://some-random-api.ml/canvas/triggered?avatar='+avatar) 
    const embeduserinfo = new MessageEmbed()
      .setColor("RANDOM")
      .addField(`${user.tag}`, `${user}`, true)
      .addField(`Here`,`Have a pat on the head`, true)
      .setImage([headpatAvatar])
      .setFooter(`Initiated by ${message.author.username}#${message.author.discriminator}`)
    message.channel.send({embeds:[embeduserinfo]})
  }

 exports.conf = {
  enabled: true,
  guildOnly: true,
  aliases: ["pat"],
  permLevel: "User"
};

exports.help = {
  name: "headpat",
  category: "gifs",
  description: "give a user a headpat",
  usage: "headpat [user/id]"
};

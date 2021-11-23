exports.run = async (client, message, args, level) => { // eslint-disable-line no-unused-vars
const { find_user } = require("../modules/functions.js");
const { MessageEmbed } = require("discord.js");
const moment = require('moment');
const regex = /(\d){18}/;
  ;(async () => {
    let channelCat = (message.channel.parent.parent !== null) ? message.channel.parent.parent.name.toLowerCase() : message.channel.parent.name.toLowerCase();
    if(channelCat.includes("thread")){
      let userID = await message.channel.messages.fetch().then(([...messages]) => {
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
      var tuser = await client.users.fetch(userID);
      var embedtuserinfo = new MessageEmbed()
        .setColor("RANDOM")
        .setThumbnail(tuser.displayAvatarURL())
        .addField(`${tuser.tag}`, `${tuser}`, true)
        .addField("Thread tuser ID:", `${tuser.id}`, true)
        .addField("In Server", message.guild.name, true)
        .addField("Bot:", `${tuser.bot}`, true)
        .addField("Account Created On:", `${moment.utc(tuser.createdAt).format("dddd, MMMM Do YYYY")}`, true) 
        .setFooter(`Replying to ${message.author.tusername}#${message.author.discriminator}`)
      message.channel.send({embeds:[embedtuserinfo]})
      message.channel.send('Thread tuserID = '+tuserID+" \nTag = <@"+userID+'>');
    }
  })().catch( e => { console.error(e) })

  //user part
  
  let member = await find_user(message, args);
  //dump member variable into a code block
  //message.channel.send(`\`\`\`js\n${JSON.stringify(member, null, 4)}\n\`\`\``);
  let user = (member.tag !== undefined) ? member : member.user;
  if (member === undefined) {
      return message.channel.send(`I couldn't find a matching member`);
  }  else {
    //check user is in this guild
    let inGuild = false;
    let roleTags = false;
    if(message.guild.members.cache.has(user.id)){
      inGuild = true;
      member = message.guild.members.cache.get(user.id);
      //Get roles of user
      //get roles of member
      let roles = member.roles.cache;
      //let roles = message.guild.members.cache.get(user.id).roles.cache.array();
      if(roles.length > 0){
        roleTags = true;
      }
      //list all roles as tags
      roleTags = roles.map(role => {
        return `<@&${role.id}>`;
      });
    }
    var embeduserinfo = new MessageEmbed()
      .setColor("RANDOM")
      .setThumbnail(user.displayAvatarURL())
      .addField(`${user.tag}`, `${user}`, true)
      //.addField("ID:", `${user.id}`, true)
      .addField("Permissions:", `${user.permLevel}`, true);
    if(inGuild){
      embeduserinfo
        .addField("Nickname:", `${member.nickname}`, true)
        .addField("In Server", message.guild.name, true)
        .addField("Status:", `${member.presence.status}`, true)
        .addField("Game:", `${member.presence.game ? member.presence.game.name : 'None'}`, true)
    }
    embeduserinfo
      
      //.addField("Bot:", `${user.bot}`, true)
    if(inGuild){
      embeduserinfo
        .addField("Joined The Server On:", `${moment.utc(member.joinedAt).format("dddd, MMMM Do YYYY")}`, false)
    }
    embeduserinfo
      .addField("Account Created On:", `${moment.utc(user.createdAt).format("dddd, MMMM Do YYYY")}`, false) 
      .setFooter(`Replying to ${message.author.username}#${message.author.discriminator}`)
    //if roletags addfield to embeduserinfo
    if(inGuild && roleTags){
      embeduserinfo.addField("Roles:", roleTags.join(', '), false);
    }

    message.channel.send({embeds:[embeduserinfo]})
  }
};

exports.conf = {
  enabled: true,
  guildOnly: false,
  aliases: ['user'],
  permLevel: "User"
};

exports.help = {
  name: "threadUser",
  category: "Moderation",
  description: "Reposts the userID of the user in a mod thread",
  usage: "threadUser"
};

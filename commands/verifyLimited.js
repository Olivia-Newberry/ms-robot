exports.run = async (client, message, args, level) => { // eslint-disable-line no-unused-vars
  ;(async () => {
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
    message.channel.send('UserID = '+userID);
    //message.channel.send(message.channel.messages[message.channel.messages.length-1].content.match(/(\d){18}/)[0]);
    let user = await message.guild.members.cache.get(userID);
    let member = await message.guild.member(user);
    let role = await message.guild.roles.cache.find(r => r.name == 'verified');
    member.roles.add(role).catch(console.error);
    return message.channel.send(`The user was given the limited access role!`);

  })().catch( e => { console.error(e) })
};

exports.conf = {
  enabled: true,
  guildOnly: true,
  aliases: ['!limited','limited'],
  permLevel: "Moderator"
};

exports.help = {
  name: "verifyLimited",
  category: "Moderation",
  description: "Grant user in thread LIMITED access to the server",
  usage: "verifyLimited"
};

exports.run = async (client, message, args, level) => { // eslint-disable-line no-unused-vars
  ;(async () => {
    const regex = /(\d){18}/;
    /*userID = await message.channel.messages.fetch().then((messages) => {
      return messages.array()[messages.array().length-2].content.match(/(\d){18}/)[0];
    })
    if(!userID) */
    // let userID = await message.channel.messages.fetch().then(([...messages]) => {
    //   var msgCount = messages.length
    //   if(msgCount == 50) message.channel.send('This is a long thread, you may have to manually add the role');
    //   var targetMsg = messages[msgCount-1];
    //   var targetMsgContent = [...targetMsg][1].content;
    //   return targetMsgContent.match(regex)[0];
    // })
    let userID = await message.channel.messages.fetchPinned().then(([...messages]) => {
      var targetMsg = messages[0];
      var targetMsgContent = [...targetMsg][1].content;
      return targetMsgContent.match(regex)[0];
    })
    // if(userID == '651034500897439745')userID = await message.channel.messages.fetch().then(([...messages]) => {
    //   var msgCount = messages.length
    //   var targetMsg = messages[msgCount-2];
    //   var targetMsgContent = [...targetMsg][1].content;
    //   return targetMsgContent.match(regex)[0];
    // })
    // this probably isn't needed anymore (@staff ping fix)
    // if unnecessary it can be removed after full testing:
    if(userID == '651034500897439745')userID = await message.channel.messages.fetchPinned().then(([...messages]) => {
      var targetMsg = messages[0];
      var targetMsgContent = [...targetMsg][1].content;
      return targetMsgContent.match(regex)[0];
    })
    message.channel.send('UserID = '+userID+'\nTheir tag is <@'+userID+'>');
    //message.channel.send(message.channel.messages[message.channel.messages.length-1].content.match(/(\d){18}/)[0]);
    let user = await message.guild.members.cache.get(userID);
    if(!user) return message.channel.send('User not found');
    //get guild member from userID
    let member = await message.guild.members.cache.get(userID);
    //let member = await message.guild.member(user);
    if(!member) return message.channel.send('Guild member <@'+userID+'> not found');
    let role = await message.guild.roles.cache.find(r => r.name == 'Verified');
    member.roles.add(role).catch(console.error);
    return message.channel.send(`The user was verified!`);

  })().catch( e => { console.error(e) })
};

exports.conf = {
  enabled: true,
  guildOnly: true,
  aliases: ['!verified','!boop','access'],
  permLevel: "Moderator"
};

exports.help = {
  name: "verify",
  category: "Moderation",
  description: "Grant user in thread access to the server",
  usage: "verify"
};

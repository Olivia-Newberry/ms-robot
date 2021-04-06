//const { NOW_LIVE_CHANNEL_ID } = require('./../config/prod');
const { SELFIE_CHANNEL_ID} = require('./../config/prod');

const discordCommands = require('./discordCommands');

//const { sendToTwitter } = require('./../sendToTwitter');


async function handleMessage(message){
/*	if(message.channel.id === NOW_LIVE_CHANNEL_ID){
		sendToTwitter(message);
	};*/
	if(message.channel.id === SELFIE_CHANNEL_ID){
		if (message.attachments.size > 0) {
				message.react("758296751861268540");
		}
	};
  
	if (message.author === message.client.user) return; //don't reply to self
	
	const args = message.content.split(/ +/);
	
	const command = args.shift().toLowerCase();

	discordCommands.forEach(commandFn => commandFn(command, args, message));	
}

module.exports = handleMessage;

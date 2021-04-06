const Discord = require('discord.js');

const client = new Discord.Client();

const { DISCORD_TOKEN } = require('./config/prod');

const { handleMessage } = require('./discord');

client.on('ready', () => {
	console.log('TransDIY Bot is online!');
});

client.on('message', message =>{
	handleMessage(message);
});

client.login(DISCORD_TOKEN);


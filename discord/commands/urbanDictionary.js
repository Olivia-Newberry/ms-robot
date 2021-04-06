const Discord = require('discord.js');
const fetch = require('node-fetch');
const querystring = require('querystring');

const { trim } = require('./../../utils');

async function urbanDictionaryCommand(command, args, message) {
  if (command === 'define:' || command === '!ud'){
		if (!args.length) {
			return message.channel.send('You need to supply a search term!');
		}

		const query = querystring.stringify({ term: args.join(' ') });

		const { list } = await fetch(`https://api.urbandictionary.com/v0/define?${query}`).then(response => response.json());

		if (!list.length) {
			return message.channel.send(`No results found for **${args.join(' ')}**.`).catch((e) => { console.log(e); });
		}

		//console.log(list);
		const [answer] = list;


		const embed = new Discord.RichEmbed()
			.setColor('#EFFF00')
			.setTitle(answer.word)
			.setURL(answer.permalink)
			.addField('Definition', trim(answer.definition, 1024))
			.addField('Example', trim(answer.example, 1024))
			.setFooter(`Command issued by ${message.author.tag}`, message.author.avatarURL)
		message.channel.send(embed).catch((e) => { console.log(e); });
	}
}

module.exports = urbanDictionaryCommand;

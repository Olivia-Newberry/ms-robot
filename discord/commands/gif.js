const giphy = require('giphy-api')('oU26oKBVlXYqhMuUyB2QVJsf6BxxED1B');
const Discord = require('discord.js');
const querystring = require('querystring');

function gifCommand(command, args, message) {
	if(command == '!gif'){
		giphy.search({
			q: args.join(' '),
			rating: 'pg-13'
		}, function(err,response){
			if(response.data.length == 0){
				let embed2 = new Discord.RichEmbed()
				.setColor(0x00ae86)
				.setDescription(`🎬 Sorry I Can't find a gif related with your keywords.`)
				message.channel.send({embed:embed2})
				return;
			}

			var totalResponses = response.data.length;
			var responseIndex = Math.floor((Math.random() * 10) + 1) % totalResponses;

			let embed = new Discord.RichEmbed()
			.setColor(0x00ae86)
			.setDescription('<@'+message.author.id+'> '+args.join(' '))
			.setImage(response.data[responseIndex].images.original.url)
			message.channel.send({embed:embed});
			//message.delete();
			return

		})
		//return message.channel.send(`Hi **${args.join(' ')}**, I'm Cyndergosa!`).catch((e) => { console.log(e); });
	}
}
module.exports = gifCommand;

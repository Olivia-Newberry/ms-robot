const fetch = require('node-fetch');

async function catCommand(command, args, message) {
  if (message.content.toLowerCase().includes('!cat')) {
		const { link } = await fetch('https://some-random-api.ml/img/cat').then(response => response.json());
		const cat = link;
		const { fact } = await fetch('https://some-random-api.ml/facts/cat').then(response => response.json());
		
		const embed = {
		  "description": "Random cat picture:",
		  "color": 6640281,
		  "image": {
			"url": cat
		  }
		};
		message.channel.send(fact,{ embed });
	}
}

module.exports = catCommand;

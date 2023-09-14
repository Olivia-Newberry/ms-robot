exports.run = async (client, message, args, level, command) => { // eslint-disable-line no-unused-vars
	//var command = args.shift().toLowerCase();
	if (message.content.toLowerCase() === "ms robot test") {
		message.reply('I\'m listening!');
	}
	if (message.content.toLowerCase() == "hi ms robot") {
		message.reply('Hello, how are you today?');
	}
	if (message.content.toLowerCase().includes('minecraft')) {
		message.react("634294300976349194")
	}

	if (
		(
			message.content.toLowerCase().includes('!verification')
			|| message.content.toLowerCase().includes('! verification')
		)
		&& message.channel.name.toLowerCase() != 'mossy'
	) {
		message.channel.send('!!verify');
	}

	//if channel name contains "selfie"
	if (message.channel.name.toLowerCase().includes("selfie")) {
		if (message.attachments.size > 0) {
			message.react("758296751861268540");
		}
	};

}

exports.conf = {
	enabled: true,
	guildOnly: false,
	aliases: [],
	permLevel: "User"
};

exports.help = {
	name: "partialMessage",
	category: "Miscellaneous",
	description: "Easter eggs, funky things and others",
	usage: "Just chat, you may notice it."
};
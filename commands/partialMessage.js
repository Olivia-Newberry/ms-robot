exports.run = async (client, message, args, level, command) => { // eslint-disable-line no-unused-vars
	//var command = args.shift().toLowerCase();
    if (message.content.toLowerCase() === "ms robot test"){
		message.reply('I\'m listening!');
	}
	if (message.content.toLowerCase() == "hi ms robot"){
		message.reply('Hello, how are you today?');
	}
	if (message.content.toLowerCase().includes('there it is')){
		if (Math.random() < 0.5)message.reply('https://youtu.be/ULkuwxJTGtY');
	}
	if (message.content.toLowerCase().includes('beep boop')){
		if (Math.random() < 0.5)message.reply('https://youtu.be/0hoa9tXnZX8');
	}
	if (message.content.toLowerCase().includes('thatcher')||message.content.toLowerCase().includes('milk snatcher')){
		message.reply('https://youtu.be/kPIdRJlzERo');
	}
	const pirate = ["you are a pirate", "you're a pirate", "i am a pirate", "i'm a pirate", "we are pirates", "we're pirates", "pirating"]
	if (pirate.some(el => message.content.toLowerCase().includes(el))){
		message.reply('https://youtu.be/5qacGULztuQ');
	}
	if (message.content.toLowerCase().includes('crab')){
		if (Math.random() < 0.5)message.react("🦀")
	}
	if (message.content.toLowerCase().includes('pamplemousse')||message.content.toLowerCase().includes('pomegranate')){
		message.react("826570456063541259")
	}
	if (message.content.toLowerCase().match(/(?<!\w|')no (u|you)(?!\w|')/)){
		message.react("589309987960913920")
	}
	if (message.content.toLowerCase().includes('hella')){
		message.react("681288946386599962")
	}
	if (message.content.toLowerCase().includes('bee')){
		message.react("795792808916418580")
	}
	if (message.content.toLowerCase().includes('minecraft')){
		message.react("634294300976349194")
	}
	if (message.content.toLowerCase().includes('felicis')||message.content.toLowerCase().includes('jesso')){
		message.react("511339802877231105")
	}
	if (message.content.toLowerCase().includes('qq')||message.content.toLowerCase().includes('quentin')||message.content.toLowerCase().includes('qassemyar')){
		message.react("776449403287765012");
		message.react("776524622325219368");
	}

	if (message.content.toLowerCase().includes('!verification') || message.content.toLowerCase().includes('! verification')){
		message.channel.send('!!verify');
	}
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
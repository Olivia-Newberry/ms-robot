function testCommand(command, args, message) {
    if (message.content.toLowerCase() === "ms robot test"){
		message.reply('I\'m listening!');
	}
	if (message.content.toLowerCase() == "hi ms robot"){
		message.reply('Hello, how are you today?');
	}
	if (message.content.toLowerCase().includes('there it is')){
		if (Math.random() < 0.5)message.reply('https://youtu.be/ULkuwxJTGtY');
	}
	if (message.content.toLowerCase().includes('crab')){
		if (Math.random() < 0.5)message.react("🦀")
	}
	if (message.content.toLowerCase().includes('pamplemousse')||message.content.toLowerCase().includes('pomegranate')){
		message.react("826570456063541259")
	}
	if (message.content.toLowerCase().includes('no u')||message.content.toLowerCase().includes('no you')){
		if (Math.random() < 0.5)message.react("589309987960913920")
	}
	if (message.content.toLowerCase().includes('hella')){
		message.react("681288946386599962")
	}
	if (args.includes('bee')){
		message.react("795792808916418580")
	}
	if (message.content.toLowerCase().includes('minecraft')){
		message.react("634294300976349194")
	}
	if (message.content.toLowerCase().includes('heart')){
		message.react("758296751861268540")
	}
	if (message.content.toLowerCase().includes('felicis')||message.content.toLowerCase().includes('jesso')){
		message.react("511339802877231105")
	}
	if(command == '!time'){
		message.channel.send('https://imgs.xkcd.com/comics/now.png?'+Date.now());
	}
}

module.exports = testCommand;

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
	if (message.content.toLowerCase().includes('beep boop')){
		message.reply('https://youtu.be/5DBc5NpyEoo');
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
	if (args.includes('bee')){
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
	if(command == '!time'){
		message.channel.send('https://imgs.xkcd.com/comics/now.png?'+Date.now());
	}
	if(command == '!rejoice'){
		message.channel.send('https://youtu.be/NmPhaG1ud38');
	}
	if(command == '!movealong'){
		message.channel.send('https://youtu.be/_Wx98AolMQw');
	}
	if(command == '!access' || command == '!!verified' || command == '!!boop'){
		;(async () => {
			/*userID = await message.channel.messages.fetch().then((messages) => {
				return messages.array()[messages.array().length-2].content.match(/(\d){18}/)[0];
			})
			if(!userID) */userID = await message.channel.messages.fetch().then((messages) => {
				return messages.array()[messages.array().length-1].content.match(/(\d){18}/)[0];
			})
			if(userID == '651034500897439745')userID = await message.channel.messages.fetch().then((messages) => {
				return messages.array()[messages.array().length-2].content.match(/(\d){18}/)[0];
			})
			message.channel.send('UserID = '+userID);
			//message.channel.send(message.channel.messages[message.channel.messages.length-1].content.match(/(\d){18}/)[0]);
			let user = await message.guild.members.cache.get(userID);
			let member = await message.guild.member(user);
			let role = await message.guild.roles.cache.find(r => r.name == 'Verified');
			member.roles.add(role).catch(console.error);
			return message.channel.send(`The user was verified!`);

		})().catch( e => { console.error(e) })
	}
	if(command == '!!limited' || command == '!limited'){
		;(async () => {
			/*userID = await message.channel.messages.fetch().then((messages) => {
				return messages.array()[messages.array().length-2].content.match(/(\d){18}/)[0];
			})
			if(!userID) */userID = await message.channel.messages.fetch().then((messages) => {
				return messages.array()[messages.array().length-1].content.match(/(\d){18}/)[0];
			})
			if(userID == '651034500897439745')userID = await message.channel.messages.fetch().then((messages) => {
				return messages.array()[messages.array().length-2].content.match(/(\d){18}/)[0];
			})
			message.channel.send('UserID = '+userID);
			//message.channel.send(message.channel.messages[message.channel.messages.length-1].content.match(/(\d){18}/)[0]);
			let user = await message.guild.members.cache.get(userID);
			let member = await message.guild.member(user);
			let role = await message.guild.roles.cache.find(r => r.name == 'verified');
			member.roles.add(role).catch(console.error);
			return message.channel.send(`The user was given the limited access role!`);

		})().catch( e => { console.error(e) })
	}
	if(command == '!user'){
		;(async () => {
			/*userID = await message.channel.messages.fetch().then((messages) => {
				return messages.array()[messages.array().length-2].content.match(/(\d){18}/)[0];
			})
			if(!userID) */userID = await message.channel.messages.fetch().then((messages) => {
				return messages.array()[messages.array().length-1].content.match(/(\d){18}/)[0];
			})
			if(userID == '651034500897439745')userID = await message.channel.messages.fetch().then((messages) => {
				return messages.array()[messages.array().length-2].content.match(/(\d){18}/)[0];
			})
			return message.channel.send('UserID = '+userID+" \nTag = <@"+userID+'>');
		})().catch( e => { console.error(e) })
	}
	if (message.content.toLowerCase().includes('!verification')){
		message.channel.send('!!verify');
	}
}

module.exports = testCommand;

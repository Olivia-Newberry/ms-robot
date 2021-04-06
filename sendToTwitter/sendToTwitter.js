const fetch = require('node-fetch');
const Twitter = require('twitter');
function sendToTwitter(message) {
    //const displayName = message && message.member && message.member.displayName;
    const messageContent = message && message.content;
	if (message.author.id != '204255221017214977'){ console.log(message.author.id + ' ' + message.content); return;} // Only reply to Turing bot}
    //if (!displayName || !messageContent) return;
	const { TWITTER_CONSUMER_KEY } = require('./../config/prod');
	const { TWITTER_CONSUMER_SECRET } = require('./../config/prod');
	const { TWITTER_TOKEN_KEY } = require('./../config/prod');
	const { TWITTER_TOKEN_SECRET } = require('./../config/prod');


	var twitterClient = new Twitter({
		consumer_key: TWITTER_CONSUMER_KEY,
		consumer_secret: TWITTER_CONSUMER_SECRET,
		access_token_key: TWITTER_TOKEN_KEY,
		access_token_secret: TWITTER_TOKEN_SECRET
	});


	twitterClient.post('statuses/update', {status: messageContent}, function(error, tweet, response) {
		if (!error) {
			message.react('719915506412552202');
		}else{
			const channel = message.channel.guild.channels.find(ch => ch.id === '714923040030458017');
			//console.log(message.content);
			//console.log(error);
			//console.log(response);
			if (channel) channel.send(message.content+' '+JSON.stringify(error));
			message.react("⛔");
		}
	});
/*

    const body = { "name": displayName, "message": messageContent };
    
    fetch('http://127.0.0.1:8123/up/sendmessage', {
            method: 'post',
            body:    JSON.stringify(body),
            headers: { 'Content-Type': 'application/json' },
        })
        .then(res => res.json())
        .then(json => console.log(json));*/
}

module.exports = sendToTwitter;

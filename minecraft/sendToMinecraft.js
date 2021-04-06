const fetch = require('node-fetch');

function sendToMinecraft(message) {
    const displayName = message && message.member && message.member.displayName;
    const messageContent = message && message.content;
	
    if (!displayName || !messageContent) return;

    const body = { "name": displayName, "message": messageContent };
    
    fetch('http://127.0.0.1:8123/up/sendmessage', {
            method: 'post',
            body:    JSON.stringify(body),
            headers: { 'Content-Type': 'application/json' },
        })
        .then(res => res.json())
        .then(json => console.log(json));
}

module.exports = sendToMinecraft;

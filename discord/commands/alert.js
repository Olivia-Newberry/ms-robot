const sqlite3 = require('sqlite3').verbose();
let db = new sqlite3.Database('./DB/alert.db', (err) => {
	if (err) {
	  console.error(err.message);
	}else{
	console.log('Connected to the alert database.');}
  });

  async function runSQL(sql,params=[]){
	return new Promise((resolve,reject) =>{
		db.run(sql, params, function(err){
			if (err) {
				console.log('Error running sql ' + sql)
				console.log(err)
				reject(err)
			} else {
				resolve({ id: this.lastID })
			}
		})
	})
}  
async function getSQL(sql,params=[]){
	return new Promise((resolve,reject) =>{
		db.get(sql, params, function(err,result){
			if (err) {
				console.log('Error running sql ' + sql)
				console.log(err)
				reject(err)
			} else {
				resolve(result)
			}
		})
	})
}  
async function allSQL(sql,params=[]){
	return new Promise((resolve,reject) =>{
		db.all(sql, params, function(err,rows){
			if (err) {
				console.log('Error running sql ' + sql)
				console.log(err)
				reject(err)
			} else {
				resolve(rows)
			}
		})
	})
}  
async function deleteSQL(id){
	return await runSQL(`DELETE FROM alerts WHERE id = ?`, [id]);
}
async function removeAlert(id){
	return await runSQL(`UPDATE alerts SET active = 0 WHERE id = ?`, [id]);
}
async function addAlert(level, reason, user){
	return await runSQL('INSERT INTO alerts (level, reason, user, active) VALUES (?, ?, ?, 1)', [level, reason, user])
}
async function checkAlert(message){
	const alert = await getSQL('SELECT sum(level) as alertLevel FROM alerts WHERE active = 1');
	//console.log(alert.alertLevel);
	message.channel.guild.channels.find(ch => ch.id === '714923040030458017').setName(colourCode(alert.alertLevel)+'-Olivias-channel');
	console.log('Channel name should be updated');
	return alert.alertLevel;
}

const sql = `
    CREATE TABLE IF NOT EXISTS alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
	  level INTEGER,
	  reason TEXT,
	  user TEXT,
	  active INTEGER
	  )`;
runSQL(sql);


function postReply(reply,message){
	message.reply(reply);	
	message.react("👍");
	//console.log(message.channel.guild.channels);
	const channel = message.channel.guild.channels.find(ch => ch.name === 'departure-lounge');
	if (!channel) return;
	//channel.send(reply);
}

function colourCode(number){
	if(number <= 0){
		return '🟢';
	}
	if(number <= 25){
		return '⚪';
	}
	if(number <= 50){
		return '🟡';
	}
	if(number <= 75){
		return '🟠';
	}
		return '🔴';
}

async function alert(command, args, message) {
	//if (message.content.toLowerCase().includes('!alert')){
	if (command=='!alert'){
		
		const arg1 = args.shift();
		//console.log(!isNaN(arg1));
		//console.log('|'+arg1+'|');
		if(!isNaN(arg1)){
			const reason = args.join(' ');
			const user = message.author.username;
			await addAlert(arg1, reason, user);
			await checkAlert(message);
			const reply = 'Alert level adjusted by '+colourCode(arg1*3)+arg1+' points by user: '+user+' for reason: '+reason;
			postReply(reply, message);
			return;
		}else{
			if(arg1 == 'delete'){
				const arg2 = args.shift();
				if(!isNaN(arg2)){
					const reply = 'Attempting to remove alert ID: '+arg2;
					postReply(reply,message);
					var result = await removeAlert(arg2,message);
					await checkAlert(message);
					//console.log(result);
					//postReply(result,message);
					return;
				}else{
					const reply = 'Please select a valid ID number';
					postReply(reply,message);
					return;
				}
			}
			if(arg1 == 'help'){
				const reply = '```!alert command```Usage: '
				+'```!alert number reason```This will increase or disconnect the alert level by the proposed amount for reason specified\n'
				+'```!alert list```This will list all active alerts\n'
				+'```!alert remove ID```This will remove alert with the ID specified';
				postReply(reply,message);
				return;
			}
			if(arg1 == 'list'){
				const arg2 = args.shift();
				const level = await checkAlert(message);
				//console.log(level);
				postReply('Total alert level is at: '+colourCode(level)+level,message);
				if(arg2 == 'all'){
					query = 'SELECT * FROM alerts';
					queryAll = true;
				}else{
					query = 'SELECT * FROM alerts WHERE active = 1';
					queryAll = false;
				}
				//console.log(query);
				const rows = await allSQL(query);
				if(Array.isArray(rows)){
					//console.log(rows);
					rows.forEach(element => {
						//console.log(element);
						var reply = '```ID:'+element.id+' Level:'+colourCode(element.level*3)+element.level+'```Reason: '+element.reason+'```Posted by User: '+element.user;
						if(queryAll){reply += ' Active:'+element.active;}
						reply += '```';
						//console.log(reply);
						postReply(reply,message);
					});
				}else{
					postReply('An error occurred',message)
				}
				return;
			}
			const reply = 'Please enter a number';
			postReply(reply, message);
			return;
		}	
	}
}
module.exports = alert;

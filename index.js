/***************************
 *         PETER           *
 *  PIXELS COLLECTION BOT  *
 ***************************/
// Invite link:
// https://discord.com/api/oauth2/authorize?client_id=838872763501772830&permissions=8&scope=bot

const Discord = require('discord.js');
const bot = new Discord.Client();
const client = bot; // alias
const fs = require('fs'); // FILE SYSTEM
const crypto = require('crypto');
const NodeRSA = require('node-rsa');
const CryptoJS = require("crypto-js");
require('dotenv').config({path: __dirname + '/.env'}); // env variables (client secret)

// if running multiple instances, use this ID to differentiate between them
CLIENT_ID = process.env["CLIENT_ID"];
if (!CLIENT_ID) console.log("Missing CLIENT_ID");

// the userid that may use direct eval()
const ADMIN_ID = process.env["ADMIN_ID"];
if (!ADMIN_ID) console.log("Missing ADMIN_ID");

PREFIX = process.env["PREFIX"];
if (!PREFIX) console.log("Missing PREFIX");

RSA_PUBLIC = process.env["RSA_PUBLIC"];
if (!RSA_PUBLIC) console.log("Missing RSA_PUBLIC");
else RSA_PUBLIC = RSA_PUBLIC.replace(/\\n/g, "\n");

bot.on("message", function(message) {
	// DEBUG:
	// if the message is from me and starts with PREFIX, eval() the message
	// and send the output back to the same channel
	if (message.author.id === ADMIN_ID && message.content.indexOf(PREFIX) === 0) {
		try {
			// if the message is in ```code blocks```, supress the return value
			if (message.content.indexOf("```") != 1) {
				message.channel.send("```"+eval(message.content.substring(1))+"```")
					.catch((e)=>{console.log(e)})
			}
			else {
				// log the return value to the console instead
				console.log(eval(message.content.slice(4,-3)));
			}
			return;
		}
		catch(e) {
			message.channel.send("```"+e+"```")
				.catch((e)=>{console.log(e)})
			return;
		}
	}

	let date = /^(?<year>\d\d\d\d)-(?<month>\d\d)-(?<day>\d\d)\n[Mm]ood:? ?(?<mood>[1-5])\n/;
	if (message.content.match(date) != null) {

		let rawdata = fs.readFileSync('pixels.json');
		console.log("Read pixels data: " + rawdata);
		let pixels = JSON.parse(rawdata);

		entries = message.content.split("\n\n");
		for (entry in entries) {
			meta = entries[entry].match(date);

			if (meta == null) {
				message.channel.send("Entry "+entry+" does not match the date format (20xx-xx-xx mood: x)\nSkipping ...");
				continue;
			}
			meta = meta.groups;
			meta.date = meta.year+"-"+meta.month+"-"+meta.day;

			// remove the first two lines (strip metadata)
			content = entries[entry].split("\n")
			content.shift();
			content.shift();
			content = content.join("\n");

			const aes_salt = crypto.randomBytes(16);
			const aes_pass = crypto.randomBytes(32).toString("base64");
			const aes_iv = crypto.randomBytes(16);
			const aes_key = crypto.pbkdf2Sync(aes_pass, aes_salt, 10000, 32, 'sha256');
			const cipher = crypto.createCipheriv('aes-256-cbc', aes_key, aes_iv);
			const encrypted = Buffer.concat([cipher.update(content, 'utf8'), cipher.final()]);
			////console.log("encrypted: "+ encrypted.toString('base64'));
			////console.log("key: "+aes_key.toString('hex'));
			////console.log("iv: "+ aes_iv.toString('hex'));
			// Decrypt using: echo -ne "<notes_hex>" | base64 -d | openssl aes-256-cbc -d -iv <iv_hex> -K <key_hex>

			const rsa_key = RSA_PUBLIC;
			const aes_key_encrypted = crypto.publicEncrypt(
				{ key: rsa_key, padding: crypto.constants.RSA_PKCS1_PADDING },
				Buffer.from(aes_key.toString('hex'))
			);
			// Decrypt using: echo -ne "<aes_key_encrypted_b64>" | base64 -d | openssl rsautl -decrypt -inkey ~/.ssh/id_rsa.pem

			pixels.push({
				"date": meta.date,
				"mood": parseInt(meta.mood),
				"notes": encrypted.toString('base64'),
				"key": aes_key_encrypted.toString('base64'),
				"iv": aes_iv.toString('hex')
			});
		}

		fs.writeFileSync('pixels.json', JSON.stringify(pixels, null, "\t"));
	}
});

bot.on('ready', function() {
	console.log('Peter ready!'); // bot initialization complete
});

console.log("Peter is waking up ...");
bot.login(process.env["CLIENT_SECRET"]).then(() => {
	console.log("Logged in alright"); // didn't crash (yet)
});


/*
[
	{"date": "2001-04-15", "mood": 1, "notes": "I was born", "encrypted": "skdfjaskdj", "key": "123"},
	{"date": "2021-05-03", "mood": 3, "notes": "I am today", "encrypted": "askjdhf", "key": "445"}
]
*/

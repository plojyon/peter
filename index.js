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
require('dotenv').config({path: __dirname + '/.env'}); // env variables (client secret)
const datestring_regex = /^(?<year>\d\d\d\d)-(?<month>\d\d)-(?<day>\d\d)(?: (?<weekday>\w+))?\n[Mm]ood:? ?(?<mood>[1-5])\n/;

// if running multiple instances, use this ID to differentiate between them
CLIENT_ID = process.env["CLIENT_ID"];
if (!CLIENT_ID) console.log("Missing CLIENT_ID");

// the userid that may use direct eval()
const ADMIN_ID = process.env["ADMIN_ID"];
if (!ADMIN_ID) console.log("Missing ADMIN_ID");

PREFIX = process.env["PREFIX"];
if (!PREFIX) console.log("Missing PREFIX");

TIMEOUT = process.env["TIMEOUT"];
if (!TIMEOUT) console.log("Missing TIMEOUT");

RSA_PUBLIC = process.env["RSA_PUBLIC"];
if (!RSA_PUBLIC) console.log("Missing RSA_PUBLIC");
else RSA_PUBLIC = RSA_PUBLIC.replace(/\\n/g, "\n");

// when querying "pixels" instead of "pixels full", ignore dates preceding this
DEFAULT_START_FILTER = process.env["DEFAULT_START_FILTER"];
if (!DEFAULT_START_FILTER) console.log("Missing DEFAULT_START_FILTER");

const weekdays = [
	"Sunday",
	"Monday",
	"Tuesday",
	"Wednesday",
	"Thursday",
	"Friday",
	"Saturday"
];

function date2str(day) {
	return day.getFullYear()
	+ "-" +
	('0' + (day.getMonth() + 1)).slice(-2)
	+ "-" +
	('0' + day.getDate()).slice(-2);
}

function tomorrow(day) {
	return new Date(day.getFullYear(), day.getMonth(), day.getDate()+1);
}

function isValidDate(year, month, day) {
	const d = new Date(year, month - 1, day);
	if (!d) return false;
	if (!(d instanceof Date)) return false;
	if (isNaN(d.getTime())) return false;
	if (d.getFullYear() != parseInt(year)) return false;
	if (d.getMonth() + 1 != parseInt(month)) return false;
	if (d.getDate() != parseInt(day)) return false;
	if (d > new Date()) return false;
	return true;
}

function isValidDateString(str) {
	if (!str) return false;

	let d = str.split("-");

	if (!d) return false;
	if (d.length != 3) return false;

	return isValidDate(d[0], d[1], d[2]);
}

function dateEquals(a, b) {
	return a.getFullYear() == b.getFullYear()
		&& a.getMonth() == b.getMonth()
		&& a.getDate() == b.getDate();
}

function find_duplicate_entries(pixels) {
	// expects sorted input (ascending)
	let i = 0;
	let duplicate = [];
	while (i+1 < pixels.length) {
		if (pixels[i].date == pixels[i+1].date) {
			duplicate.push(pixels[i].date);
		}
		i++;
	}
	return duplicate;
}

function find_missing_entries(pixels, duplicate) {
	// expects sorted input (ascending)
	let i = 0;

	// handle edge case: first entry is invalid
	while (i != pixels.length && !isValidDateString(pixels[i].date)) i++;
	if (i == pixels.length) return [];

	let day = new Date(pixels[i].date);
	let missing = [];
	while (i < pixels.length) {
		if (dateEquals(new Date(pixels[i].date), day)) {
			const count_dupes = duplicate.length - duplicate.filter((x) => x != pixels[i].date).length;
			i += 1 + count_dupes;
		}
		else {
			missing.push(date2str(day));
		}
		day = tomorrow(day);

		while (i < pixels.length && !isValidDateString(pixels[i].date)) i++;
	}
	return missing;
}

function find_invalid_entries(pixels) {
	let invalid = [];
	for (let i in pixels) {
		if (!isValidDateString(pixels[i].date)) invalid.push(pixels[i].date);
	}
	return invalid;
}

function group_sequences(pixels) {
	// groups consecutive dates in a sorted (ascending) array of datestrings
	// ["2020-01-01", "2020-01-02", "2020-01-03", "2021-03-31"]
	// will be converted to
	// ["2020-01-01 to 2020-01-03", "2021-03-31"]
	// invalid dates will be dropped
	let converted = [];
	let consec = false; // am I currently inside a consecutive group?

	for (let i = 0; i < pixels.length; i++) {
		if (!isValidDateString(pixels[i])) continue;

		let next_day = date2str(tomorrow(new Date(pixels[i])));

		if (i+1 != pixels.length && pixels[i+1] == next_day) {
			if (!consec) {
				converted.push(pixels[i] + " to ");
				consec = true;
			}
		}
		else {
			if (consec) {
				converted[converted.length - 1] += pixels[i];
				consec = false;
			}
			else {
				converted.push(pixels[i]);
			}
		}
	}

	if (converted.length > 50) {
		console.log(converted);
		converted = ["More than 50 entries"];
	}

	return converted;
}

function get_status(start="") {
	let rawdata = fs.readFileSync('pixels.json');
	let pixels = JSON.parse(rawdata);
	pixels.sort((a, b) => {
		if (a.date > b.date) return 1;
		if (a.date < b.date) return -1;
		return 0;
	});
	if (pixels.length == 0) return "No data.";

	let duplicate = find_duplicate_entries(pixels);
	let missing = find_missing_entries(pixels, duplicate);
	let invalid = find_invalid_entries(pixels);

	// filter only events after the date supplied by "start"
	duplicate = duplicate.filter(x => x > start)
	missing = missing.filter(x => x > start)
	invalid = invalid.filter(x => x > start)

	// group missing pixels in case I accidentally add an entry in 2077
	missing = group_sequences(missing);

	// add message formatting
	duplicate = duplicate.map((x) => "`" + x + "`");
	missing = missing.map((x) => "`" + x + "`");
	invalid = invalid.map((x) => "`" + x + "`");

	// find the last valid entry
	let last_index = pixels.length;
	let last_date;
	do {
		last_index--;
		last_date = pixels[last_index].date;
	} while (!isValidDateString(last_date) && last_index != 0);

	return {
		"duplicate": duplicate,
		"missing": missing,
		"invalid": invalid,
		"last": {
			"pixel": pixels[last_index],
			"date": last_date,
			"weekday": weekdays[new Date(last_date).getDay()],
		},
		"pixels": pixels,
	}
}

function status(start="") {
	// Last updated on Wednesday
	// Missing: 2021-03-01, 2020-04-21
	// Duplicate: 2021-03-22
	let str = "";

	status = get_status(start)

	let last_weekday = status.last.weekday;
	if (status.last.date == date2str(new Date()))
		last_weekday = "today";
	else if (status.last.date == date2str(new Date(new Date()-1)))
		last_weekday = "yesterday";
	str = "Last updated **" + last_weekday + "** ("+status.last.date+")";

	// add a warning if this was a long time ago
	const diffTime = Math.abs(new Date() - new Date(status.last.date));
	// (assuming last_date is in the past)
	const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
	if (diffDays >= 7)
		str += " [more than a week ago]";

	if (status.missing.length > 0) {
		str += "\nMissing: " + status.missing.join(", ");
	}
	if (status.duplicate.length > 0) {
		str += "\nDuplicate: " + status.duplicate.join(", ");
	}
	if (status.invalid.length > 0) {
		str += "\nInvalid: " + status.invalid.join(", ");
	}

	return str;
}

function template() {
	let status = get_status()
	let str = ""
	let day = new Date(status.last.date) // int i = 0
	while (!dateEquals(day, new Date())) { // while (i < n)
		day = tomorrow(day) // i++
		weekday = weekdays[day.getDay()]
		str += date2str(day) + " ("+weekday+")\nmood: \n\n"
	}
	return str
}

function encryptedPush(pixels, entry) {
	const content = entry.content;
	const meta = entry.meta;

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

// receives a raw entry (in the form of datestring_regex)
// and returnes a parsed version, reporting any errors to `logger`
function parseEntry(entry, logger, pixels) {
	meta = entry.match(datestring_regex);

	if (meta == null) {
		logger(
			"Entry does not match the date format "
			+ "(20xx-xx-xx [weekday] mood: x)\nSkipping ...");
		return;
	}
	meta = meta.groups;
	meta.date = meta.year+"-"+meta.month+"-"+meta.day;

	// check if date is valid
	if (!isValidDate(meta.year, meta.month, meta.day)) {
		logger(
			"Entry has an invalid date: "
			+ meta.date + ". Skipping ...");
		return;
	}

	// check if date is a duplicate
	if (pixels.filter((e) => e.date == meta.date).length != 0) {
		logger(
			"Warning: entry is a duplicate!"
			+ " Both entries will be saved. You might want to note"
			+ " the circumstances for easier conflict resolution.");
	}

	// if a weekday was provided, make sure it's correct
	if (meta.weekday) {
		const d = new Date(meta.year, meta.month - 1, meta.day);
		const actual_weekday = weekdays[d.getDay()];

		if (meta.weekday.toUpperCase() != actual_weekday.toUpperCase()) {
			logger(
				"Entry says " + meta.weekday
				+ ", but " + meta.date + " is a " + actual_weekday
				+ ". Skipping this entry ...");
			return;
		}
	}

	// remove the first two lines (strip metadata)
	content = entry.split("\n")
	content.shift();
	content.shift();
	content = content.join("\n");

	return {content: content, meta: meta};
}

bot.on("message", function(message) {
	// DEBUG:
	// if the message is from me and starts with PREFIX, eval() the message
	// and send the output back to the same channel
	if (message.author.id === ADMIN_ID && message.content.indexOf(PREFIX) === 0) {
		try {
			// if the message is in ```code blocks```, supress the return value
			if (message.content.indexOf("```") != 1) {
				message.channel.send("```"+eval(message.content.substring(PREFIX.length))+"```")
					.catch((e)=>{console.log(e)})
			}
			else {
				// log the return value to the console instead
				console.log(eval(message.content.slice(PREFIX.length + 3, -3)));
			}
			return;
		}
		catch(e) {
			message.channel.send("```"+e+"```")
				.catch((e)=>{console.log(e)})
			return;
		}
	}

	if (message.content.indexOf("pixels") == 0) {
		let sendPromise;
		if (message.content == "pixels") {
			sendPromise = message.channel.send(status(DEFAULT_START_FILTER));
		}
		else {
			sendPromise = message.channel.send(status());
		}
		// delete the user query immediately
		message.delete().catch();
		// delete the reply after a few seconds
		sendPromise.then(m => setTimeout(()=>m.delete().catch(), TIMEOUT));
		return;
	}

	if (message.content.toLowerCase() == "template") {
		sendPromise = message.channel.send(template());
		// delete the user query immediately
		message.delete().catch();
		// delete the reply after a few seconds
		sendPromise.then(m => setTimeout(()=>m.delete().catch(), TIMEOUT));
		return;
	}

	if (message.content.match(datestring_regex) != null) {

		let rawdata = fs.readFileSync('pixels.json');
		let pixels = JSON.parse(rawdata);

		entries = message.content.split("\n\n");
		for (entry in entries) {
			entry = parseEntry(entries[entry], function(m) {message.channel.send("e"+entry+": "+m)}, pixels);
			if (entry)
				encryptedPush(pixels, entry);
		}

		fs.writeFileSync('pixels.json', JSON.stringify(pixels, null, "\t"));

		let emoji = "👍";
		switch (entries.length) {
			case 1:
				emoji = "👍";
				break;
			case 2:
				emoji = "2️⃣";
				break;
			case 3:
				emoji = "3️⃣";
				break;
			case 4:
				emoji = "4️⃣";
				break;
			case 5:
				emoji = "5️⃣";
				break;
			case 6:
				emoji = "6️⃣";
				break;
			case 7:
				emoji = "7️⃣";
				break;
			case 8:
				emoji = "8️⃣";
				break;
			case 9:
				emoji = "9️⃣";
				break;
			default:
				emoji = "⭐";
				break;
		}
		message.react(emoji);

		setTimeout(()=>{message.delete()}, 10000);
	}
});

// encrypts a plaintext pixels data (json) file from `source` to `dest`
// (useful in combination with decryptor.py when changing the RSA key
// or when re-encrypting a non-encrypted backup)
function fromParsedPlaintext(source, dest) {
	let input = JSON.parse(fs.readFileSync(source));
	let pixels = [];

	for (e in input) {
		const entry = {content: input[e].notes, meta: {date: input[e].date, mood: input[e].mood}};
		encryptedPush(pixels, entry);
	}

	fs.writeFileSync(dest, JSON.stringify(pixels, null, "\t"));
}

// encrypts an unparsed plaintext file from `source` to `dest`
// (useful when logging a lot more than 2k characters)
// this is equivalent to dumping a large file into a discord message
function fromUnparsedPlaintext(source, dest) {
	let input = fs.readFileSync(source);
	let pixels = [];

	entries = message.content.split("\n\n");
	for (e in entries) {
		entry = parseEntry(entries[e], function(m) {message.channel.send("e"+e+": "+m)}, []);
		if (entry)
			encryptedPush(pixels, entry);
	}

	fs.writeFileSync(dest, JSON.stringify(pixels, null, "\t"));
}

bot.on('ready', function() {
	console.log('Peter ready!');
	bot.user.setActivity("pixels");
});

console.log("Peter is waking up ...");
bot.login(process.env["CLIENT_SECRET"]).then(() => {
	console.log("Logged in alright");
});

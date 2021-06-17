#!python3
from Crypto.PublicKey import RSA
from Crypto.Cipher import AES
from Crypto.Cipher import PKCS1_v1_5
from Crypto.Util.Padding import unpad
from datetime import datetime # check if date is valid
from base64 import b64decode
from getpass import getpass # input() without console echo
import json
import sys # command line arguments
import os # check for file overwrite

if (len(sys.argv) != 2):
	print("Usage: decryptor.py <file.json>");
	exit();

filename = sys.argv[1];
dir = os.path.dirname(os.path.abspath(filename));
out_filename = os.path.join(dir, "decrypted.json");
if (os.path.isfile(out_filename)):
	yn = input(os.path.basename(out_filename) + " already exists at " + os.path.dirname(out_filename) + ". Overwrite? [y/N] ");
	if (yn.lower() != "y"):
		print("Abort.");
		exit();
print("Decrypting",filename,"...");

def get_notes(rsa_key, data):
	bin = rsa_key.decrypt(b64decode(data["key"]), "failed");
	if (bin == "failed"):
		print("Error decrypting", data["date"]);
		return "error";
	aes_key = bytearray.fromhex(bin.decode("utf-8"));
	iv = bytearray.fromhex(data["iv"]);
	cipher = b64decode(data["notes"]);
	plaintext = AES.new(aes_key, AES.MODE_CBC, iv=iv).decrypt(cipher);
	return unpad(plaintext, 16).decode("utf-8");

def get_rsa_key():
	with open("~/.ssh/id_rsa.pem", "r") as file:
		passphrase = getpass("Enter RSA private key passphrase: ");
		try:
			return PKCS1_v1_5.new(RSA.import_key(file.read(), passphrase));
		except:
			return False;

def find_illegal_dates(data):
	ill = {};
	seen = set();
	for day in data:
		date = day["date"];

		# check if date is duplicated
		if (date in seen):
			ill[date] = "duplicate";
		else:
			seen.add(date);

		# check if date is valid
		year = int(date[0:4]);
		month = int(date[5:7]);
		day = int(date[8:10]);
		try:
			datetime(year, month, day);
		except ValueError:
			ill[date] = "illegal";
	return ill;

key = get_rsa_key();
while (not key):
	print("Sorry, try again");
	key = get_rsa_key();

with open(filename, "r") as file:
	pixels = json.loads(file.read());

out = [];
for day in pixels:
	decrypted = {};
	decrypted["date"] = day["date"];
	decrypted["mood"] = day["mood"];
	decrypted["notes"] = get_notes(key, day);
	out.append(decrypted);

out.sort(key=lambda x: x["date"]);
illegals = find_illegal_dates(out);
if (illegals):
	print("Found",len(illegals),"illegal entries:",illegals);

with open(out_filename, "w") as file:
	file.write(json.dumps(out));

print("Done.");

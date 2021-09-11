"""Decrypt an encrypted pixels backup.

Usage: python3 decryptor.py <path/encrypted_input.json> <path/decrypted_output.json> <path/RSA_key.pem>

If the input is a directory, it will be searched for yyyy-mm-dd.json files, and
the latest one will be used.
"""
from Crypto.PublicKey import RSA
from Crypto.Cipher import AES
from Crypto.Cipher import PKCS1_v1_5
from Crypto.Util.Padding import unpad
from datetime import datetime  # check if date is valid
from base64 import b64decode
from getpass import getpass  # input() without console echo
import json
import sys  # command line arguments
import os  # check for file overwrite
import re  # search for files like 2021-03-01.json


class Options:
    verbose = False
    warnings = True
    overwrite = False
    verify = True
    input = "/shark/backups/pixels"
    output = "/tmp/pixels_decrypted.json"
    rsa_key = os.path.expanduser("~/.ssh/id_rsa.pem")

    def set(self, options):
        for option in options:
            name = option[0]
            value = option[1]
            if isinstance(value, str):
                value = os.path.expanduser("~")
            setattr(self, name, value)


options = Options()
params = [
    {
        "flags": ["-v", "--verbose"],
        "action": (lambda: options.set([("verbose", True)])),
        "description": "Print progress messages",
    },
    {
        "flags": ["-w", "--no-warnings"],
        "action": (lambda: options.set([("warnings", False)])),
        "description": "Disable warnings for duplicate and invalid entries",
    },
    {
        "flags": ["-q", "--quiet"],
        "action": (lambda: options.set([("warnings", False), ("overwrite", True)])),
        "description": "Same as -w -y",
    },
    {
        "flags": ["-y", "--overwrite"],
        "action": (lambda: options.set([("overwrite", True)])),
        "description": "Disable overwrite prompt and overwrite anyway.",
    },
    {
        "flags": ["-h", "--help"],
        "action": (lambda: None),
        "description": "Display help.",
    },
]
if len(sys.argv) == 1 or "--help" in sys.argv or "-h" in sys.argv:
    print(
        "Usage: python3 decryptor.py"
        + " <path/encrypted_input.json>"
        + " <path/decrypted_output.json>"
        + " <path/RSA_key.pem>"
        + "\n\n"
        + "Optional parameters:\n"
        + "\n".join(
            ["\t" + ", ".join(p["flags"]) + "\n\t\t" + p["description"] for p in params]
        )
    )
    exit()

if len(sys.argv) > 1 and sys.argv[1] != "-":
    options.input = sys.argv[1]

if len(sys.argv) > 2 and sys.argv[2] != "-":
    options.output = sys.argv[2]

if len(sys.argv) > 3 and sys.argv[3] != "-":
    options.rsa_key = sys.argv[3]

# trigger all flag parameters
for param in params:
    for flag in param["flags"]:
        if flag in sys.argv:
            param["action"]()
            break

# if input is a directory, search for the latest backup
if os.path.isdir(options.input):
    # get all files
    files = [f for f in os.listdir(options.input)]
    # filter directories
    files = [f for f in files if os.path.isfile(os.path.join(options.input, f))]
    # filter with regex
    files = [f for f in files if re.match(r"^\d\d\d\d-\d\d-\d\d.json$", f)]
    # sort, so the last element is the latest backup
    files.sort()
    options.input = os.path.join(options.input, files[-1])

# check for overwrite
if os.path.isfile(options.output) and not options.overwrite:
    yn = input(
        os.path.basename(options.output)
        + " already exists at "
        + os.path.dirname(options.output)
        + ". Overwrite? [y/N] "
    )
    if yn.lower() != "y":
        print("Abort.")
        exit()


def get_notes(rsa_key, data):
    if options.verbose:
        print(data["date"])

    bin = rsa_key.decrypt(b64decode(data["key"]), "failed")
    if bin == "failed":
        print("Error decrypting", data["date"])
        return "error"
    aes_key = bytearray.fromhex(bin.decode("utf-8"))
    iv = bytearray.fromhex(data["iv"])
    cipher = b64decode(data["notes"])
    plaintext = AES.new(aes_key, AES.MODE_CBC, iv=iv).decrypt(cipher)
    return unpad(plaintext, 16).decode("utf-8")


def get_rsa_key():
    with open(options.rsa_key, "r") as file:
        passphrase = getpass("Enter RSA private key passphrase: ")
        try:
            return PKCS1_v1_5.new(RSA.import_key(file.read(), passphrase))
        except:
            return False


def find_illegal_dates(data):
    ill = {}
    seen = set()
    for day in data:
        date = day["date"]

        # check if date is duplicated
        if date in seen:
            ill[date] = "duplicate"
        else:
            seen.add(date)

        # check if date is valid
        year = int(date[0:4])
        month = int(date[5:7])
        day = int(date[8:10])
        try:
            datetime(year, month, day)
        except ValueError:
            ill[date] = "illegal"
    return ill


key = get_rsa_key()
while not key:
    print("Sorry, try again.")
    key = get_rsa_key()

with open(options.input, "r") as file:
    pixels = json.loads(file.read())

if options.verbose:
    print(f"Decrypting {options.input} ...")

out = []
for day in pixels:
    decrypted = {}
    decrypted["date"] = day["date"]
    decrypted["mood"] = day["mood"]
    decrypted["notes"] = get_notes(key, day)
    out.append(decrypted)

if options.verbose:
    print(f"Decrypted {options.input}.")
    print("Sorting" + (" and verifying" if options.verify else "") + " ...")

out.sort(key=lambda x: x["date"])
if options.verify:
    illegals = find_illegal_dates(out)
    if illegals and options.warnings:
        print("WARNING: Found", len(illegals), "illegal entries:", illegals)

if options.verbose:
    print(f"Writing to {options.output} ...")

with open(options.output, "w") as file:
    file.write(json.dumps(out))

if options.verbose:
    print("Done.")

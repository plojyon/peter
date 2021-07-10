#!python3

# this script takes a pixels backup in the new format, and converts it to the old, simpler format
'''
input:
[
	{
		"date":"2021-02-31",
		"entries":[
			{
				"type":"Mood",
				"value":4,
				"notes":"....",
				"isHighlighted":false,
				"tags":[
					{
						"type":"Emotions",
						"entries":[
							"happiness",
							"nerves",
							"stress"
						]
					}
				]
			}
		]
	},
	...
]

output:
[
	{
		"date":"2019-01-11",
		"mood":2
		"notes":"...."
	},
	...
]
'''

import json
import sys # command line arguments

if (len(sys.argv) > 3) or ((len(sys.argv) > 1) and (sys.argv[1] == "--help")):
	print("Usage: "+sys.argv[0]+" <path/input.json> <path/output.json>");
	exit();

in_filename = sys.argv[1];
out_filename = sys.argv[2];

with open(in_filename, "r") as file:
	pixels = json.loads(file.read());

out = [];
for day in pixels:
	converted = {};
	converted["date"] = day["date"];

	# assert all data can be converted (no extra new-version data is present)
	if len(day["entries"]) != 1:
		print("Error:", day["date"], "has", len(day["entries"]), "entries. Skipped.");
		continue;
	if day["entries"][0]["type"] != "Mood":
		print("Error: entry type of ", day["date"], "is", day["entries"][0]["type"], ". Skipped.");
		continue;
	if day["entries"][0]["isHighlighted"]:
		print("Warning:", day["date"], "is highlighted.");
	if len(day["entries"][0]["tags"]) != 0:
		if len(day["entries"][0]["tags"]) > 1:
			print("Error:", day["date"], "has", len(day["entries"][0]["tags"]), "tags. Skipped.");
			continue;
		if day["entries"][0]["tags"][0]["type"] != "Emotions":
			print("Error:", day["date"], "has non-emotion tags. Skipped.");
			continue;
		print("Warning:", day["date"], "has", len(day["entries"][0]["tags"][0]["entries"]), "emotions that will be lost in the conversion.");

	converted["mood"] = day["entries"][0]["value"];
	converted["notes"] = day["entries"][0]["notes"];
	out.append(converted);

out.sort(key=lambda x: x["date"]);
with open(out_filename, "w") as file:
	file.write(json.dumps(out));

print("Saved to "+out_filename+".");

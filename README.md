# Beter

A bot to collect pixels data from Discord for centralised storage

Detects messages of the given format ...

```
yyyy-mm-dd
mood: [1-5]
Some long text here

yyyy-mm-dd
mood: [1-5]
Some other long text here

...
```

... encrypts them with the given RSA public key, and stores them in a file called `pixels.json` with the following structure ...

```
[
	{
		"date": "2021-05-02",
		"mood": 2,
		"notes": "7BEXrLjjPnzIRr6mZFoGz19WP1wGlyT+Svfjl86j5Oo=",
		"key": "mIE43AJU0EaE+K2+3hlOb9oJ0ssh1rkBCOig81KFKrxmCGgKzKzpU1JZVZWvQWKjg8tRsvwDyAfGaN9I961InzmqiNjmvrIPOqrjzT9/Nn52gC2mMfUDRzYHLo+OVzT6r2AWjEH8yBvq9RJUy1q/IrKq/prPlcSB+XjH+QvdKNeUHHhx1X4ei1VMH6cRq2B2nFXPF61/XcgSmV+PuenORP+f4rKE21eOKT8ipnP75VV2ewA68O1Q4t1jakteGSgUvdMzGDqUKGtS04rmdzz6Ou9HKbK/aDaZ2iTEkGOugslIakj73Jn7brWZO7ZbsReOgqglu6LUAV04y2vaqB7t1A==",
		"iv": "185d72588b7f746bf1e0847f66921506"
	},
	{
		"date": "2021-05-03",
		"mood": 3,
		"notes": "RW5vTrG4YdEWxRXOcolNGKdwlpd3L9ojOufCvl8qUSM=",
		"key": "v7hFsdDFe+v7TkNq+0lUmtglxM+aSdYJyeOAsO6G9JEsX8+d1S/O7i8j6X1Qy2eSNrsmtIVsbn3WALSY/QThRs2k0fYvqddB970uirYGHfYKaUJGezv8ukxBWRAYyH1RSLPiSRVMo+LpM7g/pzLEm4xLeyFq64IRtLCuHekopgpuiwVjjNqRmIYS9w59TfOff3mgmjlUPLSip54S+LkRO9livVDQZEDMHtCFN18wehMdr11Zw35CeLYLkoI/y+a7NhLnNbE6r1VUJviZ7c2frgSCXm5+90DduLbuh4Qpt/AtjLrVd8SW2LW4ZL61oKnSLwpM4fXSLEJm9NTxpuZv3Q==",
		"iv": "13c527e96a74b449f10fe1973718cf61"
	}
]
```

To decrypt with openssl, first decrypt the key with your RSA private key:

`echo -ne "<key_b64>" | base64 -d | openssl rsautl -decrypt -inkey ~/.ssh/id_rsa.pem`

Then decrypt the message with

`echo -ne "<notes_b64>" | base64 -d | openssl aes-256-cbc -d -iv <iv_hex> -K <key_hex>`


Requires the following `.env` variables:

```
CLIENT_SECRET=
CLIENT_ID=my-client
ADMIN_ID=356393895216545803
PREFIX=+
RSA_PUBLIC=-----BEGIN RSA PUBLIC KEY-----\nkeykeykeykeykey\n-----END RSA PUBLIC KEY-----
```

Where the newlines in RSA_PUBLIC are replaced with a literal "\\n"

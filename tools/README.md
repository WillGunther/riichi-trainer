# Tenhou Problem Tools

Use `Apricot-S/houou-logs` outside this repo to download and validate Houou/Phoenix logs. Tenhou logs and exported XML must stay local; do not commit downloaded DBs, XML files, or raw archives.

Typical local flow:

```sh
uv run tools/tenhou-problems.py --inspect --houou-db path/to/houou.db
uv run tools/tenhou-problems.py --houou-db path/to/houou.db --count 30 --seed 1 --out src/problems.json
```

The tool can also read exported XML files:

```sh
uv run tools/tenhou-problems.py --inspect --xml-dir path/to/exported/xml
```

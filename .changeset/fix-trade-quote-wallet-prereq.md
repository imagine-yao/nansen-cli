---
"nansen-cli": patch
---

fix: surface wallet prerequisite in `trade quote` help text and schema

`nansen trade quote` requires a configured wallet (the trading API builds a transaction specific to the sender address), but this was not communicated until the command failed. Adds a PREREQUISITE section to the usage text and a `prerequisites` field to the schema so agents can discover this requirement before running the command.

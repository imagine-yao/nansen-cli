---
"nansen-cli": patch
---

fix(token): replace dead `--days` param with working `--timeframe` for `token flow-intelligence`

The `--days` option was accepted but never sent to the API, resulting in always fetching `1d` data. This replaces it with `--timeframe` (enum: `1h | 6h | 12h | 1d | 7d`, default `1d`) which maps correctly to the API parameter.

---
"nansen-cli": patch
---

Add `--webhook <url>` and `--webhook-secret <secret>` flags to `alerts create` and `alerts update`.

Allows alerts to be delivered to any HTTP/HTTPS endpoint via POST, alongside
the existing `--telegram`, `--slack`, and `--discord` channels. The optional
`--webhook-secret` enables HMAC payload signing for verification.

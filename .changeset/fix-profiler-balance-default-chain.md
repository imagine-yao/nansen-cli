---
"nansen-cli": patch
---

fix: default `profiler balance` chain to `'all'` instead of `'ethereum'`

Previously, `nansen profiler balance --address <addr>` without `--chain` defaulted to `ethereum`, returning empty results for wallets with no ETH mainnet holdings (e.g. Base-only or Solana-only wallets). Now defaults to `'all'`, letting the API auto-route based on address format.

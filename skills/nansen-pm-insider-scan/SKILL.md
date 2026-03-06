---
name: nansen-pm-insider-scan
description: "Scan a resolved Polymarket market for wallets exhibiting suspicious trading patterns: fresh funding, single-market focus, extreme ROI, late entry at high prices."
---

# PM Suspicious Wallet Scanner

**Answers:** "Are there wallets with suspicious trading patterns in this Polymarket market?"

```bash
# Find the market ID for a resolved market
nansen research prediction-market market-screener --query "<market name>" --status closed --limit 5
# → market_id, question, volume, last_trade_price

# Run the scanner (stdout: JSON, stderr: progress)
node scripts/pm-insider-scan.js --market-id <market_id> --limit 20 --days 7
# → success, data.suspects[].address, score, flags[], details.roiPct, details.invested, details.pnl, details.distinctMarkets, details.walletAge

# Deep-dive on a flagged wallet (use proxyAddress for PM trades, address for on-chain)
PROXY=<suspect_proxyAddress>
nansen research prediction-market trades-by-address --address $PROXY --limit 20
# → timestamp, market_question, taker_action, side, size, price, usdc_value

nansen research prediction-market pnl-by-address --address $PROXY --limit 10
# → question, side_held, net_buy_cost_usd, total_pnl_usd, market_resolved

ADDR=<suspect_address>
nansen research profiler labels --address $ADDR --chain polygon
# → label, category

nansen research profiler historical-balances --address $ADDR --chain polygon --days 90
# → block_timestamp, token_symbol, value_usd
```

Scoring flags: NEW_WALLET (3), YOUNG_WALLET (1), SINGLE_MARKET (3), FEW_MARKETS (1), EXTREME_ROI (3), HIGH_ROI (2), LATE_ENTRY (2), LARGE_POSITION (2), KNOWN_ENTITY (-2). Flagged at score >= 3, high risk at >= 7.

High-confidence suspicious pattern: NEW_WALLET + SINGLE_MARKET + EXTREME_ROI (score 9+). Use `--status closed` on the screener for resolved markets.

---
name: nansen-token-screener
description: "Discover trending tokens — screener, SM holdings, Nansen indicators, and flow intelligence for promising finds. Use when scanning for new tokens or screening what's hot."
metadata:
  openclaw:
    requires:
      env:
        - NANSEN_API_KEY
      bins:
        - nansen
    primaryEnv: NANSEN_API_KEY
    install:
      - kind: node
        package: nansen-cli
        bins: [nansen]
allowed-tools: Bash(nansen:*)
---

# Token Discovery

**Answers:** "What tokens are trending and worth a deeper look?"

```bash
CHAIN=solana

# Screen top tokens by volume
nansen research token screener --chain $CHAIN --timeframe 24h --limit 20
# → token_symbol, price_usd, price_change, volume, buy_volume, market_cap_usd, fdv, liquidity, token_age_days

# Smart money only
nansen research token screener --chain $CHAIN --timeframe 24h --smart-money --limit 20

# Search within screener results (client-side filter)
nansen research token screener --chain $CHAIN --search "bonk"

# Smart money holdings — what SM wallets are holding
nansen research smart-money holdings --chain $CHAIN --labels "Smart Trader" --limit 20
# → token_symbol, value_usd, holders_count, balance_24h_percent_change, share_of_holdings_percent

# Nansen indicators for a specific token
TOKEN=<address>
nansen research token indicators --token $TOKEN --chain $CHAIN
# → risk_indicators, reward_indicators (each with score, signal, signal_percentile)

# Flow intelligence — only use for promising tokens from screener/indicators above
nansen research token flow-intelligence --token $TOKEN --chain $CHAIN
# → net_flow_usd per label: smart_trader, whale, exchange, fresh_wallets, public_figure

# Nansen Score Top Tokens — "what should I buy?" (internal, @nansen.ai only)
# Use this FIRST for discovery, then drill into individual tokens with `indicators` above
nansen research token top-tokens --limit 25
nansen research token top-tokens --market-cap largecap --limit 10
# → token_symbol, chain, performance_score, risk_score, plus per-indicator contribution fields
```

Screener timeframes: `5m`, `10m`, `1h`, `6h`, `24h`, `7d`, `30d`

Indicators: score is "bullish"/"bearish"/"neutral". signal_percentile > 70 = historically significant. Some tokens return empty indicators — not an error.

Top tokens: performance_score >= 15 means buy candidate. risk_score > 0 means safer. Use `--market-cap` to filter by lowcap/midcap/largecap. Then use `indicators` on individual tokens for the full breakdown.

Flow intelligence is credit-heavy. Use it to confirm SM conviction on tokens that already look promising from screener + indicators, not as a first pass on every token.

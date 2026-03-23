# Nansen CLI

[![npm version](https://img.shields.io/npm/v/nansen-cli.svg)](https://www.npmjs.com/package/nansen-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **Built by agents, for agents.** Command-line interface for the [Nansen API](https://docs.nansen.ai), designed for AI agents.

## Installation

```bash
npm install -g nansen-cli
npx skills add nansen-ai/nansen-cli  # load agent skill files
```

## Auth

```bash
nansen login --api-key <key>   # save key to ~/.nansen/config.json
nansen login --human           # interactive prompt
export NANSEN_API_KEY=...      # env var (highest priority)
nansen logout                  # remove saved key
```

Get your API key at [app.nansen.ai/auth/agent-setup](https://app.nansen.ai/auth/agent-setup).

## Commands

```
nansen research <category> <subcommand> [options]
nansen trade <subcommand> [options]
nansen wallet <subcommand> [options]
nansen schema [command] [--pretty]    # full command reference (no API key needed)
```

**Research categories:** `smart-money` (`sm`), `token` (`tgm`), `profiler` (`prof`), `portfolio` (`port`), `prediction-market` (`pm`), `search`, `perp`, `points`

**Trade:** `quote`, `execute` — DEX swaps on Solana and Base.

**Wallet:** `create`, `list`, `show`, `export`, `default`, `delete`, `send` — local or Privy server-side wallets (EVM + Solana).

Run `nansen schema --pretty` for the full subcommand and field reference.

## Trading

Two-step flow: **quote** then **execute**. Supported chains: `solana`, `base`.

```bash
# Step 1: Get a quote (amounts in base units — lamports, wei)
nansen trade quote --chain solana --from SOL --to USDC --amount 1000000000
nansen trade quote --chain base --from ETH --to USDC --amount 1000000000000000000

# Step 2: Execute the quote
nansen trade execute --quote <quoteId>
```

| Option | Description |
|--------|-------------|
| `--chain <chain>` | `solana` or `base` |
| `--from <symbol\|address>` | Input token (`SOL`, `USDC`, or raw address) |
| `--to <symbol\|address>` | Output token |
| `--amount <units>` | Amount in **base units** (lamports, wei) |
| `--wallet <name>` | Wallet to use (default: default wallet) |
| `--slippage <pct>` | Slippage tolerance as decimal (e.g. `0.03` for 3%) |
| `--auto-slippage` | Auto slippage calculation |
| `--swap-mode <mode>` | `exactIn` (default) or `exactOut` |
| `--quote <id>` | Quote ID (for `execute`) |
| `--no-simulate` | Skip pre-broadcast simulation (for `execute`) |

Common symbols resolve automatically: `SOL`, `ETH`, `USDC`, `USDT`, `WETH`, `WSOL`.

> A wallet is required even for quotes — the trading API builds transactions specific to the sender address.

## Wallet

### Local wallets (default)

```bash
nansen wallet create --name my-wallet              # generates EVM + Solana keypair
nansen wallet list                                  # list all wallets
nansen wallet show <name>                           # show addresses
nansen wallet export <name>                         # export private keys
nansen wallet default <name>                        # set default wallet
nansen wallet send --wallet <name> --to <addr> --amount <n> --chain <chain>
nansen wallet delete <name>
```

Local wallets are encrypted with a password (AES-256-GCM + scrypt). Set `NANSEN_WALLET_PASSWORD` to avoid interactive prompts.

### Privy wallets (server-side)

Server-side wallets via [Privy](https://www.privy.io) — no password, no local key storage. Ideal for agents.

```bash
nansen wallet create --name agent-wallet --provider privy
```

**Required env vars:**

| Variable | Description |
|----------|-------------|
| `PRIVY_APP_ID` | Privy application ID |
| `PRIVY_APP_SECRET` | Privy application secret |

Get credentials at [dashboard.privy.io](https://dashboard.privy.io). Or set `NANSEN_WALLET_PROVIDER=privy` to default all `wallet create` calls to Privy.

Privy wallets work with all commands (`trade`, `send`, `list`, `show`, `delete`). The CLI detects the provider automatically.

## Key Options

| Option | Description |
|--------|-------------|
| `--chain <chain>` | Blockchain to query |
| `--limit <n>` | Result count |
| `--timeframe <tf>` | Time window: `5m` `1h` `6h` `24h` `7d` `30d` |
| `--fields <list>` | Comma-separated fields (reduces response size) |
| `--sort <field:dir>` | Sort results, e.g. `--sort value_usd:desc` |
| `--pretty` | Human-readable JSON |
| `--table` | Table format |
| `--stream` | NDJSON output for large results |
| `--labels <label>` | Smart Money label filter |
| `--smart-money` | Filter for Smart Money addresses only |

## Supported Chains

`ethereum` `solana` `base` `bnb` `arbitrum` `polygon` `optimism` `avalanche` `linea` `scroll` `mantle` `ronin` `sei` `plasma` `sonic` `monad` `hyperevm` `iotaevm`

> Run `nansen schema` to get the current chain list (source of truth).

## Agent Tips

**Reduce token burn with `--fields`:**
```bash
nansen research smart-money netflow --chain solana --fields token_symbol,net_flow_usd --limit 10
```

**Use `--stream` for large results** — outputs NDJSON instead of buffering a giant array.

**ENS names** work anywhere `--address` is accepted: `--address vitalik.eth`

## Output Format

```json
{ "success": true,  "data": <api_response> }
{ "success": false, "error": "message", "code": "ERROR_CODE", "status": 401 }
```

**Critical error codes:**

| Code | Action |
|------|--------|
| `CREDITS_EXHAUSTED` | Stop all API calls immediately. Check [app.nansen.ai](https://app.nansen.ai). |
| `UNAUTHORIZED` | Wrong or missing key. Re-auth. |
| `RATE_LIMITED` | Auto-retried by CLI. |
| `UNSUPPORTED_FILTER` | Remove the filter and retry. |

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `command not found` | `npm install -g nansen-cli` |
| `UNAUTHORIZED` after login | `cat ~/.nansen/config.json` or set `NANSEN_API_KEY` |
| Empty perp results | Use `--symbol BTC`, not `--token`. Perps are Hyperliquid-only. |
| `UNSUPPORTED_FILTER` on token holders | Remove `--smart-money` — not all tokens have that data. |
| Huge JSON response | Use `--fields` to select columns. |

## Development

```bash
npm test              # mocked tests, no API key needed
npm run test:live     # live API (needs NANSEN_API_KEY)
```

See [AGENTS.md](AGENTS.md) for architecture and contributor guidance.

## License

[MIT](LICENSE) © [Nansen](https://nansen.ai)

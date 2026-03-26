---
name: nansen-agent-guide
description: Routing guide — when to use `nansen agent` (AI research) vs direct CLI data commands. Use when deciding how to answer a user's research question with Nansen tools.
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

# Agent vs CLI Routing Guide

## The Core Rule

| When you need... | Use... |
|-----------------|--------|
| A **take** (analysis, interpretation, expert perspective) | `nansen agent` |
| A **table** (raw data, structured output, specific metrics) | Direct CLI commands |
| A **report** (analysis + supporting data) | Both -- agent for narrative, CLI for data |

## When to Use `nansen agent`

Use `nansen agent "your question"` when:

- The question requires **interpretation** -- "what does this signal mean?", "is this wallet smart money?"
- The answer needs **cross-tool synthesis** -- combining token data, wallet data, market context
- You want **expert-mode analysis** -- the agent has domain knowledge about Nansen labels, smart money behavior, market patterns
- The question is open-ended or research-style -- "analyse this wallet", "what's happening with ETH smart money?"

```bash
nansen agent "What are top smart money tokens on Solana today and why?"
nansen agent "Analyse wallet 0x123... and tell me if this is a smart trader"
nansen agent "Is the current ETH netflow bullish or bearish?"

# Expert mode (deeper analysis, higher cost)
nansen agent "What are top smart money tokens on Solana today and why?" --expert
```

**Cost:** 200 credits (fast mode) or 600 credits (expert mode)

## When to Use Direct CLI Commands

Use CLI data commands when:

- You need **specific structured data** -- prices, volumes, top holders, flow numbers
- You want to **pipe into another tool** -- `| jq`, scripts, downstream processing
- The question is deterministic -- "give me top 10 tokens by netflow on ethereum"
- You need **raw numbers** for calculation or comparison
- You're building a report and need supporting data tables

```bash
# Raw token screener data
nansen research token screener --chain ethereum --smart-money --limit 20

# Specific wallet data
nansen research profiler balance --address 0x123... --chain ethereum

# Flow data for a token
nansen research token flows --token-address 0xabc... --chain ethereum

# Smart money netflow
nansen research smart-money netflow --chain solana --limit 10
```

**Cost:** 5-50 credits per call depending on endpoint

## Orchestrator Pattern (Best of Both)

For complex research questions, use the **orchestrator model**:

1. **Break the question** into sub-questions
2. **Route each** to the right tool:
   - Research sub-questions -> `nansen agent`
   - Data fetching -> direct CLI
   - News/context -> `nansen web search` or `nansen web fetch`
   - Prediction market signals -> `nansen research pm`
3. **Combine** the outputs into a final answer

**Example orchestration:**
```
User: "Should I buy ETH right now?"

-> nansen agent "What is the current smart money sentiment on ETH?" (interpretation)
-> nansen research smart-money netflow --chain ethereum (raw flow data)
-> nansen research token screener --chain ethereum --smart-money (top SM tokens)
-> nansen web search "ETH price catalyst today" (news context)
-> Combine into final answer
```

## Credit Costs

Check endpoint costs before deciding:
```bash
nansen research token screener --help
nansen agent --help
```

**Rule of thumb:**
- `nansen agent` = expensive but high-value (200-600 credits)
- Direct CLI = cheap, precise, structured (5-50 credits)
- For bulk automation, prefer CLI; for one-shot analysis, agent is worth it

## Anti-patterns

- **Don't use agent for simple data fetches** -- `nansen agent "what is the ETH price?"` costs 200 credits for something `nansen research token screener` does for 5
- **Don't use raw CLI for open-ended analysis** -- CLI returns structured JSON but can't synthesize meaning
- **Don't chain too many agent calls** -- 3+ agent calls in sequence = 600-1800 credits. Use CLI to get raw data, call agent once with all the data for synthesis
- **Do use `--json` for CLI output** when piping to agent or processing programmatically

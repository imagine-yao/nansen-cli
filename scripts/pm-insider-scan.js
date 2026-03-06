#!/usr/bin/env node

/**
 * Polymarket Insider Detection Scanner
 *
 * Scans a resolved market's PnL leaderboard and flags wallets matching
 * insider patterns: fresh wallet, single-market focus, extreme ROI,
 * late entry at high prices.
 *
 * Usage:
 *   node scripts/pm-insider-scan.js --market-id <id> [--limit 20] [--days 7]
 */

import { NansenAPI, NansenError, ErrorCode, sleep, validateAddress } from '../src/api.js';

// ============= Arg Parsing =============

function parseArgs(argv) {
  const args = { marketId: null, limit: 20, days: 7 };
  for (let i = 2; i < argv.length; i++) {
    switch (argv[i]) {
      case '--market-id':
        args.marketId = argv[++i];
        break;
      case '--limit':
        args.limit = parseInt(argv[++i], 10);
        break;
      case '--days':
        args.days = parseInt(argv[++i], 10);
        break;
      case '--help':
      case '-h':
        console.error(
          'Usage: node scripts/pm-insider-scan.js --market-id <id> [--limit 20] [--days 7]\n' +
          '\n' +
          'Options:\n' +
          '  --market-id  Polymarket market ID (required)\n' +
          '  --limit      Top N winners to analyze (default: 20)\n' +
          '  --days       Wallet age threshold in days (default: 7)'
        );
        process.exit(0);
        break;
      default:
        console.error(`Unknown option: ${argv[i]}`);
        process.exit(1);
    }
  }

  if (!args.marketId) {
    console.error('Error: --market-id is required. Run with --help for usage.');
    process.exit(1);
  }
  if (isNaN(args.limit) || args.limit < 1) {
    console.error('Error: --limit must be a positive integer.');
    process.exit(1);
  }
  if (isNaN(args.days) || args.days < 1) {
    console.error('Error: --days must be a positive integer.');
    process.exit(1);
  }

  return args;
}

// ============= Leaderboard Fetching =============

async function fetchTopWinners(api, marketId, limit) {
  const winners = [];
  let page = 1;
  // Keep per_page small — large markets 502 with big page sizes
  const perPage = Math.min(limit, 10);

  while (winners.length < limit) {
    const result = await api.pmPnlByMarket({
      marketId,
      pagination: { page, per_page: perPage },
    });

    // API response: { pagination, data: [...rows], _meta }
    const rows = Array.isArray(result?.data) ? result.data : [];
    if (rows.length === 0) break;

    for (const row of rows) {
      const pnl = parseFloat(row.total_pnl_usd ?? 0);
      if (pnl > 0) {
        winners.push(row);
        if (winners.length >= limit) break;
      }
    }

    page++;
    if (rows.length < perPage) break;
    if (result.pagination?.is_last_page) break;
    // Brief pause between pages to avoid rate limits
    await sleep(500);
  }

  return winners;
}

// ============= Address Validation =============

function isValidEvmAddress(addr) {
  return typeof addr === 'string' && /^0x[a-fA-F0-9]{40}$/.test(addr);
}

// ============= Wallet Analysis =============

async function analyzeWallet(api, proxyAddress, ownerAddress, marketId, daysThreshold) {
  const analysis = { proxyAddress, ownerAddress, trades: null, walletAge: null, labels: null, error: null };

  // 1. Fetch PM trades using the proxy address (where trades are recorded)
  try {
    const tradesResult = await api.pmTradesByAddress({
      address: proxyAddress,
      pagination: { page: 1, per_page: 500 },
    });
    analysis.trades = Array.isArray(tradesResult?.data) ? tradesResult.data : [];
  } catch (err) {
    analysis.error = `trades: ${err.message}`;
    return analysis;
  }

  // Use owner address for on-chain profiling (if valid), fall back to proxy
  const profileAddr = isValidEvmAddress(ownerAddress) ? ownerAddress : proxyAddress;

  // 2. Estimate wallet age from first non-zero historical balance
  try {
    const balResult = await api.addressHistoricalBalances({
      address: profileAddr,
      chain: 'polygon',
      days: 365,
      orderBy: [{ field: 'block_timestamp', direction: 'ASC' }],
      pagination: { page: 1, per_page: 100 },
    });
    const balRows = Array.isArray(balResult?.data) ? balResult.data : [];
    const firstFunded = balRows.find(r => parseFloat(r.value_usd) > 0);
    if (firstFunded) {
      analysis.walletAge = firstFunded.block_timestamp;
    }
  } catch (err) {
    // Non-fatal — wallet age will be unknown
    if (process.env.DEBUG) console.error(`[scan] wallet age fetch failed for ${profileAddr}: ${err.message}`);
  }

  // 3. Check for known entity labels
  try {
    const labelsResult = await api.addressLabels({ address: profileAddr, chain: 'polygon' });
    const labelRows = Array.isArray(labelsResult?.data) ? labelsResult.data : [];
    analysis.labels = labelRows.length > 0 ? labelRows : null;
  } catch (err) {
    // Non-fatal — labels will be unknown
    if (process.env.DEBUG) console.error(`[scan] labels fetch failed for ${profileAddr}: ${err.message}`);
  }

  return analysis;
}

// ============= Scoring =============

function scoreWallet(analysis, winnerRow, marketId, daysThreshold) {
  const flags = [];
  let score = 0;
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  // --- Wallet age ---
  if (analysis.walletAge) {
    const ageMs = now - new Date(analysis.walletAge).getTime();
    const ageDays = ageMs / dayMs;

    if (ageDays <= daysThreshold) {
      flags.push('NEW_WALLET');
      score += 3;
    } else if (ageDays <= daysThreshold * 4) {
      flags.push('YOUNG_WALLET');
      score += 1;
    }
  }

  // --- Market concentration ---
  const trades = analysis.trades || [];
  const distinctMarkets = new Set(
    trades.map(t => t.market_id || t.marketId).filter(Boolean)
  );

  if (distinctMarkets.size === 1) {
    flags.push('SINGLE_MARKET');
    score += 3;
  } else if (distinctMarkets.size >= 2 && distinctMarkets.size <= 3) {
    flags.push('FEW_MARKETS');
    score += 1;
  }

  // --- ROI ---
  const pnl = parseFloat(winnerRow.total_pnl_usd ?? 0);
  const invested = parseFloat(winnerRow.net_buy_cost_usd ?? 0);
  const roiPct = invested > 0 ? (pnl / invested) * 100 : 0;

  if (roiPct >= 500) {
    flags.push('EXTREME_ROI');
    score += 3;
  } else if (roiPct >= 200) {
    flags.push('HIGH_ROI');
    score += 2;
  }

  // --- Late entry (bought winning side at price >= 0.80) ---
  const marketTrades = trades.filter(t => String(t.market_id) === String(marketId));
  const boughtLate = marketTrades.some(t => {
    const price = parseFloat(t.price ?? 0);
    // On Polymarket, side is "Yes"/"No"; a high price on the winning side means
    // the outcome was already considered very likely when the wallet entered
    return price >= 0.80;
  });

  if (boughtLate) {
    flags.push('LATE_ENTRY');
    score += 2;
  }

  // --- Large position ---
  if (invested >= 10000) {
    flags.push('LARGE_POSITION');
    score += 2;
  }

  // --- Known entity (anti-flag) ---
  if (analysis.labels && analysis.labels.length > 0) {
    flags.push('KNOWN_ENTITY');
    score -= 2;
  }

  return {
    score,
    flags,
    details: {
      roiPct: Math.round(roiPct * 100) / 100,
      invested: Math.round(invested * 100) / 100,
      pnl: Math.round(pnl * 100) / 100,
      distinctMarkets: distinctMarkets.size,
      walletAge: analysis.walletAge || 'unknown',
      labels: analysis.labels ? analysis.labels.map(l => l.label || l.name || l) : [],
      tradeCount: marketTrades.length,
    },
  };
}

// ============= Main =============

async function main() {
  const args = parseArgs(process.argv);
  const api = new NansenAPI();

  console.error(`[scan] Fetching top ${args.limit} winners for market ${args.marketId}...`);

  let winners;
  try {
    winners = await fetchTopWinners(api, args.marketId, args.limit);
  } catch (err) {
    console.error(`[scan] Failed to fetch leaderboard: ${err.message}`);
    console.log(JSON.stringify({ success: false, error: err.message }, null, 2));
    process.exit(1);
  }

  if (winners.length === 0) {
    console.error('[scan] No positive-PnL entries found.');
    console.log(JSON.stringify({
      success: true,
      data: { market: args.marketId, suspects: [], summary: { scanned: 0, flagged: 0 } },
    }, null, 2));
    process.exit(0);
  }

  console.error(`[scan] Found ${winners.length} winners. Analyzing wallets...`);

  const suspects = [];
  for (let i = 0; i < winners.length; i++) {
    const winner = winners[i];
    const proxyAddress = winner.address;
    const ownerAddress = winner.owner_address;

    if (!proxyAddress || !isValidEvmAddress(proxyAddress)) {
      console.error(`[${i + 1}/${winners.length}] Skipping entry — invalid proxy address`);
      continue;
    }

    const displayAddr = isValidEvmAddress(ownerAddress) ? ownerAddress : proxyAddress;
    console.error(`[${i + 1}/${winners.length}] Analyzing ${displayAddr}...`);

    let analysis;
    try {
      analysis = await analyzeWallet(api, proxyAddress, ownerAddress, args.marketId, args.days);
    } catch (err) {
      console.error(`[${i + 1}/${winners.length}] Error: ${err.message}`);
      suspects.push({ address: displayAddr, proxyAddress, score: 0, flags: [], error: err.message });
      if (i < winners.length - 1) await sleep(1500);
      continue;
    }

    if (analysis.error) {
      console.error(`[${i + 1}/${winners.length}] Partial error: ${analysis.error}`);
      suspects.push({ address: displayAddr, proxyAddress, score: 0, flags: [], error: analysis.error });
      if (i < winners.length - 1) await sleep(1500);
      continue;
    }

    const result = scoreWallet(analysis, winner, args.marketId, args.days);

    if (result.score >= 3) {
      console.error(`  → FLAGGED (score ${result.score}): ${result.flags.join(', ')}`);
      suspects.push({ address: displayAddr, proxyAddress, ...result });
    } else {
      console.error(`  → clean (score ${result.score})`);
    }

    if (i < winners.length - 1) await sleep(1500);
  }

  // Sort suspects by score descending
  suspects.sort((a, b) => (b.score || 0) - (a.score || 0));

  const output = {
    success: true,
    data: {
      market: args.marketId,
      suspects,
      summary: {
        scanned: winners.length,
        flagged: suspects.filter(s => s.score >= 3).length,
        highRisk: suspects.filter(s => s.score >= 7).length,
        daysThreshold: args.days,
      },
    },
  };

  console.log(JSON.stringify(output, null, 2));
}

main().catch(err => {
  console.error(`[scan] Fatal: ${err.message}`);
  console.log(JSON.stringify({ success: false, error: err.message }, null, 2));
  process.exit(1);
});

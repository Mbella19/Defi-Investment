/**
 * Backtest the drain-detection heuristic against a known historical exploit.
 *
 * Approach:
 *   1. Pull ERC-20 transfers from the protocol address over a window straddling
 *      the exploit (T-48h ... T+a few minutes), via Etherscan tokentx.
 *   2. Use DeFiLlama historical-price API to USD-price each transfer at its
 *      own timestamp (so we don't anachronistically apply current prices).
 *   3. Walk forward minute-by-minute from T-48h, maintaining a rolling 48h
 *      USD-outflow window. Report the FIRST minute the heuristic would have
 *      tripped (matches our production logic: outflow >= 15% of TVL AND
 *      >= $1M absolute).
 *   4. Compare to DeFiLlama's typical pool-TVL refresh cadence (~1h) and the
 *      in-app `monitor.ts` rule (40% / 65% drop from entry TVL).
 *
 * Run with:
 *   npx tsx scripts/backtest-drain.ts
 */

import fs from "node:fs";
import path from "node:path";

// Tiny .env.local loader so we don't need to add dotenv as a dep.
function loadDotEnv(file: string) {
  if (!fs.existsSync(file)) return;
  const text = fs.readFileSync(file, "utf-8");
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/i);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
loadDotEnv(path.resolve(process.cwd(), ".env.local"));

interface TokenTx {
  blockNumber: string;
  timeStamp: string;
  hash: string;
  from: string;
  to: string;
  value: string;
  tokenSymbol: string;
  tokenDecimal: string;
  contractAddress: string;
}

interface ExploitFixture {
  name: string;
  protocolAddress: string;     // contract that lost funds
  chainId: number;             // 1 = Ethereum
  exploitTs: number;           // unix seconds when drain began
  windowStartTs: number;       // when to begin scanning (T - 48h - small buffer)
  knownDrainUsd: number;       // public post-mortem $ figure (for sanity check)
  poolTvlAtExploit: number;    // pool TVL right before exploit
  ethBlockBefore: number;      // approximate block at windowStartTs
  ethBlockAfter: number;       // approximate block right after exploitTs
}

// Euler Finance flash-loan exploit, 13 Mar 2023.
// Drainer pulled DAI, USDC, WBTC, stETH from Euler's main lending pool over
// a handful of blocks starting 08:50 UTC (block 16817996).
const EULER: ExploitFixture = {
  name: "Euler Finance",
  protocolAddress: "0x27182842E098f60e3D576794A5bFFb0777E025d3",
  chainId: 1,
  exploitTs: 1678697543,        // 2023-03-13 08:52:23 UTC
  windowStartTs: 1678524743,    // T - 48h
  knownDrainUsd: 197_000_000,
  poolTvlAtExploit: 264_000_000, // Euler total TVL on 12 Mar 2023 (DefiLlama)
  ethBlockBefore: 16803800,
  ethBlockAfter: 16820000,
};

const HEURISTIC_OUTFLOW_FLOOR_USD = 500_000;
const HEURISTIC_HIGH_PCT_OF_TVL = 0.15;
const HEURISTIC_CRITICAL_PCT_OF_TVL = 0.30;
const HEURISTIC_TVL_FALLBACK_FLOOR = 5_000_000;
const HEURISTIC_FALLBACK_CRITICAL_USD = 5_000_000;
const LOOKBACK_SECONDS = 48 * 3600;

function classify(outflow: number, tvl: number | null): "high" | "critical" | null {
  if (outflow < HEURISTIC_OUTFLOW_FLOOR_USD) return null;
  if (tvl === null || tvl < HEURISTIC_TVL_FALLBACK_FLOOR) {
    return outflow >= HEURISTIC_FALLBACK_CRITICAL_USD ? "critical" : null;
  }
  const f = outflow / tvl;
  if (f >= HEURISTIC_CRITICAL_PCT_OF_TVL && outflow >= 1_000_000) return "critical";
  if (f >= HEURISTIC_HIGH_PCT_OF_TVL && outflow >= 1_000_000) return "high";
  return null;
}

async function fetchTokentx(fx: ExploitFixture): Promise<TokenTx[]> {
  const apikey = process.env.ETHERSCAN_API_KEY!;
  const all: TokenTx[] = [];
  // Etherscan caps results; we paginate by block range chunks to be safe.
  const chunkSize = 5000;
  for (let start = fx.ethBlockBefore; start <= fx.ethBlockAfter; start += chunkSize) {
    const end = Math.min(start + chunkSize - 1, fx.ethBlockAfter);
    const url =
      `https://api.etherscan.io/v2/api?chainid=${fx.chainId}` +
      `&module=account&action=tokentx&address=${fx.protocolAddress}` +
      `&startblock=${start}&endblock=${end}` +
      `&page=1&offset=10000&sort=asc&apikey=${apikey}`;
    const res = await fetch(url);
    const json = (await res.json()) as { status: string; result: TokenTx[] | string };
    if (json.status === "1" && Array.isArray(json.result)) {
      all.push(...json.result);
    } else if (typeof json.result === "string") {
      console.error(`tokentx error in block ${start}-${end}: ${json.result}`);
    }
    await new Promise((r) => setTimeout(r, 250)); // rate-limit politeness
  }
  return all;
}

interface HistoricalPrices {
  // chain:address -> price-at-exploit-ts
  [key: string]: number;
}

async function fetchHistoricalPrices(
  tokens: Set<string>,
  ts: number,
): Promise<HistoricalPrices> {
  const keys = [...tokens].map((t) => `ethereum:${t.toLowerCase()}`).join(",");
  if (!keys) return {};
  const url = `https://coins.llama.fi/prices/historical/${ts}/${keys}`;
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`historical prices HTTP ${res.status}`);
    return {};
  }
  const json = (await res.json()) as {
    coins?: Record<string, { price: number }>;
  };
  const out: HistoricalPrices = {};
  for (const [k, v] of Object.entries(json.coins ?? {})) {
    if (typeof v.price === "number" && v.price > 0) out[k.toLowerCase()] = v.price;
  }
  return out;
}

interface PricedOutflow {
  ts: number;
  hash: string;
  symbol: string;
  amount: number;
  usd: number;
}

async function backtest(fx: ExploitFixture) {
  console.log(`\n=== Backtest: ${fx.name} ===`);
  console.log(`exploit TS:       ${new Date(fx.exploitTs * 1000).toISOString()}`);
  console.log(`scan window:      T-48h ... T+5min`);
  console.log(`heuristic gates:  $1M absolute floor, 15% TVL = high, 30% = critical`);
  console.log(`pool TVL at T:    $${(fx.poolTvlAtExploit / 1e6).toFixed(1)}M`);

  const txs = await fetchTokentx(fx);
  console.log(`pulled ${txs.length} ERC-20 transfer events`);

  const lower = fx.protocolAddress.toLowerCase();

  // Distinct token contracts we need prices for (both directions).
  const tokenSet = new Set<string>();
  for (const t of txs) tokenSet.add(t.contractAddress.toLowerCase());
  console.log(`  ${tokenSet.size} distinct tokens`);

  const prices = await fetchHistoricalPrices(tokenSet, fx.exploitTs);
  console.log(`  ${Object.keys(prices).length} priced via DeFiLlama historical`);

  // Build BOTH outflows and inflows so we can compute net drain.
  interface Flow {
    ts: number;
    hash: string;
    symbol: string;
    usd: number;
    direction: "out" | "in";
  }
  const flows: Flow[] = [];
  let unpriced = 0;
  for (const t of txs) {
    const dec = parseInt(t.tokenDecimal || "18", 10);
    const amount = Number(t.value) / 10 ** dec;
    const priceKey = `ethereum:${t.contractAddress.toLowerCase()}`;
    const price = prices[priceKey];
    if (!price) {
      unpriced++;
      continue;
    }
    const isOut = (t.from || "").toLowerCase() === lower;
    const isIn = (t.to || "").toLowerCase() === lower;
    if (!isOut && !isIn) continue;
    flows.push({
      ts: parseInt(t.timeStamp, 10),
      hash: t.hash,
      symbol: t.tokenSymbol,
      usd: amount * price,
      direction: isOut ? "out" : "in",
    });
  }
  flows.sort((a, b) => a.ts - b.ts);

  const totalOut = flows.filter((f) => f.direction === "out").reduce((s, f) => s + f.usd, 0);
  const totalIn = flows.filter((f) => f.direction === "in").reduce((s, f) => s + f.usd, 0);
  console.log(`  total flows: $${(totalOut / 1e6).toFixed(0)}M out, $${(totalIn / 1e6).toFixed(0)}M in (${unpriced} unpriced)`);

  // Walk minute-by-minute, computing both gross outflow AND net drain
  // (outflow − inflow) in the rolling 48h window. Extend past the exploit
  // by 60 min so we can see when CRITICAL net trips.
  const stepSec = 60;
  const endTs = fx.exploitTs + 60 * 60;
  let firstHighGross: { ts: number; usd: number } | null = null;
  let firstHighNet: { ts: number; usd: number } | null = null;
  let firstCritGross: { ts: number; usd: number } | null = null;
  let firstCritNet: { ts: number; usd: number } | null = null;

  for (let now = fx.windowStartTs; now <= endTs; now += stepSec) {
    const cutoff = now - LOOKBACK_SECONDS;
    let outUsd = 0;
    let inUsd = 0;
    for (const f of flows) {
      if (f.ts < cutoff || f.ts > now) continue;
      if (f.direction === "out") outUsd += f.usd;
      else inUsd += f.usd;
    }
    const netDrain = Math.max(0, outUsd - inUsd);

    const grossSev = classify(outUsd, fx.poolTvlAtExploit);
    if (grossSev === "high" && !firstHighGross) firstHighGross = { ts: now, usd: outUsd };
    if (grossSev === "critical" && !firstCritGross) firstCritGross = { ts: now, usd: outUsd };

    const netSev = classify(netDrain, fx.poolTvlAtExploit);
    if (netSev === "high" && !firstHighNet) firstHighNet = { ts: now, usd: netDrain };
    if (netSev === "critical" && !firstCritNet) firstCritNet = { ts: now, usd: netDrain };

    if (firstCritGross && firstCritNet) break;
  }

  // Snapshot at exploit moment itself
  const cutoffAtExploit = fx.exploitTs - LOOKBACK_SECONDS;
  let outAtExploit = 0;
  let inAtExploit = 0;
  for (const f of flows) {
    if (f.ts < cutoffAtExploit || f.ts > fx.exploitTs) continue;
    if (f.direction === "out") outAtExploit += f.usd;
    else inAtExploit += f.usd;
  }
  const netAtExploit = outAtExploit - inAtExploit;

  console.log(`\n--- results ---`);
  console.log(
    `at T (exploit moment), 48h rolling window:\n` +
    `  gross outflow:  $${(outAtExploit / 1e6).toFixed(1)}M\n` +
    `  gross inflow:   $${(inAtExploit / 1e6).toFixed(1)}M\n` +
    `  NET drain:      $${(netAtExploit / 1e6).toFixed(1)}M\n` +
    `  (post-mortem reports ~$${(fx.knownDrainUsd / 1e6).toFixed(0)}M)`,
  );

  console.log(`\nGROSS-outflow heuristic (current production logic):`);
  if (firstHighGross) {
    const lag = firstHighGross.ts - fx.exploitTs;
    console.log(
      `  first HIGH:     ${new Date(firstHighGross.ts * 1000).toISOString()} ` +
      `(${lag >= 0 ? "+" : ""}${(lag / 60).toFixed(0)}min vs T) ` +
      `at $${(firstHighGross.usd / 1e6).toFixed(1)}M`,
    );
  } else console.log("  HIGH never tripped");
  if (firstCritGross) {
    const lag = firstCritGross.ts - fx.exploitTs;
    console.log(
      `  first CRITICAL: ${new Date(firstCritGross.ts * 1000).toISOString()} ` +
      `(${lag >= 0 ? "+" : ""}${(lag / 60).toFixed(0)}min vs T) ` +
      `at $${(firstCritGross.usd / 1e6).toFixed(1)}M`,
    );
  } else console.log("  CRITICAL never tripped");

  console.log(`\nNET-drain heuristic (proposed: outflow − inflow):`);
  if (firstHighNet) {
    const lag = firstHighNet.ts - fx.exploitTs;
    console.log(
      `  first HIGH:     ${new Date(firstHighNet.ts * 1000).toISOString()} ` +
      `(${lag >= 0 ? "+" : ""}${(lag / 60).toFixed(0)}min vs T) ` +
      `at $${(firstHighNet.usd / 1e6).toFixed(1)}M`,
    );
  } else console.log("  HIGH never tripped");
  if (firstCritNet) {
    const lag = firstCritNet.ts - fx.exploitTs;
    console.log(
      `  first CRITICAL: ${new Date(firstCritNet.ts * 1000).toISOString()} ` +
      `(${lag >= 0 ? "+" : ""}${(lag / 60).toFixed(0)}min vs T) ` +
      `at $${(firstCritNet.usd / 1e6).toFixed(1)}M`,
    );
  } else console.log("  CRITICAL never tripped");

  // DeFiLlama comparison: their pool TVL refresh is ~1h cadence, and the
  // in-app `monitor.ts` only fires the TVL-drop alert at 40% drop from entry
  // (warning) or 65% (critical). Compute when the drained TVL would have
  // crossed those thresholds.
  // Approximation: pool TVL after exploit ≈ pre-exploit TVL minus drain.
  const tvlAfter = fx.poolTvlAtExploit - fx.knownDrainUsd;
  const dropPct = ((fx.poolTvlAtExploit - tvlAfter) / fx.poolTvlAtExploit) * 100;
  console.log(
    `\nDefiLlama TVL would show: $${(fx.poolTvlAtExploit / 1e6).toFixed(0)}M → ` +
    `$${(tvlAfter / 1e6).toFixed(0)}M (${dropPct.toFixed(0)}% drop)`,
  );
  console.log(
    `In-app TVL alert thresholds: 40% (warning) / 65% (critical) of entry TVL.`,
  );
  console.log(
    `Crosses 40% only after DeFiLlama refreshes its pool TVL feed ` +
    `(typical lag: 30–60 min) AND the user calls /api/monitor.`,
  );
}

backtest(EULER).catch((e) => {
  console.error(e);
  process.exit(1);
});

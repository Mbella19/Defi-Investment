/**
 * Forward-replay portfolio simulator. Takes a user-defined allocation and runs
 * it forward `horizonDays` days, compounding each pool at its own historical
 * APY trajectory. Stress scenarios apply principal haircuts and/or APY shocks
 * at known days to test how the portfolio survives common DeFi failure modes.
 *
 * The "baseline" path is always computed alongside the requested scenario so
 * the UI can show the cost of the stress in dollars.
 */

import type { PoolSeries } from "./pool-history";

export type Scenario = "baseline" | "depeg" | "tvl_crash" | "market_drawdown";

export interface AllocationInput {
  poolId: string;
  weightPct: number;
}

export interface PoolMeta {
  symbol: string;
  protocol: string;
  chain: string;
}

export interface SimulationPoint {
  day: number;
  date: string;
  totalUsd: number;
  baselineUsd: number;
}

export interface PoolBreakdownRow {
  poolId: string;
  symbol: string;
  protocol: string;
  chain: string;
  weightPct: number;
  startUsd: number;
  endUsd: number;
  returnPct: number;
  meanApy: number;
}

export interface SimulationResult {
  scenario: Scenario;
  horizonDays: number;
  startUsd: number;
  endUsd: number;
  returnPct: number;
  maxDrawdownPct: number;
  weightedApy: number;
  baselineEndUsd: number;
  baselineReturnPct: number;
  scenarioImpactUsd: number;
  series: SimulationPoint[];
  poolBreakdown: PoolBreakdownRow[];
  skipped: string[];
}

const STABLE_REGEX = /\b(USD[CTDS]?|DAI|TUSD|FRAX|EUR[CS]?|GBP|GUSD|MIM|crvUSD|sUSD|LUSD|USDe|PYUSD|FDUSD|USDP)\b/i;

function isStableSymbol(symbol: string): boolean {
  return STABLE_REGEX.test(symbol);
}

function dailyRate(apyPct: number): number {
  if (!Number.isFinite(apyPct)) return 0;
  const safe = Math.max(-99.9, apyPct);
  return Math.pow(1 + safe / 100, 1 / 365) - 1;
}

interface PoolPlan {
  poolId: string;
  meta: PoolMeta;
  weightPct: number;
  apySeries: number[];
  meanApy: number;
  isStable: boolean;
}

function buildApySeries(series: PoolSeries, horizonDays: number): number[] {
  const tail = series.points.slice(-Math.max(horizonDays, 30));
  if (tail.length === 0) return [];
  const out: number[] = new Array(horizonDays);
  for (let i = 0; i < horizonDays; i++) {
    out[i] = tail[i % tail.length].apy;
  }
  return out;
}

interface RunOutput {
  totals: number[];
  perPool: number[][];
}

function runScenario(
  scen: Scenario,
  plans: PoolPlan[],
  initBalances: number[],
  horizonDays: number,
): RunOutput {
  const balances = initBalances.slice();

  if (scen === "depeg") {
    for (let i = 0; i < plans.length; i++) {
      if (plans[i].isStable) balances[i] *= 0.95;
    }
  }

  const totals: number[] = new Array(horizonDays + 1);
  const perPool: number[][] = new Array(horizonDays + 1);

  totals[0] = balances.reduce((s, v) => s + v, 0);
  perPool[0] = balances.slice();

  for (let day = 1; day <= horizonDays; day++) {
    for (let i = 0; i < plans.length; i++) {
      let apy = plans[i].apySeries[day - 1] ?? 0;

      if (scen === "tvl_crash" && day >= 30) {
        apy *= 0.2;
      }

      if (scen === "market_drawdown") {
        if (day === 30 && !plans[i].isStable) {
          balances[i] *= 0.75;
        }
        if (day >= 30 && day < 90) {
          apy *= 0.5;
        }
      }

      balances[i] *= 1 + dailyRate(apy);
    }
    totals[day] = balances.reduce((s, v) => s + v, 0);
    perPool[day] = balances.slice();
  }

  return { totals, perPool };
}

export function simulate(args: {
  allocations: AllocationInput[];
  seriesById: Map<string, PoolSeries>;
  metaById: Map<string, PoolMeta>;
  principalUsd: number;
  horizonDays: number;
  scenario: Scenario;
}): SimulationResult {
  const { allocations, seriesById, metaById, principalUsd, horizonDays, scenario } = args;

  const plans: PoolPlan[] = [];
  const skipped: string[] = [];
  for (const a of allocations) {
    const series = seriesById.get(a.poolId);
    const meta = metaById.get(a.poolId);
    if (!series || series.points.length < 14 || !meta) {
      skipped.push(a.poolId);
      continue;
    }
    const apySeries = buildApySeries(series, horizonDays);
    if (apySeries.length === 0) {
      skipped.push(a.poolId);
      continue;
    }
    const meanApy = apySeries.reduce((s, v) => s + v, 0) / apySeries.length;
    plans.push({
      poolId: a.poolId,
      meta,
      weightPct: a.weightPct,
      apySeries,
      meanApy,
      isStable: isStableSymbol(meta.symbol),
    });
  }

  if (plans.length === 0) {
    throw new Error("No allocations have enough history to simulate.");
  }

  const totalWeight = plans.reduce((s, p) => s + p.weightPct, 0) || 1;
  const initBalances = plans.map((p) => (p.weightPct / totalWeight) * principalUsd);

  const baseline = runScenario("baseline", plans, initBalances, horizonDays);
  const stress = scenario === "baseline"
    ? baseline
    : runScenario(scenario, plans, initBalances, horizonDays);

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const series: SimulationPoint[] = [];
  let peak = stress.totals[0];
  let maxDd = 0;
  for (let day = 0; day <= horizonDays; day++) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() + day);
    const date = d.toISOString().slice(0, 10);
    const tot = stress.totals[day];
    if (tot > peak) peak = tot;
    const dd = (tot - peak) / peak;
    if (dd < maxDd) maxDd = dd;
    series.push({ day, date, totalUsd: tot, baselineUsd: baseline.totals[day] });
  }

  const endUsd = stress.totals[horizonDays];
  const baselineEndUsd = baseline.totals[horizonDays];

  const weightedApy = plans.reduce(
    (s, p) => s + (p.weightPct / totalWeight) * p.meanApy,
    0,
  );

  const poolBreakdown: PoolBreakdownRow[] = plans.map((p, i) => {
    const startUsd = stress.perPool[0][i];
    const endUsdPool = stress.perPool[horizonDays][i];
    return {
      poolId: p.poolId,
      symbol: p.meta.symbol,
      protocol: p.meta.protocol,
      chain: p.meta.chain,
      weightPct: (p.weightPct / totalWeight) * 100,
      startUsd,
      endUsd: endUsdPool,
      returnPct: ((endUsdPool - startUsd) / Math.max(1e-6, startUsd)) * 100,
      meanApy: p.meanApy,
    };
  });

  return {
    scenario,
    horizonDays,
    startUsd: principalUsd,
    endUsd,
    returnPct: ((endUsd - principalUsd) / principalUsd) * 100,
    maxDrawdownPct: maxDd * 100,
    weightedApy,
    baselineEndUsd,
    baselineReturnPct: ((baselineEndUsd - principalUsd) / principalUsd) * 100,
    scenarioImpactUsd: endUsd - baselineEndUsd,
    series,
    poolBreakdown,
    skipped,
  };
}

/**
 * Scenario portfolio simulator. Takes a user-defined allocation and runs it
 * forward `horizonDays` days using a deterministic seven-day block bootstrap
 * of each pool's historical APY observations. Stress scenarios apply principal
 * haircuts and/or APY shocks at known days to test common failure modes.
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
  stablecoin: boolean;
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
  methodology: "deterministic_block_bootstrap";
  historyDaysByPool: Record<string, number>;
}

function dailyRate(apyPct: number): number {
  if (!Number.isFinite(apyPct)) return 0;
  // Winsorize extreme upstream observations. Four-digit APYs can exist, but
  // values above this are usually launch incentives or bad feed data and make
  // compounding overflow rather than improve a stress estimate.
  const safe = Math.max(-99.9, Math.min(1_000, apyPct));
  return Math.pow(1 + safe / 100, 1 / 365) - 1;
}

function modeledApy(apyPct: number): number {
  return Number.isFinite(apyPct) ? Math.max(-99.9, Math.min(1_000, apyPct)) : 0;
}

interface PoolPlan {
  poolId: string;
  meta: PoolMeta;
  weightPct: number;
  apySeries: number[];
  meanApy: number;
  isStable: boolean;
}

function seedFrom(value: string): number {
  let seed = 2166136261;
  for (let i = 0; i < value.length; i++) {
    seed ^= value.charCodeAt(i);
    seed = Math.imul(seed, 16777619);
  }
  return seed >>> 0;
}

function seededRandom(seed: number): () => number {
  let state = seed || 0x9e3779b9;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function buildApySeries(series: PoolSeries, horizonDays: number): number[] {
  const history = series.points.slice(-730).map((point) => modeledApy(point.apy));
  if (history.length < 30) return [];
  const blockSize = Math.min(7, history.length);
  const random = seededRandom(seedFrom(`${series.poolId}:${horizonDays}:${history.length}`));
  const out: number[] = [];
  while (out.length < horizonDays) {
    const maxStart = history.length - blockSize;
    const start = Math.floor(random() * (maxStart + 1));
    for (let offset = 0; offset < blockSize && out.length < horizonDays; offset++) {
      out.push(history[start + offset]);
    }
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

  const totals: number[] = new Array(horizonDays + 1);
  const perPool: number[][] = new Array(horizonDays + 1);

  totals[0] = balances.reduce((s, v) => s + v, 0);
  perPool[0] = balances.slice();

  for (let day = 1; day <= horizonDays; day++) {
    for (let i = 0; i < plans.length; i++) {
      let apy = plans[i].apySeries[day - 1] ?? 0;

      if (scen === "depeg" && day === 1 && plans[i].isStable) {
        balances[i] *= 0.95;
      }

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
    if (!series || series.points.length < 30 || !meta) {
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
      isStable: meta.stablecoin,
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
    methodology: "deterministic_block_bootstrap",
    historyDaysByPool: Object.fromEntries(
      plans.map((plan) => [plan.poolId, seriesById.get(plan.poolId)?.points.length ?? 0]),
    ),
  };
}

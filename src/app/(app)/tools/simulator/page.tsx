"use client";

import { useEffect, useMemo, useState } from "react";
import { Gauge, Plus, Search, X } from "lucide-react";
import {
  BookHeader,
  ChainBadge,
  Console,
  type TapeStat,
} from "@/components/site/ui";
import { PoolIcon } from "@/components/site/PoolIcon";
import {
  chainIdFromName,
  formatMoney,
  formatPct,
  formatUsd,
} from "@/lib/design-utils";
import type { LivePool } from "@/app/api/yields/live/route";
import { usePlan } from "@/hooks/usePlan";
import { Paywall } from "@/components/site/Paywall";
import { apiFetch } from "@/lib/api-client";

type Scenario = "baseline" | "depeg" | "tvl_crash" | "market_drawdown";

interface SimulationPoolRow {
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

interface SimulationResult {
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
  series: { day: number; date: string; totalUsd: number; baselineUsd: number }[];
  poolBreakdown: SimulationPoolRow[];
  skipped: string[];
}

interface Allocation {
  pool: LivePool;
  weightPct: number;
}

const HORIZONS = [
  { label: "30D", days: 30 },
  { label: "90D", days: 90 },
  { label: "180D", days: 180 },
  { label: "1Y", days: 365 },
];

const SCENARIOS: Array<{ key: Scenario; label: string; blurb: string }> = [
  { key: "baseline", label: "Baseline", blurb: "Block-bootstrap recent APY behavior." },
  { key: "depeg", label: "Stable depeg", blurb: "5% one-time stablecoin haircut." },
  { key: "tvl_crash", label: "Liquidity drop", blurb: "TVL crash → APY collapses 80%." },
  { key: "market_drawdown", label: "Market drawdown", blurb: "Non-stable principal -25% at day 30." },
];

const MAX_ALLOCATIONS = 8;

export default function SimulatorPage() {
  const plan = usePlan();
  const [pools, setPools] = useState<LivePool[]>([]);
  const [poolsErr, setPoolsErr] = useState<string | null>(null);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [search, setSearch] = useState("");
  const [principal, setPrincipal] = useState(100_000);
  const [horizon, setHorizon] = useState(90);
  const [scenario, setScenario] = useState<Scenario>("baseline");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let abort = false;
    fetch("/api/yields/live", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (abort) return;
        if (Array.isArray(d.pools)) {
          const list = d.pools as LivePool[];
          setPools(list);
          setAllocations((current) => {
            if (current.length > 0) return current;
            const seed = list.slice(0, 4);
            const weight = Math.floor(100 / Math.max(1, seed.length));
            const rounded = seed.map((pool, i) => ({
              pool,
              weightPct: i === 0 ? 100 - weight * (seed.length - 1) : weight,
            }));
            return rounded;
          });
        } else {
          setPoolsErr(d.error ?? "Failed to load market list");
        }
      })
      .catch((e) => !abort && setPoolsErr(String(e)));
    return () => {
      abort = true;
    };
  }, []);

  const totalWeight = allocations.reduce((s, a) => s + a.weightPct, 0);

  const filtered = useMemo(() => {
    if (pools.length === 0) return [];
    const q = search.trim().toLowerCase();
    const taken = new Set(allocations.map((a) => a.pool.poolId));
    return pools
      .filter((p) => !taken.has(p.poolId))
      .filter((p) => {
        if (!q) return true;
        return (
          p.symbol.toLowerCase().includes(q) ||
          p.protocol.toLowerCase().includes(q) ||
          p.chain.toLowerCase().includes(q)
        );
      })
      .slice(0, 30);
  }, [pools, allocations, search]);

  function rebalanceEqually(next: Allocation[]): Allocation[] {
    if (next.length === 0) return next;
    const baseWeight = Math.floor(100 / next.length);
    const drift = 100 - baseWeight * next.length;
    return next.map((a, i) => ({ ...a, weightPct: i === 0 ? baseWeight + drift : baseWeight }));
  }

  function addPool(pool: LivePool) {
    setAllocations((current) => {
      if (current.length >= MAX_ALLOCATIONS) return current;
      return rebalanceEqually([...current, { pool, weightPct: 0 }]);
    });
  }

  function removePool(poolId: string) {
    setAllocations((current) => rebalanceEqually(current.filter((a) => a.pool.poolId !== poolId)));
  }

  function changeWeight(poolId: string, value: number) {
    setAllocations((current) =>
      current.map((a) => (a.pool.poolId === poolId ? { ...a, weightPct: Math.max(0, Math.min(100, value)) } : a)),
    );
  }

  async function simulate() {
    if (allocations.length === 0) {
      setErr("Add at least one allocation.");
      return;
    }
    if (Math.abs(totalWeight - 100) > 1) {
      setErr(`Weights must sum to 100% (currently ${totalWeight.toFixed(1)}%).`);
      return;
    }
    setRunning(true);
    setErr(null);
    setResult(null);
    try {
      const res = await apiFetch("/api/tools/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          allocations: allocations.map((a) => ({ poolId: a.pool.poolId, weightPct: a.weightPct })),
          principalUsd: principal,
          horizonDays: horizon,
          scenario,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Simulation failed (${res.status})`);
      setResult(data as SimulationResult);
    } catch (caught) {
      setErr(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setRunning(false);
    }
  }

  const seriesPath = useMemo(() => {
    if (!result) return null;
    const max = Math.max(...result.series.flatMap((p) => [p.totalUsd, p.baselineUsd]));
    const min = Math.min(...result.series.flatMap((p) => [p.totalUsd, p.baselineUsd]));
    const w = 760;
    const h = 280;
    const pathFor = (key: "totalUsd" | "baselineUsd") =>
      result.series
        .map((point, index) => {
          const x = (index / Math.max(1, result.series.length - 1)) * w;
          const y = h - ((point[key] - min) / Math.max(max - min, 1)) * (h - 24) - 12;
          return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
        })
        .join(" ");
    return { base: pathFor("baselineUsd"), stress: pathFor("totalUsd"), w, h };
  }, [result]);

  const headlineApy = result?.weightedApy ?? 0;
  const weightsOff = Math.abs(totalWeight - 100) > 1;

  const tape: TapeStat[] = [
    { label: "scenario end", value: result ? formatMoney(result.endUsd) : "—", tone: result ? "ok" : "plain" },
    {
      label: "return",
      value: result ? formatPct(result.returnPct, true) : "—",
      tone: result ? (result.returnPct >= 0 ? "ok" : "danger") : "plain",
    },
    {
      label: "impact",
      value: result ? formatMoney(result.scenarioImpactUsd) : "—",
      tone: result ? "warn" : "plain",
    },
    { label: "w. apy", value: result ? formatPct(headlineApy) : "—", tone: "plain" },
  ];

  return (
    <div className="page">
      <div className="page-title">
        <div>
          <p className="eyebrow">Tools / Simulator</p>
          <h1>See your allocation under fire — before the market gets to it.</h1>
          <p>
            Model any allocation against four stress regimes using a deterministic
            seven-day block bootstrap of each pool&apos;s actual APY history. This is a
            scenario estimate, not a return forecast.
          </p>
        </div>
      </div>

      {!plan.isLoading && !plan.capabilities.toolSimulator ? (
        <Paywall
          title="Scenario simulator unlocks on Pro"
          body="Stress-test your allocation against baseline, stablecoin depeg, TVL crash, and market drawdown using each protocol's historical yield data. Available on Pro and Ultra."
          requiredTier="pro"
          currentTier={plan.tier}
          feature="Simulator"
        />
      ) : null}

      <Console
        file="file/06a.simulator"
        chips={[
          { label: "scenario", value: scenario, tone: scenario === "baseline" ? "ok" : "warn" },
          { label: "horizon", value: `${horizon}d`, tone: "info" },
          { label: "weights", value: `${totalWeight.toFixed(0)}%`, tone: weightsOff ? "danger" : "ok" },
        ]}
        tape={tape}
      >
        <div className="desk-title">
          <div>
            <p className="eyebrow">Scenario console</p>
            <h2>Stress the allocation.</h2>
          </div>
        </div>

        <div className="ticket">
          <label>
            Principal (USD)
            <input
              className="number-input"
              type="number"
              min={1000}
              step={1000}
              value={principal}
              onChange={(event) => setPrincipal(Math.max(1000, Number(event.target.value) || 0))}
            />
          </label>
          <label>
            Horizon
            <select
              className="select-input"
              value={horizon}
              onChange={(event) => setHorizon(Number(event.target.value))}
            >
              {HORIZONS.map((h) => (
                <option key={h.label} value={h.days}>
                  {h.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Shock scenario
            <span className="ticket-chips">
              {SCENARIOS.map((s) => (
                <button
                  className={`chip-button ${scenario === s.key ? "active" : ""}`}
                  key={s.key}
                  type="button"
                  onClick={() => setScenario(s.key)}
                  title={s.blurb}
                >
                  {s.label}
                </button>
              ))}
            </span>
          </label>
          <button
            type="button"
            className="primary-button"
            onClick={simulate}
            disabled={running || allocations.length === 0}
          >
            <Gauge size={17} aria-hidden="true" />
            {running ? "Simulating…" : "Run simulation"}
          </button>
        </div>

        {err ? (
          <p className="ticket-note severity-high" role="alert" style={{ margin: 0 }}>
            {err}
          </p>
        ) : null}

        <div className="desk-grid">
          <div className="desk-col">
            <p className="eyebrow">
              Allocations ({allocations.length}/{MAX_ALLOCATIONS}) · total weight{" "}
              {totalWeight.toFixed(0)}%
            </p>
            <div className="allocation-list" style={{ marginTop: 0 }}>
              {allocations.length === 0 ? (
                <span style={{ fontSize: 13, color: "var(--muted)" }}>
                  Add pools from the shelf — weights balance equally.
                </span>
              ) : (
                allocations.map((alloc) => {
                  const chain = chainIdFromName(alloc.pool.chain);
                  return (
                    <div className="allocation-row" key={`alloc-${alloc.pool.poolId}`}>
                      <div className="token-cell">
                        <PoolIcon
                          symbol={alloc.pool.symbol}
                          protocol={alloc.pool.protocol}
                          category={alloc.pool.category}
                        />
                        <div>
                          <strong>{alloc.pool.symbol}</strong>
                          <span>
                            {alloc.pool.protocol} · {formatPct(alloc.pool.apy)}
                          </span>
                        </div>
                      </div>
                      <input
                        type="number"
                        className="number-input"
                        style={{ width: 70, minHeight: 36, padding: "0 8px" }}
                        min={0}
                        max={100}
                        value={alloc.weightPct}
                        onChange={(event) => changeWeight(alloc.pool.poolId, Number(event.target.value) || 0)}
                      />
                      <button
                        type="button"
                        className="ghost-button"
                        style={{ minHeight: 36, padding: "0 8px" }}
                        aria-label="Remove"
                        onClick={() => removePool(alloc.pool.poolId)}
                      >
                        <X size={14} aria-hidden="true" />
                        <ChainBadge chain={chain} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="desk-col">
            <p className="eyebrow">Add pool</p>
            <div style={{ position: "relative" }}>
              <Search
                size={14}
                aria-hidden="true"
                style={{ position: "absolute", top: "50%", left: 12, transform: "translateY(-50%)", color: "var(--muted)" }}
              />
              <input
                className="search-input"
                style={{ paddingLeft: 32, width: "100%", minWidth: 0 }}
                placeholder="Search pool, protocol, chain"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>

            {poolsErr ? (
              <span className="severity-high" style={{ fontSize: 12 }}>
                {poolsErr}
              </span>
            ) : (
              <div className="allocation-list" style={{ marginTop: 0, maxHeight: 280, overflowY: "auto" }}>
                {filtered.length === 0 ? (
                  <span style={{ fontSize: 13, color: "var(--muted)" }}>
                    {pools.length === 0 ? "Loading…" : "No matches."}
                  </span>
                ) : (
                  filtered.map((pool) => (
                    <button
                      key={`add-${pool.poolId}`}
                      type="button"
                      className="allocation-row"
                      disabled={allocations.length >= MAX_ALLOCATIONS}
                      onClick={() => addPool(pool)}
                    >
                      <div className="token-cell">
                        <PoolIcon symbol={pool.symbol} protocol={pool.protocol} category={pool.category} />
                        <div>
                          <strong>{pool.symbol}</strong>
                          <span>
                            {pool.protocol} · {formatUsd(pool.tvlUsd)}
                          </span>
                        </div>
                      </div>
                      <ChainBadge chain={chainIdFromName(pool.chain)} />
                      <Plus size={16} aria-hidden="true" />
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </Console>

      <BookHeader
        index="06a.1"
        title="Scenario estimate"
        meta={result ? `${result.horizonDays}d · ${SCENARIOS.find((s) => s.key === result.scenario)?.label ?? result.scenario}` : undefined}
      />

      <div className="projection-chart">
        {seriesPath ? (
          <svg viewBox={`0 0 ${seriesPath.w} ${seriesPath.h}`} role="img" aria-label="Scenario estimate">
            <path
              d={seriesPath.base}
              fill="none"
              stroke="#64748b"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray="8 8"
            />
            <path d={seriesPath.stress} fill="none" stroke="#6ee7b7" strokeWidth="4" strokeLinecap="round" />
            <path
              d={`${seriesPath.stress} L ${seriesPath.w} ${seriesPath.h} L 0 ${seriesPath.h} Z`}
              fill="#6ee7b7"
              opacity="0.12"
            />
          </svg>
        ) : (
          <span style={{ color: "var(--muted)", fontSize: 13, textAlign: "center", maxWidth: 520 }}>
            Set principal, horizon, and shock scenario above, then run the simulation to
            render the stressed vs. baseline curves. The engine block-bootstraps each
            pool&apos;s historical APY — results are estimates, not forecasts.
          </span>
        )}
      </div>

      {result ? (
        <div className="strategy-card" style={{ marginTop: 14 }}>
          <h3>Allocation breakdown</h3>
          <p>
            Max drawdown <strong>{formatPct(result.maxDrawdownPct)}</strong> · baseline end{" "}
            <strong>{formatMoney(result.baselineEndUsd)}</strong>.
          </p>
          <div className="allocation-list">
            {result.poolBreakdown.map((row) => {
              const chain = chainIdFromName(row.chain);
              return (
                <div className="allocation-row" key={`row-${row.poolId}`}>
                  <div className="token-cell">
                    <PoolIcon symbol={row.symbol} protocol={row.protocol} />
                    <div>
                      <strong>{row.symbol}</strong>
                      <span>
                        {row.protocol} · mean APY {formatPct(row.meanApy)}
                      </span>
                    </div>
                  </div>
                  <strong>{row.weightPct.toFixed(0)}%</strong>
                  <ChainBadge chain={chain} />
                </div>
              );
            })}
          </div>
          {result.skipped.length > 0 ? (
            <p className="severity-medium" style={{ marginTop: 10, fontSize: 12 }}>
              Skipped (insufficient history): {result.skipped.join(", ")}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

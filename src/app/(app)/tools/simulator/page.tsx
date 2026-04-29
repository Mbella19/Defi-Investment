"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Banknote,
  Gauge,
  Plus,
  Search,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import {
  ChainBadge,
  CommandStrip,
  EmptyState,
  MetricTile,
} from "@/components/site/ui";
import {
  chainIdFromName,
  formatMoney,
  formatPct,
  formatUsd,
} from "@/lib/design-utils";
import type { LivePool } from "@/app/api/yields/live/route";

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
  { key: "baseline", label: "Baseline", blurb: "Forward-replay recent APY behavior." },
  { key: "depeg", label: "Stable depeg", blurb: "5% one-time stablecoin haircut." },
  { key: "tvl_crash", label: "Liquidity drop", blurb: "TVL crash → APY collapses 80%." },
  { key: "market_drawdown", label: "Market drawdown", blurb: "Non-stable principal -25% at day 30." },
];

const MAX_ALLOCATIONS = 8;

export default function SimulatorPage() {
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
      const res = await fetch("/api/tools/simulate", {
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

  return (
    <div className="page">
      <div className="page-title">
        <div>
          <p className="eyebrow">Tools / Simulator</p>
          <h1>Stress the mandate before it moves.</h1>
          <p>
            Forward-replay a custom allocation against baseline + three shock regimes
            using real DeFiLlama daily history.
          </p>
        </div>
      </div>

      <CommandStrip
        file="file/06a.simulator"
        items={[
          { label: "scenario", value: scenario, tone: scenario === "baseline" ? "ok" : "warn" },
          { label: "horizon", value: `${horizon}d`, tone: "info" },
          { label: "weights", value: `${totalWeight.toFixed(0)}%`, tone: Math.abs(totalWeight - 100) > 1 ? "danger" : "ok" },
        ]}
      />

      <div className="metric-grid" style={{ marginBottom: 18 }}>
        <MetricTile
          label="Projected end"
          value={result ? formatMoney(result.endUsd) : "—"}
          icon={TrendingUp}
          tone="#6ee7b7"
        />
        <MetricTile
          label="Return"
          value={result ? formatPct(result.returnPct, true) : "—"}
          icon={Activity}
          tone="#60a5fa"
        />
        <MetricTile
          label="Scenario impact"
          value={result ? formatMoney(result.scenarioImpactUsd) : "—"}
          icon={TrendingDown}
          tone="#fb7185"
        />
        <MetricTile
          label="Weighted APY"
          value={result ? formatPct(headlineApy) : "—"}
          icon={Gauge}
          tone="#fbbf24"
        />
      </div>

      {err ? (
        <div className="ticker" style={{ marginBottom: 16 }}>
          <span className="severity-high">{err}</span>
        </div>
      ) : null}

      <div className="tool-layout">
        <div className="tool-stack">
          <div className="projection-chart">
            {seriesPath ? (
              <svg viewBox={`0 0 ${seriesPath.w} ${seriesPath.h}`} role="img" aria-label="Simulation projection">
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
              <span style={{ color: "var(--muted)", fontSize: 13 }}>
                Run a simulation to render the projected vs. baseline curves.
              </span>
            )}
          </div>

          {result ? (
            <div className="strategy-card">
              <h3>Allocation breakdown</h3>
              <p>
                Max drawdown <strong>{formatPct(result.maxDrawdownPct * 100)}</strong> · baseline end{" "}
                <strong>{formatMoney(result.baselineEndUsd)}</strong>.
              </p>
              <div className="allocation-list">
                {result.poolBreakdown.map((row) => {
                  const chain = chainIdFromName(row.chain);
                  return (
                    <div className="allocation-row" key={`row-${row.poolId}`}>
                      <div className="token-cell">
                        <div className="token-chip" aria-hidden="true">
                          {row.symbol.slice(0, 2)}
                        </div>
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
          ) : (
            <EmptyState
              icon={Gauge}
              title="No simulation yet"
              body="Adjust principal, horizon, and shock scenario, then press Run simulation. We replay each pool's APY history forward."
            />
          )}
        </div>

        <aside className="boost-panel">
          <p className="eyebrow">Inputs</p>
          <div className="sim-controls">
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
            <div className="scenario-grid">
              {SCENARIOS.map((s) => (
                <button
                  className={`tab-button ${scenario === s.key ? "active" : ""}`}
                  key={s.key}
                  type="button"
                  onClick={() => setScenario(s.key)}
                  title={s.blurb}
                >
                  {s.label}
                </button>
              ))}
            </div>
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

          <div className="ticker" style={{ marginTop: 18 }}>
            <span>
              <Banknote size={16} aria-hidden="true" />
              Total weight <b>{totalWeight.toFixed(0)}%</b>
            </span>
          </div>

          <p className="eyebrow" style={{ marginTop: 18 }}>
            Allocations ({allocations.length}/{MAX_ALLOCATIONS})
          </p>
          <div className="allocation-list" style={{ marginBottom: 14 }}>
            {allocations.length === 0 ? (
              <span style={{ fontSize: 13, color: "var(--muted)" }}>
                Add pools below — weights will balance equally.
              </span>
            ) : (
              allocations.map((alloc) => {
                const chain = chainIdFromName(alloc.pool.chain);
                return (
                  <div className="allocation-row" key={`alloc-${alloc.pool.poolId}`}>
                    <div className="token-cell">
                      <div className="token-chip" aria-hidden="true">
                        {alloc.pool.symbol.slice(0, 2)}
                      </div>
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

          <p className="eyebrow">Add pool</p>
          <div style={{ position: "relative", marginBottom: 12 }}>
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
            <div className="allocation-list" style={{ maxHeight: 280, overflowY: "auto" }}>
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
                      <div className="token-chip" aria-hidden="true">
                        {pool.symbol.slice(0, 2)}
                      </div>
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
        </aside>
      </div>
    </div>
  );
}

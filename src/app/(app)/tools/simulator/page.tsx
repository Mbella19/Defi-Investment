"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Icons, ThemeToggle } from "@/components/sovereign";

interface LivePool {
  poolId: string;
  symbol: string;
  protocol: string;
  chain: string;
  tvlUsd: number;
  apy: number;
}

interface PoolBreakdownRow {
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
  scenario: string;
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
  poolBreakdown: PoolBreakdownRow[];
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

const SCENARIOS: Array<{
  key: "baseline" | "depeg" | "tvl_crash" | "market_drawdown";
  label: string;
  blurb: string;
}> = [
  {
    key: "baseline",
    label: "Baseline",
    blurb: "Replay each pool's actual APY history forward.",
  },
  {
    key: "depeg",
    label: "Stable depeg",
    blurb: "Day 0: stablecoin pools take a one-time 5% principal hit.",
  },
  {
    key: "tvl_crash",
    label: "TVL exodus",
    blurb: "Day 30: yields collapse to 20% of historical for the rest of the run.",
  },
  {
    key: "market_drawdown",
    label: "Market drawdown",
    blurb: "Day 30: non-stable principal -25% + 60 days of half-yield.",
  },
];

const MAX_ALLOCS = 8;

function fmtUsd(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}

function fmtPct(n: number, digits = 2): string {
  if (!Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(digits)}%`;
}

export default function SimulatorPage() {
  const [pools, setPools] = useState<LivePool[]>([]);
  const [poolsErr, setPoolsErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<Allocation[]>([]);
  const [search, setSearch] = useState("");
  const [principalUsd, setPrincipalUsd] = useState(10_000);
  const [horizonDays, setHorizonDays] = useState(90);
  const [scenario, setScenario] =
    useState<(typeof SCENARIOS)[number]["key"]>("baseline");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let abort = false;
    fetch("/api/yields/live")
      .then((r) => r.json())
      .then((d) => {
        if (abort) return;
        if (Array.isArray(d.pools)) setPools(d.pools);
        else setPoolsErr(d.error ?? "Failed to load pool list");
      })
      .catch((e) => !abort && setPoolsErr(String(e)));
    return () => {
      abort = true;
    };
  }, []);

  const totalWeight = useMemo(
    () => selected.reduce((s, a) => s + a.weightPct, 0),
    [selected],
  );

  const weightOk = Math.abs(totalWeight - 100) <= 1 && selected.length > 0;

  const filtered = useMemo(() => {
    if (pools.length === 0) return [];
    const q = search.trim().toLowerCase();
    const selectedIds = new Set(selected.map((a) => a.pool.poolId));
    const base = pools.filter((p) => !selectedIds.has(p.poolId));
    if (!q) return base.slice(0, 50);
    return base
      .filter(
        (p) =>
          p.symbol.toLowerCase().includes(q) ||
          p.protocol.toLowerCase().includes(q) ||
          p.chain.toLowerCase().includes(q),
      )
      .slice(0, 50);
  }, [pools, search, selected]);

  function addPool(pool: LivePool) {
    if (selected.length >= MAX_ALLOCS) return;
    if (selected.some((a) => a.pool.poolId === pool.poolId)) return;
    const remaining = Math.max(0, 100 - totalWeight);
    const defaultWeight = selected.length === 0 ? 100 : Math.min(remaining, 25);
    setSelected([...selected, { pool, weightPct: defaultWeight }]);
    setResult(null);
  }

  function removeAlloc(poolId: string) {
    setSelected(selected.filter((a) => a.pool.poolId !== poolId));
    setResult(null);
  }

  function setWeight(poolId: string, weight: number) {
    setSelected(
      selected.map((a) =>
        a.pool.poolId === poolId
          ? { ...a, weightPct: Math.max(0, Math.min(100, weight)) }
          : a,
      ),
    );
    setResult(null);
  }

  function rebalanceEqual() {
    if (selected.length === 0) return;
    const each = +(100 / selected.length).toFixed(2);
    const updated = selected.map((a, i) => ({
      ...a,
      weightPct: i === selected.length - 1 ? +(100 - each * (selected.length - 1)).toFixed(2) : each,
    }));
    setSelected(updated);
    setResult(null);
  }

  async function run() {
    if (!weightOk) return;
    setRunning(true);
    setErr(null);
    setResult(null);
    try {
      const res = await fetch("/api/tools/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          allocations: selected.map((a) => ({
            poolId: a.pool.poolId,
            weightPct: a.weightPct,
          })),
          principalUsd,
          horizonDays,
          scenario,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setResult(data as SimulationResult);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="page-wrap">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <div className="eyebrow">MODEL · SIMULATOR</div>
          <h1
            className="display"
            style={{ fontSize: 28, margin: "6px 0 2px", letterSpacing: "-0.02em" }}
          >
            The bad day, on demand.
          </h1>
          <div style={{ fontSize: 13, color: "var(--text-dim)" }}>
            Replay any allocation through the failures that have already happened — and the ones that haven&rsquo;t.
          </div>
        </div>
        <ThemeToggle />
      </div>

      {/* ---------- ALLOCATIONS ---------- */}
      <div className="card" style={{ padding: 18 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 12,
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 600 }}>Allocations</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span
              className="mono"
              style={{
                fontSize: 11,
                color: weightOk ? "var(--text-dim)" : "#ef4444",
              }}
            >
              {totalWeight.toFixed(1)}% allocated · {selected.length}/{MAX_ALLOCS}
            </span>
            {selected.length > 1 && (
              <button
                type="button"
                onClick={rebalanceEqual}
                style={{
                  padding: "4px 10px",
                  fontSize: 11,
                  background: "var(--surface-2)",
                  color: "var(--text-1)",
                  border: "1px solid var(--line)",
                  borderRadius: 6,
                  cursor: "pointer",
                }}
              >
                Equal weights
              </button>
            )}
          </div>
        </div>

        {selected.length === 0 ? (
          <div
            style={{
              padding: "12px 14px",
              border: "1px dashed var(--line)",
              borderRadius: 8,
              fontSize: 12.5,
              color: "var(--text-dim)",
            }}
          >
            Pick 1–{MAX_ALLOCS} pools below, then assign weights that sum to 100%.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {selected.map((a) => (
              <div
                key={a.pool.poolId}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 130px 80px 28px",
                  gap: 10,
                  alignItems: "center",
                  padding: "10px 12px",
                  background: "var(--surface-2)",
                  border: "1px solid var(--line)",
                  borderRadius: 8,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {a.pool.symbol}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--text-dim)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {a.pool.protocol} · {a.pool.chain} · {a.pool.apy.toFixed(2)}% APY
                  </div>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={a.weightPct}
                  onChange={(e) => setWeight(a.pool.poolId, Number(e.target.value))}
                  style={{ width: "100%" }}
                />
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={a.weightPct}
                    onChange={(e) => setWeight(a.pool.poolId, Number(e.target.value))}
                    style={{
                      width: 60,
                      padding: "4px 6px",
                      fontSize: 12,
                      background: "var(--surface-1, var(--surface-2))",
                      color: "var(--text-1)",
                      border: "1px solid var(--line)",
                      borderRadius: 6,
                      textAlign: "right",
                    }}
                  />
                  <span style={{ fontSize: 11, color: "var(--text-dim)" }}>%</span>
                </div>
                <button
                  type="button"
                  onClick={() => removeAlloc(a.pool.poolId)}
                  aria-label="Remove allocation"
                  style={{
                    width: 24,
                    height: 24,
                    background: "transparent",
                    color: "var(--text-dim)",
                    border: "1px solid var(--line)",
                    borderRadius: 6,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icons.x size={11} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: 16 }}>
          <input
            type="text"
            placeholder="Search by symbol, protocol, or chain (USDC, Aave, Arbitrum…)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 12px",
              fontSize: 13,
              background: "var(--surface-2)",
              color: "var(--text-1)",
              border: "1px solid var(--line)",
              borderRadius: 8,
            }}
          />

          {poolsErr ? (
            <div style={{ marginTop: 10, fontSize: 12, color: "#ef4444" }}>
              Couldn&rsquo;t load pool list: {poolsErr}
            </div>
          ) : pools.length === 0 ? (
            <div style={{ marginTop: 10, fontSize: 12, color: "var(--text-dim)" }}>
              Loading pool catalog…
            </div>
          ) : (
            <div
              style={{
                marginTop: 10,
                maxHeight: 240,
                overflowY: "auto",
                border: "1px solid var(--line)",
                borderRadius: 8,
              }}
            >
              {filtered.length === 0 ? (
                <div
                  style={{
                    padding: 16,
                    fontSize: 12.5,
                    color: "var(--text-dim)",
                    textAlign: "center",
                  }}
                >
                  No matches.
                </div>
              ) : (
                filtered.map((p, i) => (
                  <button
                    key={p.poolId}
                    type="button"
                    onClick={() => addPool(p)}
                    disabled={selected.length >= MAX_ALLOCS}
                    style={{
                      width: "100%",
                      display: "grid",
                      gridTemplateColumns: "1fr 80px 80px 24px",
                      gap: 10,
                      alignItems: "center",
                      padding: "10px 14px",
                      background: "transparent",
                      color: "var(--text-1)",
                      border: "none",
                      borderBottom:
                        i === filtered.length - 1 ? "none" : "1px solid var(--line)",
                      cursor: selected.length >= MAX_ALLOCS ? "not-allowed" : "pointer",
                      fontSize: 12.5,
                      textAlign: "left",
                      opacity: selected.length >= MAX_ALLOCS ? 0.5 : 1,
                    }}
                  >
                    <div
                      style={{
                        minWidth: 0,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      <span style={{ fontWeight: 500 }}>{p.symbol}</span>
                      <span style={{ color: "var(--text-dim)" }}>
                        {" · "}
                        {p.protocol} · {p.chain}
                      </span>
                    </div>
                    <span
                      className="mono"
                      style={{ fontSize: 11, color: "var(--text-dim)", textAlign: "right" }}
                    >
                      {p.apy.toFixed(2)}%
                    </span>
                    <span
                      className="mono"
                      style={{ fontSize: 11, color: "var(--text-dim)", textAlign: "right" }}
                    >
                      {p.tvlUsd >= 1e9
                        ? `$${(p.tvlUsd / 1e9).toFixed(1)}B`
                        : `$${(p.tvlUsd / 1e6).toFixed(0)}M`}
                    </span>
                    <Icons.plus size={14} style={{ color: "var(--accent)" }} />
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* ---------- PARAMS ---------- */}
      <div className="card" style={{ padding: 18 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "180px 1fr",
            gap: 14,
            alignItems: "center",
            marginBottom: 14,
          }}
        >
          <span
            style={{
              fontSize: 11,
              color: "var(--text-dim)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            Principal
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 14, color: "var(--text-dim)" }}>$</span>
            <input
              type="number"
              min={100}
              step={1000}
              value={principalUsd}
              onChange={(e) => {
                setPrincipalUsd(Math.max(100, Number(e.target.value) || 0));
                setResult(null);
              }}
              style={{
                width: 160,
                padding: "8px 10px",
                fontSize: 13,
                background: "var(--surface-2)",
                color: "var(--text-1)",
                border: "1px solid var(--line)",
                borderRadius: 6,
                textAlign: "right",
              }}
            />
            <div style={{ display: "flex", gap: 4 }}>
              {[1_000, 10_000, 100_000, 1_000_000].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => {
                    setPrincipalUsd(v);
                    setResult(null);
                  }}
                  style={{
                    padding: "4px 8px",
                    fontSize: 11,
                    background:
                      principalUsd === v ? "var(--accent)" : "var(--surface-2)",
                    color:
                      principalUsd === v ? "var(--accent-text)" : "var(--text-dim)",
                    border: "1px solid var(--line)",
                    borderRadius: 4,
                    cursor: "pointer",
                  }}
                >
                  {fmtUsd(v)}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "180px 1fr",
            gap: 14,
            alignItems: "center",
            marginBottom: 14,
          }}
        >
          <span
            style={{
              fontSize: 11,
              color: "var(--text-dim)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            Horizon
          </span>
          <div style={{ display: "flex", gap: 4 }}>
            {HORIZONS.map((h) => {
              const active = h.days === horizonDays;
              return (
                <button
                  key={h.days}
                  type="button"
                  onClick={() => {
                    setHorizonDays(h.days);
                    setResult(null);
                  }}
                  style={{
                    padding: "6px 14px",
                    fontSize: 12,
                    background: active ? "var(--accent)" : "var(--surface-2)",
                    color: active ? "var(--accent-text)" : "var(--text-1)",
                    border: "1px solid var(--line)",
                    borderRadius: 6,
                    cursor: "pointer",
                    fontWeight: active ? 600 : 400,
                  }}
                >
                  {h.label}
                </button>
              );
            })}
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "180px 1fr",
            gap: 14,
            alignItems: "flex-start",
          }}
        >
          <span
            style={{
              fontSize: 11,
              color: "var(--text-dim)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              paddingTop: 6,
            }}
          >
            Scenario
          </span>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 8,
            }}
          >
            {SCENARIOS.map((s) => {
              const active = s.key === scenario;
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => {
                    setScenario(s.key);
                    setResult(null);
                  }}
                  style={{
                    padding: "10px 12px",
                    background: active ? "var(--surface-3)" : "var(--surface-2)",
                    color: "var(--text-1)",
                    border: `1px solid ${active ? "var(--accent)" : "var(--line)"}`,
                    borderRadius: 8,
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                    {s.label}
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--text-dim)", lineHeight: 1.4 }}>
                    {s.blurb}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ---------- RUN ---------- */}
      <div
        className="card"
        style={{
          padding: 16,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div style={{ fontSize: 12.5, color: "var(--text-dim)" }}>
          {weightOk
            ? "Ready to simulate."
            : selected.length === 0
              ? "Pick at least one pool to begin."
              : `Weights must sum to 100% (currently ${totalWeight.toFixed(1)}%).`}
        </div>
        <button
          type="button"
          className="btn"
          onClick={run}
          disabled={running || !weightOk}
        >
          {running ? "Simulating…" : "Run simulation"}
        </button>
      </div>

      {err && (
        <div
          className="card"
          style={{ padding: 14, fontSize: 12.5, color: "#ef4444", borderColor: "#ef4444" }}
        >
          {err}
        </div>
      )}

      {/* ---------- RESULTS ---------- */}
      {result && <ResultsPanel result={result} />}
    </div>
  );
}

function ResultsPanel({ result }: { result: SimulationResult }) {
  const isStress = result.scenario !== "baseline";

  return (
    <>
      {/* Stat row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
        }}
      >
        <Stat label="Final value" value={fmtUsd(result.endUsd)} hint={`from ${fmtUsd(result.startUsd)}`} />
        <Stat
          label="Total return"
          value={fmtPct(result.returnPct)}
          tone={result.returnPct >= 0 ? "good" : "bad"}
          hint={`weighted APY ${result.weightedApy.toFixed(2)}%`}
        />
        <Stat
          label="Max drawdown"
          value={fmtPct(result.maxDrawdownPct)}
          tone={result.maxDrawdownPct < -1 ? "bad" : "neutral"}
          hint={`over ${result.horizonDays} days`}
        />
        {isStress && (
          <Stat
            label="Scenario impact"
            value={fmtUsd(result.scenarioImpactUsd)}
            tone={result.scenarioImpactUsd < 0 ? "bad" : "good"}
            hint={`vs baseline ${fmtUsd(result.baselineEndUsd)}`}
          />
        )}
      </div>

      {/* Chart */}
      <div className="card" style={{ padding: 18 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
          Portfolio value
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={result.series} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
            <defs>
              <linearGradient id="gScenario" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#00D4AA" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#00D4AA" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gBaseline" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#8a8f99" stopOpacity={0.18} />
                <stop offset="100%" stopColor="#8a8f99" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
            <XAxis
              dataKey="day"
              stroke="var(--text-dim)"
              fontSize={10}
              tickFormatter={(d: number) => `D${d}`}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="var(--text-dim)"
              fontSize={10}
              tickFormatter={(v: number) => fmtUsd(v)}
              tickLine={false}
              axisLine={false}
              width={70}
            />
            <Tooltip
              contentStyle={{
                background: "var(--surface-2)",
                border: "1px solid var(--line)",
                borderRadius: 6,
                fontSize: 12,
              }}
              labelFormatter={(d) =>
                `Day ${d} · ${result.series[Number(d)]?.date ?? ""}`
              }
              formatter={(v, name) => [fmtUsd(Number(v)), String(name)]}
            />
            <Legend
              wrapperStyle={{ fontSize: 12 }}
              formatter={(v: string) => (v === "totalUsd" ? "Scenario" : "Baseline")}
            />
            {isStress && (
              <Area
                type="monotone"
                dataKey="baselineUsd"
                stroke="#8a8f99"
                strokeDasharray="4 4"
                fill="url(#gBaseline)"
                strokeWidth={1.5}
              />
            )}
            <Area
              type="monotone"
              dataKey="totalUsd"
              stroke="#00D4AA"
              fill="url(#gScenario)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Per-pool breakdown */}
      <div className="card" style={{ padding: 18 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
          Per-pool breakdown
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ color: "var(--text-dim)", textAlign: "left" }}>
                <th style={{ padding: "8px 4px", fontWeight: 500 }}>Pool</th>
                <th style={{ padding: "8px 4px", fontWeight: 500, textAlign: "right" }}>Weight</th>
                <th style={{ padding: "8px 4px", fontWeight: 500, textAlign: "right" }}>Mean APY</th>
                <th style={{ padding: "8px 4px", fontWeight: 500, textAlign: "right" }}>Start</th>
                <th style={{ padding: "8px 4px", fontWeight: 500, textAlign: "right" }}>End</th>
                <th style={{ padding: "8px 4px", fontWeight: 500, textAlign: "right" }}>Return</th>
              </tr>
            </thead>
            <tbody>
              {result.poolBreakdown.map((p) => (
                <tr key={p.poolId} style={{ borderTop: "1px solid var(--line)" }}>
                  <td style={{ padding: "10px 4px" }}>
                    <div style={{ fontWeight: 500 }}>{p.symbol}</div>
                    <div style={{ fontSize: 11, color: "var(--text-dim)" }}>
                      {p.protocol} · {p.chain}
                    </div>
                  </td>
                  <td className="mono" style={{ padding: "10px 4px", textAlign: "right" }}>
                    {p.weightPct.toFixed(1)}%
                  </td>
                  <td className="mono" style={{ padding: "10px 4px", textAlign: "right" }}>
                    {p.meanApy.toFixed(2)}%
                  </td>
                  <td className="mono" style={{ padding: "10px 4px", textAlign: "right" }}>
                    {fmtUsd(p.startUsd)}
                  </td>
                  <td className="mono" style={{ padding: "10px 4px", textAlign: "right" }}>
                    {fmtUsd(p.endUsd)}
                  </td>
                  <td
                    className="mono"
                    style={{
                      padding: "10px 4px",
                      textAlign: "right",
                      color: p.returnPct >= 0 ? "#10b981" : "#ef4444",
                    }}
                  >
                    {fmtPct(p.returnPct)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {result.skipped.length > 0 && (
          <div style={{ marginTop: 10, fontSize: 11.5, color: "var(--text-dim)" }}>
            Skipped (insufficient history): {result.skipped.length} pool(s).
          </div>
        )}
      </div>

      <div
        style={{
          fontSize: 11,
          color: "var(--text-dim)",
          padding: "0 4px",
          lineHeight: 1.5,
        }}
      >
        Replay-based estimate. Past APY does not guarantee future returns. Stress
        scenarios are heuristic shocks, not predictions.
      </div>
    </>
  );
}

function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "good" | "bad" | "neutral";
}) {
  const color =
    tone === "good" ? "#10b981" : tone === "bad" ? "#ef4444" : "var(--text-1)";
  return (
    <div className="card" style={{ padding: 14 }}>
      <div
        style={{
          fontSize: 11,
          color: "var(--text-dim)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div className="mono" style={{ fontSize: 22, fontWeight: 600, color, lineHeight: 1.2 }}>
        {value}
      </div>
      {hint && (
        <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 4 }}>{hint}</div>
      )}
    </div>
  );
}

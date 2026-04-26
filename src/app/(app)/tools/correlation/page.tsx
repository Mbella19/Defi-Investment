"use client";

import { useEffect, useMemo, useState } from "react";
import { Icons, ThemeToggle } from "@/components/sovereign";

interface LivePool {
  poolId: string;
  symbol: string;
  protocol: string;
  chain: string;
  tvlUsd: number;
  apy: number;
}

interface MatrixResponse {
  poolIds: string[];
  windowDays: number;
  overlapDays: number;
  startDate: string;
  endDate: string;
  matrix: number[][];
  missing: string[];
}

const WINDOWS: Array<{ label: string; days: number }> = [
  { label: "30D", days: 30 },
  { label: "90D", days: 90 },
  { label: "180D", days: 180 },
];

const MAX_POOLS = 12;

function correlationColor(value: number): string {
  if (!Number.isFinite(value)) return "var(--surface-3)";
  // Bipolar scale: -1 (uncorrelated) → blue, 0 → neutral, +1 (correlated) → red.
  // Diversification logic = lower abs(corr) is better for portfolio construction.
  const v = Math.max(-1, Math.min(1, value));
  if (v >= 0) {
    const alpha = v;
    return `rgba(239, 68, 68, ${alpha.toFixed(2)})`;
  }
  const alpha = -v;
  return `rgba(56, 189, 248, ${alpha.toFixed(2)})`;
}

function correlationLabel(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return value.toFixed(2);
}

export default function CorrelationPage() {
  const [pools, setPools] = useState<LivePool[]>([]);
  const [poolsErr, setPoolsErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<LivePool[]>([]);
  const [search, setSearch] = useState("");
  const [windowDays, setWindowDays] = useState(90);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<MatrixResponse | null>(null);
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

  const filtered = useMemo(() => {
    if (pools.length === 0) return [];
    const q = search.trim().toLowerCase();
    const selectedIds = new Set(selected.map((p) => p.poolId));
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
    if (selected.length >= MAX_POOLS) return;
    if (selected.some((p) => p.poolId === pool.poolId)) return;
    setSelected([...selected, pool]);
    setResult(null);
  }

  function removePool(poolId: string) {
    setSelected(selected.filter((p) => p.poolId !== poolId));
    setResult(null);
  }

  async function compute() {
    if (selected.length < 2) return;
    setRunning(true);
    setErr(null);
    setResult(null);
    try {
      const res = await fetch("/api/tools/correlation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          poolIds: selected.map((p) => p.poolId),
          windowDays,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setResult(data as MatrixResponse);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }

  const labelMap = useMemo(() => {
    const m = new Map<string, LivePool>();
    for (const p of selected) m.set(p.poolId, p);
    return m;
  }, [selected]);

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
          <div className="eyebrow">MODEL · CORRELATION</div>
          <h1
            className="display"
            style={{ fontSize: 28, margin: "6px 0 2px", letterSpacing: "-0.02em" }}
          >
            Diversified, in fact.
          </h1>
          <div style={{ fontSize: 13, color: "var(--text-dim)" }}>
            Pools that move together aren&rsquo;t diversification — they&rsquo;re the same bet, twice.
          </div>
        </div>
        <ThemeToggle />
      </div>

      {/* ---------- SELECTOR ---------- */}
      <div className="card" style={{ padding: 18 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 12,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 600 }}>Selected pools</div>
          <div className="mono" style={{ fontSize: 11, color: "var(--text-dim)" }}>
            {selected.length}/{MAX_POOLS}
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
            Pick 2–{MAX_POOLS} pools from the list below.
          </div>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {selected.map((p) => (
              <button
                key={p.poolId}
                type="button"
                onClick={() => removePool(p.poolId)}
                className="chip"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "5px 10px",
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                <span style={{ color: "var(--text-1)" }}>
                  {p.symbol} <span style={{ color: "var(--text-dim)" }}>· {p.protocol}</span>
                </span>
                <Icons.x size={11} />
              </button>
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
                maxHeight: 280,
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
                    disabled={selected.length >= MAX_POOLS}
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
                      cursor: selected.length >= MAX_POOLS ? "not-allowed" : "pointer",
                      fontSize: 12.5,
                      textAlign: "left",
                      opacity: selected.length >= MAX_POOLS ? 0.5 : 1,
                    }}
                  >
                    <div style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      <span style={{ fontWeight: 500 }}>{p.symbol}</span>
                      <span style={{ color: "var(--text-dim)" }}>
                        {" · "}
                        {p.protocol} · {p.chain}
                      </span>
                    </div>
                    <span className="mono" style={{ fontSize: 11, color: "var(--text-dim)", textAlign: "right" }}>
                      {p.apy.toFixed(2)}%
                    </span>
                    <span className="mono" style={{ fontSize: 11, color: "var(--text-dim)", textAlign: "right" }}>
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

      {/* ---------- COMPUTE ---------- */}
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
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 12, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Window
          </span>
          <div style={{ display: "flex", gap: 4 }}>
            {WINDOWS.map((w) => {
              const active = w.days === windowDays;
              return (
                <button
                  key={w.days}
                  type="button"
                  onClick={() => setWindowDays(w.days)}
                  style={{
                    padding: "6px 12px",
                    fontSize: 12,
                    background: active ? "var(--accent)" : "var(--surface-2)",
                    color: active ? "var(--accent-text)" : "var(--text-1)",
                    border: "1px solid var(--line)",
                    borderRadius: 6,
                    cursor: "pointer",
                    fontWeight: active ? 600 : 400,
                  }}
                >
                  {w.label}
                </button>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          className="btn"
          onClick={compute}
          disabled={running || selected.length < 2}
        >
          {running ? "Computing…" : "Compute matrix"}
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

      {/* ---------- HEATMAP ---------- */}
      {result && (
        <div className="card" style={{ padding: 18 }}>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              marginBottom: 14,
              flexWrap: "wrap",
              gap: 6,
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 600 }}>Heatmap</div>
            <div className="mono" style={{ fontSize: 11, color: "var(--text-dim)" }}>
              {result.overlapDays} overlapping days · {result.startDate} → {result.endDate}
            </div>
          </div>

          <HeatmapGrid result={result} labelMap={labelMap} />

          <div
            style={{
              marginTop: 18,
              display: "flex",
              alignItems: "center",
              gap: 16,
              fontSize: 11,
              color: "var(--text-dim)",
              flexWrap: "wrap",
            }}
          >
            <span>Legend:</span>
            <LegendCell label="−1.00" color={correlationColor(-1)} />
            <LegendCell label="0" color={correlationColor(0)} />
            <LegendCell label="+1.00" color={correlationColor(1)} />
            <span style={{ marginLeft: "auto" }}>
              Lower abs(corr) = better diversification.
            </span>
          </div>

          {result.missing.length > 0 && (
            <div
              style={{
                marginTop: 12,
                fontSize: 11.5,
                color: "var(--text-dim)",
              }}
            >
              Skipped (no usable history): {result.missing.length} pool(s).
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function LegendCell({ label, color }: { label: string; color: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      <span
        style={{
          width: 14,
          height: 14,
          background: color,
          border: "1px solid var(--line)",
          borderRadius: 3,
        }}
      />
      <span className="mono">{label}</span>
    </span>
  );
}

function HeatmapGrid({
  result,
  labelMap,
}: {
  result: MatrixResponse;
  labelMap: Map<string, { symbol: string; protocol: string }>;
}) {
  const labels = result.poolIds.map((id) => {
    const meta = labelMap.get(id);
    return meta ? `${meta.symbol} · ${meta.protocol}` : id.slice(0, 8);
  });

  const cellSize = 64;
  const headerW = 200;

  return (
    <div style={{ overflowX: "auto" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `${headerW}px repeat(${labels.length}, ${cellSize}px)`,
          gap: 2,
        }}
      >
        <div />
        {labels.map((l, j) => (
          <div
            key={`col-${j}`}
            style={{
              fontSize: 10.5,
              color: "var(--text-dim)",
              textAlign: "center",
              padding: "0 4px",
              wordBreak: "break-word",
              lineHeight: 1.2,
            }}
            title={l}
          >
            {l}
          </div>
        ))}

        {labels.map((rowLabel, i) => (
          <div key={`row-${i}`} style={{ display: "contents" }}>
            <div
              style={{
                fontSize: 11,
                color: "var(--text-1)",
                textAlign: "right",
                padding: "0 8px",
                alignSelf: "center",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
              title={rowLabel}
            >
              {rowLabel}
            </div>
            {result.matrix[i].map((v, j) => (
              <div
                key={`cell-${i}-${j}`}
                style={{
                  width: cellSize,
                  height: cellSize,
                  background: correlationColor(v),
                  border: "1px solid var(--line)",
                  borderRadius: 4,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 12,
                  fontFamily: "ui-monospace, monospace",
                  color: Math.abs(v) > 0.5 ? "#fff" : "var(--text-1)",
                }}
                title={`${labels[i]}  ↔  ${labels[j]}: ${correlationLabel(v)}`}
              >
                {correlationLabel(v)}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

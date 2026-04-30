"use client";

import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { Network, Plus, Search, X } from "lucide-react";
import {
  ChainBadge,
  CommandStrip,
  EmptyState,
  MetricTile,
} from "@/components/site/ui";
import { PoolIcon } from "@/components/site/PoolIcon";
import {
  chainIdFromName,
  formatPct,
  formatUsd,
} from "@/lib/design-utils";
import type { LivePool } from "@/app/api/yields/live/route";
import { usePlan } from "@/hooks/usePlan";
import { Paywall } from "@/components/site/Paywall";

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

const MAX_SELECTED = 8;

function correlationHue(value: number): string {
  if (!Number.isFinite(value)) return "#1e2226";
  if (value > 0.66) return "#fb7185";
  if (value > 0.34) return "#fbbf24";
  if (value > 0.1) return "#60a5fa";
  return "#6ee7b7";
}

export default function CorrelationPage() {
  const plan = usePlan();
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
    fetch("/api/yields/live", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (abort) return;
        if (Array.isArray(d.pools)) {
          setPools(d.pools as LivePool[]);
          // Pre-seed with the first five top-TVL pools so the matrix has shape on first paint.
          setSelected((current) => (current.length === 0 ? (d.pools as LivePool[]).slice(0, 5) : current));
        } else {
          setPoolsErr(d.error ?? "Failed to load market list");
        }
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
    return pools
      .filter((p) => !selectedIds.has(p.poolId))
      .filter((p) => {
        if (!q) return true;
        return (
          p.symbol.toLowerCase().includes(q) ||
          p.protocol.toLowerCase().includes(q) ||
          p.chain.toLowerCase().includes(q)
        );
      })
      .slice(0, 30);
  }, [pools, selected, search]);

  async function compute() {
    if (selected.length < 2) {
      setErr("Select at least 2 pools.");
      return;
    }
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
      if (!res.ok) throw new Error(data.error ?? `Correlation failed (${res.status})`);
      setResult(data as MatrixResponse);
    } catch (caught) {
      setErr(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setRunning(false);
    }
  }

  const matrix = result?.matrix ?? [];
  const orderedSelected = useMemo(() => {
    if (!result) return selected;
    const map = new Map(selected.map((p) => [p.poolId, p]));
    return result.poolIds.map((id) => map.get(id)).filter((p): p is LivePool => Boolean(p));
  }, [selected, result]);

  const meanRel = useMemo(() => {
    if (matrix.length < 2) return null;
    let total = 0;
    let count = 0;
    for (let i = 0; i < matrix.length; i++) {
      for (let j = i + 1; j < matrix.length; j++) {
        const v = matrix[i][j];
        if (Number.isFinite(v)) {
          total += v;
          count += 1;
        }
      }
    }
    return count === 0 ? null : total / count;
  }, [matrix]);

  const lowestPair = useMemo(() => {
    if (matrix.length < 2) return null;
    let lo = Infinity;
    for (let i = 0; i < matrix.length; i++) {
      for (let j = i + 1; j < matrix.length; j++) {
        if (Number.isFinite(matrix[i][j])) lo = Math.min(lo, matrix[i][j]);
      }
    }
    return Number.isFinite(lo) ? lo : null;
  }, [matrix]);

  const highestPair = useMemo(() => {
    if (matrix.length < 2) return null;
    let hi = -Infinity;
    for (let i = 0; i < matrix.length; i++) {
      for (let j = i + 1; j < matrix.length; j++) {
        if (Number.isFinite(matrix[i][j])) hi = Math.max(hi, matrix[i][j]);
      }
    }
    return Number.isFinite(hi) ? hi : null;
  }, [matrix]);

  return (
    <div className="page">
      <div className="page-title">
        <div>
          <p className="eyebrow">Tools / Correlation</p>
          <h1>Find crowded exposure early.</h1>
          <p>
            Pearson correlation across up to {MAX_SELECTED} live pools using day-over-day
            APY changes. Lower magnitudes = better diversification.
          </p>
        </div>
      </div>

      <CommandStrip
        file="file/06b.correlation"
        items={[
          { label: "selected", value: String(selected.length), tone: "ok" },
          { label: "window", value: `${windowDays}d`, tone: "info" },
          { label: "limit", value: `${MAX_SELECTED} pools`, tone: "warn" },
        ]}
      />

      {!plan.isLoading && !plan.capabilities.toolCorrelation ? (
        <Paywall
          title="Correlation matrix unlocks on Pro"
          body="Pearson correlation across up to 12 live pools — surfaces crowded exposure before you size capital. Available on Pro and Ultra."
          requiredTier="pro"
          currentTier={plan.tier}
          feature="Correlation"
        />
      ) : null}

      <div className="metric-grid" style={{ marginBottom: 18 }}>
        <MetricTile label="Selected" value={String(selected.length)} icon={Network} tone="#60a5fa" />
        <MetricTile
          label="Mean relation"
          value={meanRel == null ? "—" : meanRel.toFixed(2)}
          icon={Network}
          tone="#6ee7b7"
        />
        <MetricTile
          label="Lowest pair"
          value={lowestPair == null ? "—" : lowestPair.toFixed(2)}
          icon={Network}
          tone="#fbbf24"
        />
        <MetricTile
          label="Highest pair"
          value={highestPair == null ? "—" : highestPair.toFixed(2)}
          icon={Network}
          tone="#fb7185"
        />
      </div>

      <div className="page-tools" style={{ marginBottom: 18 }}>
        <div className="filter-row">
          {WINDOWS.map((w) => (
            <button
              type="button"
              key={w.label}
              className={`chip-button ${windowDays === w.days ? "active" : ""}`}
              onClick={() => setWindowDays(w.days)}
            >
              {w.label}
            </button>
          ))}
        </div>
        <div className="filter-row">
          <button type="button" className="ghost-button" onClick={() => setSelected([])}>
            <X size={16} aria-hidden="true" /> Clear
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={compute}
            disabled={running || selected.length < 2}
          >
            <Network size={16} aria-hidden="true" />
            {running ? "Computing…" : "Compute matrix"}
          </button>
        </div>
      </div>

      {err ? (
        <div className="ticker" style={{ marginBottom: 18 }}>
          <span className="severity-high">{err}</span>
        </div>
      ) : null}

      <div className="tool-layout">
        <div className="tool-stack">
          {orderedSelected.length < 2 ? (
            <EmptyState
              icon={Network}
              title="Pick at least two pools"
              body="Use the search panel on the right to add up to eight pools to the matrix."
            />
          ) : !result ? (
            <EmptyState
              icon={Network}
              title="Matrix not yet computed"
              body="Press Compute matrix to pull live yield history and build the correlation grid."
            />
          ) : (
            <div
              className="correlation-grid"
              style={{ "--matrix-size": orderedSelected.length } as React.CSSProperties}
            >
              {matrix.map((row, rowIndex) =>
                row.map((value, colIndex) => {
                  const hue = correlationHue(value);
                  return (
                    <div
                      className="correlation-cell"
                      key={`${rowIndex}-${colIndex}`}
                      style={{
                        background: `color-mix(in srgb, ${hue} ${Math.round(Math.abs(value) * 62)}%, rgba(30,34,38,.92))`,
                      }}
                    >
                      <div>
                        {Number.isFinite(value) ? value.toFixed(2) : "—"}
                        <small>{orderedSelected[colIndex]?.symbol}</small>
                      </div>
                    </div>
                  );
                }),
              )}
            </div>
          )}

          {result?.missing && result.missing.length > 0 ? (
            <div className="ticker">
              <span className="severity-medium">
                Skipped: {result.missing.length} pool(s) had insufficient history.
              </span>
            </div>
          ) : null}
        </div>

        <aside className="boost-panel">
          <p className="eyebrow">Selected ({selected.length}/{MAX_SELECTED})</p>
          <div className="allocation-list" style={{ marginBottom: 14 }}>
            {selected.length === 0 ? (
              <span style={{ fontSize: 13, color: "var(--muted)" }}>None yet — add pools below.</span>
            ) : (
              selected.map((pool) => (
                <button
                  key={`sel-${pool.poolId}`}
                  type="button"
                  className="allocation-row tab-button active"
                  onClick={() =>
                    setSelected((current) => current.filter((p) => p.poolId !== pool.poolId))
                  }
                >
                  <div className="token-cell">
                    <PoolIcon symbol={pool.symbol} protocol={pool.protocol} category={pool.category} />
                    <div>
                      <strong>{pool.symbol}</strong>
                      <span>
                        {pool.protocol} · {formatPct(pool.apy)}
                      </span>
                    </div>
                  </div>
                  <ChainBadge chain={chainIdFromName(pool.chain)} />
                  <X size={16} aria-hidden="true" />
                </button>
              ))
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
            <div className="allocation-list" style={{ maxHeight: 360, overflowY: "auto" }}>
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
                    disabled={selected.length >= MAX_SELECTED}
                    onClick={() =>
                      setSelected((current) =>
                        current.length < MAX_SELECTED ? [...current, pool] : current,
                      )
                    }
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
        </aside>
      </div>
    </div>
  );
}

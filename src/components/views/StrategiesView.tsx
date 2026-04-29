"use client";

import { useState, useEffect } from "react";
import { useActiveStrategies } from "@/hooks/useActiveStrategies";
import { fmt, Eyebrow, Icons } from "@/components/sovereign";
import type { ActiveStrategy, StrategyStatus } from "@/types/active-strategy";
import type { ApyForecast } from "@/lib/apy-forecast";

const DIRECTION_COLOR: Record<ApyForecast["direction"], string> = {
  rising: "var(--good)",
  stable: "var(--text-dim)",
  falling: "var(--danger)",
  volatile: "var(--warn)",
  unknown: "var(--text-muted)",
};

const DIRECTION_GLYPH: Record<ApyForecast["direction"], string> = {
  rising: "▲",
  stable: "→",
  falling: "▼",
  volatile: "~",
  unknown: "·",
};

const STATUS_COLOR: Record<StrategyStatus, string> = {
  active: "var(--good)",
  paused: "var(--warn)",
  archived: "var(--text-muted)",
};

// Resolve the canonical "open this market in its native venue" URL. Beefy
// pools are prefixed `beefy-` in our pool aggregator (see pool-aggregator.ts),
// everything else is a DeFiLlama pool UUID.
function poolDeepLink(poolId: string): string {
  if (poolId.startsWith("beefy-")) {
    return `https://app.beefy.com/vault/${poolId.slice("beefy-".length)}`;
  }
  return `https://defillama.com/yields/pool/${poolId}`;
}

export default function StrategiesPage() {
  const {
    strategies,
    isLoading,
    error,
    updateStatus,
    deleteStrategy,
    runScan,
  } = useActiveStrategies();
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<{
    scanned: number;
    newAlerts: unknown[];
  } | null>(null);

  const handleScan = async (strategyId?: string) => {
    setScanning(true);
    setScanResult(null);
    try {
      const result = await runScan(strategyId);
      setScanResult(result);
    } catch {
      /* handled by hook */
    } finally {
      setScanning(false);
    }
  };

  const activeCount = strategies.filter((s) => s.status === "active").length;
  const totalBudget = strategies
    .filter((s) => s.status === "active")
    .reduce((sum, s) => sum + s.totalBudget, 0);
  const totalAlerts = strategies.reduce(
    (sum, s) => sum + (s.alertCount || 0),
    0
  );

  return (
    <div style={{ padding: "40px 48px 96px", maxWidth: 1440, margin: "0 auto" }}>
      <section style={{ marginBottom: 40 }}>
        <Eyebrow>Allocations / Monitoring</Eyebrow>
        <h1
          className="display"
          style={{
            fontSize: "clamp(34px, 5vw, 56px)",
            fontWeight: 600,
            letterSpacing: "-0.04em",
            lineHeight: 0.98,
            margin: "14px 0 14px",
            color: "var(--text)",
          }}
        >
          Active allocations.
        </h1>
        <p
          style={{
            fontSize: 14,
            color: "var(--text-dim)",
            lineHeight: 1.65,
            maxWidth: 620,
          }}
        >
          Monitor proposed or active DeFi income allocations in one place. Review
          exposure, projected income, and position alerts without handing over custody.
        </p>
      </section>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 1,
          background: "var(--line)",
          border: "1px solid var(--line)",
          marginBottom: 24,
        }}
      >
        <Stat label="Active" value={activeCount.toString()} color="var(--good)" />
        <Stat label="Tracked Capital" value={fmt.money(totalBudget)} />
        <Stat
          label="Open Alerts"
          value={totalAlerts.toString()}
          color={totalAlerts > 0 ? "var(--danger)" : undefined}
        />
        <Stat label="All Allocations" value={strategies.length.toString()} />
      </div>

      {activeCount > 0 && (
        <button
          onClick={() => handleScan()}
          disabled={scanning}
          className="mono"
          style={{
            width: "100%",
            padding: "18px 24px",
            background: scanning ? "var(--surface-2)" : "var(--accent)",
            color: scanning ? "var(--text-dim)" : "var(--bg)",
            border: `1px solid ${scanning ? "var(--line)" : "var(--accent)"}`,
            fontSize: 11,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            fontWeight: 600,
            cursor: scanning ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            marginBottom: 24,
          }}
        >
          {scanning ? (
            <>
              <span
                style={{
                  width: 6,
                  height: 6,
                  background: "var(--accent)",
                  animation: "blink 1s ease-in-out infinite",
                }}
              />
              Refreshing monitored allocations…
            </>
          ) : (
            <>
              <Icons.refresh />
              Refresh Monitoring
            </>
          )}
        </button>
      )}

      {scanResult && (
        <div
          style={{
            border: "1px solid var(--accent)",
            background: "var(--accent-soft)",
            padding: "12px 16px",
            color: "var(--accent)",
            fontSize: 12,
            marginBottom: 24,
          }}
          className="mono"
        >
          Reviewed {scanResult.scanned}{" "}
          {scanResult.scanned === 1 ? "allocation" : "allocations"} —{" "}
          {scanResult.newAlerts.length > 0
            ? `${scanResult.newAlerts.length} new alert${
                scanResult.newAlerts.length === 1 ? "" : "s"
              } generated`
            : "no new alerts"}
        </div>
      )}

      {error && (
        <div
          style={{
            border: "1px solid var(--danger)",
            background: "color-mix(in oklab, var(--danger) 10%, transparent)",
            padding: "12px 16px",
            color: "var(--danger)",
            fontSize: 13,
            marginBottom: 24,
          }}
        >
          {error}
        </div>
      )}

      {isLoading && (
        <div
          style={{
            border: "1px solid var(--line)",
            background: "var(--surface)",
            padding: "32px",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: 10,
            marginBottom: 24,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              background: "var(--accent)",
              animation: "blink 1s ease-in-out infinite",
            }}
          />
          <span
            className="mono"
            style={{
              fontSize: 11,
              color: "var(--text-dim)",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
            }}
          >
            Loading strategies…
          </span>
        </div>
      )}

      {!isLoading && strategies.length === 0 && (
        <div
          className="brackets"
          style={{
            border: "1px solid var(--line)",
            background: "var(--surface)",
            padding: "56px 32px",
            textAlign: "center",
          }}
        >
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
            <Icons.monitor
              width={28}
              height={28}
              style={{ color: "var(--text-dim)" }}
            />
          </div>
          <p
            className="mono"
            style={{
              fontSize: 11,
              color: "var(--text-dim)",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              marginBottom: 18,
            }}
          >
            No allocations under monitoring.
          </p>
          <a
            href="/discover"
            className="mono"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              padding: "14px 24px",
              background: "var(--accent)",
              color: "var(--bg)",
              fontSize: 11,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Create allocation <Icons.arrow />
          </a>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {strategies.map((s) => (
          <StrategyCard
            key={s.id}
            strategy={s}
            onStatusChange={updateStatus}
            onDelete={deleteStrategy}
            onScan={() => handleScan(s.id)}
            scanning={scanning}
          />
        ))}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div style={{ background: "var(--surface)", padding: "22px 22px" }}>
      <div
        className="mono"
        style={{
          fontSize: 9,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: "var(--text-dim)",
          marginBottom: 10,
        }}
      >
        {label}
      </div>
      <div
        className="serif tabular"
        style={{
          fontSize: 28,
          fontWeight: 700,
          letterSpacing: "-0.03em",
          color: color || "var(--text)",
          lineHeight: 1,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function StrategyCard({
  strategy: s,
  onStatusChange,
  onDelete,
  onScan,
  scanning,
}: {
  strategy: ActiveStrategy;
  onStatusChange: (id: string, status: StrategyStatus) => void;
  onDelete: (id: string) => void;
  onScan: () => void;
  scanning: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [forecasts, setForecasts] = useState<Record<string, ApyForecast | null>>({});
  const [forecastsLoading, setForecastsLoading] = useState(false);
  const statusColor = STATUS_COLOR[s.status];

  useEffect(() => {
    if (!expanded) return;
    const ids = s.strategy.allocations.map((a) => a.poolId);
    if (ids.length === 0) return;
    if (ids.every((id) => id in forecasts)) return;

    let cancelled = false;
    // Defer the loading flip past the effect's sync phase so the React
    // Compiler's set-state-in-effect rule doesn't fire. The flag is only
    // read by descendants — there's no cascade in practice — but the rule
    // doesn't know that.
    queueMicrotask(() => {
      if (!cancelled) setForecastsLoading(true);
    });
    fetch("/api/strategies/forecast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ poolIds: ids }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`forecast ${r.status}`))))
      .then((data: { forecasts: Array<{ poolId: string; forecast: ApyForecast | null }> }) => {
        if (cancelled) return;
        const next: Record<string, ApyForecast | null> = {};
        for (const item of data.forecasts) next[item.poolId] = item.forecast;
        setForecasts((prev) => ({ ...prev, ...next }));
      })
      .catch(() => {
        /* leave empty — UI shows em-dashes */
      })
      .finally(() => {
        if (!cancelled) setForecastsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [expanded, s.id, s.strategy.allocations, forecasts]);

  return (
    <div
      className="brackets"
      style={{
        border: "1px solid var(--line)",
        background: "var(--surface)",
      }}
    >
      <div style={{ padding: "22px 26px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 24,
            flexWrap: "wrap",
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 10,
              }}
            >
              <span
                className="mono"
                style={{
                  fontSize: 10,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color: statusColor,
                  border: `1px solid ${statusColor}`,
                  padding: "3px 8px",
                }}
              >
                {s.status}
              </span>
              {(s.alertCount ?? 0) > 0 && (
                <span
                  className="mono"
                  style={{
                    fontSize: 10,
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    color: "var(--danger)",
                    border: "1px solid var(--danger)",
                    padding: "3px 8px",
                  }}
                >
                  {s.alertCount} alert{(s.alertCount ?? 0) !== 1 ? "s" : ""}
                </span>
              )}
            </div>
            <p
              style={{
                fontSize: 13,
                color: "var(--text-dim)",
                lineHeight: 1.5,
                margin: 0,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {s.strategy.summary.slice(0, 150)}…
            </p>
          </div>
          <div style={{ display: "flex", gap: 24, flexShrink: 0 }}>
            <div style={{ textAlign: "center" }}>
              <div
                className="serif"
                style={{
                  fontSize: 26,
                  fontWeight: 700,
                  color: "var(--accent)",
                  letterSpacing: "-0.03em",
                  lineHeight: 1,
                }}
              >
                {s.projectedApy.toFixed(1)}%
              </div>
              <div
                className="mono"
                style={{
                  fontSize: 9,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color: "var(--text-dim)",
                  marginTop: 6,
                }}
              >
                Projected APY
              </div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div
                className="serif"
                style={{
                  fontSize: 26,
                  fontWeight: 700,
                  color: "var(--text)",
                  letterSpacing: "-0.03em",
                  lineHeight: 1,
                }}
              >
                {fmt.money(s.totalBudget)}
              </div>
              <div
                className="mono"
                style={{
                  fontSize: 9,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color: "var(--text-dim)",
                  marginTop: 6,
                }}
              >
                Capital
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            marginTop: 16,
          }}
        >
          {s.status === "active" && (
            <TinyBtn onClick={() => onStatusChange(s.id, "paused")}>Pause</TinyBtn>
          )}
          {s.status === "paused" && (
            <TinyBtn onClick={() => onStatusChange(s.id, "active")}>
              Resume
            </TinyBtn>
          )}
          {s.status !== "archived" && (
            <TinyBtn onClick={() => onStatusChange(s.id, "archived")}>
              Archive
            </TinyBtn>
          )}
          {s.status === "active" && (
            <TinyBtn
              onClick={onScan}
              disabled={scanning}
              emphasis="accent"
            >
              {scanning ? "Reviewing…" : "Review Now"}
            </TinyBtn>
          )}
          <TinyBtn onClick={() => setExpanded((v) => !v)}>
            {expanded ? "Collapse" : "Details"}
          </TinyBtn>
          <TinyBtn
            onClick={() => {
              if (confirm("Delete this allocation and all related alerts?"))
                onDelete(s.id);
            }}
            emphasis="danger"
            style={{ marginLeft: "auto" }}
          >
            Delete
          </TinyBtn>
        </div>
      </div>

      {expanded && (
        <div style={{ borderTop: "1px solid var(--line-2)", padding: "22px 26px" }}>
          <div
            className="mono"
            style={{
              fontSize: 10,
              color: "var(--text-dim)",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              marginBottom: 12,
            }}
          >
            Created {new Date(s.createdAt).toLocaleString()} ·{" "}
            {s.strategy.allocations.length} markets · {s.criteria.riskAppetite} risk profile
          </div>

          <div style={{ overflowX: "auto" }}>
            <div
              style={{
                minWidth: 820,
                display: "grid",
                gridTemplateColumns: "1.4fr 0.8fr 0.7fr 0.7fr 1.1fr 0.9fr 0.6fr",
                gap: 10,
                padding: "8px 0",
                borderBottom: "1px solid var(--line-2)",
              }}
            >
              {["Market", "Chain", "Entry APY", "Current APY", "30d View", "Capital", "Quality"].map(
                (h, i) => (
                  <span
                    key={h}
                    className="mono"
                    style={{
                      fontSize: 9,
                      color: "var(--text-dim)",
                      letterSpacing: "0.18em",
                      textTransform: "uppercase",
                      textAlign: i >= 2 ? "right" : "left",
                    }}
                  >
                    {h}
                  </span>
                ),
              )}
            </div>
            {s.strategy.allocations.map((a, i) => {
              const safetyColor =
                a.legitimacyScore >= 70
                  ? "var(--good)"
                  : a.legitimacyScore >= 50
                  ? "var(--warn)"
                  : "var(--danger)";
              const fc = forecasts[a.poolId];
              const hasForecast = fc != null;
              const directionColor = hasForecast ? DIRECTION_COLOR[fc!.direction] : "var(--text-muted)";
              const directionGlyph = hasForecast ? DIRECTION_GLYPH[fc!.direction] : "·";
              return (
                <a
                  key={i}
                  href={poolDeepLink(a.poolId)}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`Open ${a.protocol} ${a.symbol} on ${a.poolId.startsWith("beefy-") ? "Beefy" : "DeFiLlama"}`}
                  style={{
                    minWidth: 820,
                    display: "grid",
                    gridTemplateColumns: "1.4fr 0.8fr 0.7fr 0.7fr 1.1fr 0.9fr 0.6fr",
                    gap: 10,
                    padding: "10px 0",
                    borderBottom: "1px solid var(--line-2)",
                    alignItems: "center",
                    color: "inherit",
                    textDecoration: "none",
                    cursor: "pointer",
                    transition: "background 0.12s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "var(--surface-2)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  <div>
                    <span
                      className="mono"
                      style={{
                        fontSize: 12,
                        color: "var(--text)",
                        letterSpacing: "0.04em",
                      }}
                    >
                      {a.protocol}
                    </span>{" "}
                    <span
                      className="mono"
                      style={{ fontSize: 11, color: "var(--text-dim)" }}
                    >
                      {a.symbol}
                    </span>
                  </div>
                  <span
                    className="mono"
                    style={{ fontSize: 11, color: "var(--text-dim)" }}
                  >
                    {a.chain}
                  </span>
                  <span
                    className="mono tabular"
                    style={{
                      fontSize: 12,
                      color: "var(--accent)",
                      textAlign: "right",
                    }}
                  >
                    {a.apy.toFixed(1)}%
                  </span>
                  <span
                    className="mono tabular"
                    style={{
                      fontSize: 12,
                      color: hasForecast ? "var(--text)" : "var(--text-muted)",
                      textAlign: "right",
                    }}
                  >
                    {hasForecast ? `${fc!.currentApy.toFixed(1)}%` : forecastsLoading ? "…" : "—"}
                  </span>
                  <span
                    className="mono tabular"
                    title={
                      hasForecast
                        ? `${fc!.direction.toUpperCase()} · ${fc!.confidence} confidence · ${fc!.sampleDays}d sample · slope ${fc!.details.slopePerDay >= 0 ? "+" : ""}${fc!.details.slopePerDay.toFixed(3)}/d · 90d median ${fc!.details.median90d.toFixed(1)}%`
                        : forecastsLoading
                        ? "Loading forecast…"
                        : "Forecast unavailable"
                    }
                    style={{
                      fontSize: 12,
                      color: directionColor,
                      textAlign: "right",
                      display: "inline-flex",
                      gap: 6,
                      justifyContent: "flex-end",
                      alignItems: "center",
                    }}
                  >
                    {hasForecast ? (
                      <>
                        <span style={{ fontSize: 10 }}>{directionGlyph}</span>
                        <span>{fc!.projectedApy30d.toFixed(1)}%</span>
                        <span
                          style={{
                            fontSize: 8,
                            letterSpacing: "0.16em",
                            color: "var(--text-muted)",
                            textTransform: "uppercase",
                          }}
                        >
                          {fc!.confidence === "high" ? "H" : fc!.confidence === "medium" ? "M" : "L"}
                        </span>
                      </>
                    ) : forecastsLoading ? (
                      "…"
                    ) : (
                      "—"
                    )}
                  </span>
                  <span
                    className="mono tabular"
                    style={{
                      fontSize: 12,
                      color: "var(--text)",
                      textAlign: "right",
                    }}
                  >
                    {fmt.money(a.allocationAmount)}
                  </span>
                  <span
                    className="mono tabular"
                    style={{
                      fontSize: 12,
                      color: safetyColor,
                      textAlign: "right",
                    }}
                  >
                    {a.legitimacyScore}
                  </span>
                </a>
              );
            })}
          </div>

          <div
            className="mono"
            style={{
              fontSize: 9,
              color: "var(--text-muted)",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              marginTop: 12,
              lineHeight: 1.6,
            }}
          >
            Projections are directional estimates from recent market behavior. Confidence: H/M/L.
          </div>
        </div>
      )}
    </div>
  );
}

function TinyBtn({
  onClick,
  children,
  disabled,
  emphasis,
  style,
}: {
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  emphasis?: "accent" | "danger";
  style?: React.CSSProperties;
}) {
  const color =
    emphasis === "accent"
      ? "var(--accent)"
      : emphasis === "danger"
      ? "var(--danger)"
      : "var(--text-dim)";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="mono"
      style={{
        padding: "8px 14px",
        background: "transparent",
        color,
        border: `1px solid ${
          emphasis ? color : "var(--line-2)"
        }`,
        fontSize: 10,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

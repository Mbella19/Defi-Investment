"use client";

import { useMemo, useState } from "react";
import { Spark } from "./Spark";
import { Stat } from "./Stat";
import { useLiveYields, formatRefreshAge, formatTvl } from "@/hooks/useLiveYields";

const TIMEFRAMES = [
  { id: "7D", days: 7 },
  { id: "30D", days: 30 },
  { id: "90D", days: 90 },
  { id: "1Y", days: 365 },
] as const;

type TimeframeId = (typeof TIMEFRAMES)[number]["id"];

export function HeroChart() {
  const { data, loading, error, fetchedAt } = useLiveYields();
  const [tf, setTf] = useState<TimeframeId>("30D");

  const series = data?.series ?? [];
  const sliced = useMemo(() => {
    const days = TIMEFRAMES.find((t) => t.id === tf)?.days ?? 30;
    return series.slice(-days);
  }, [series, tf]);

  const apyPoints = sliced.map((p) => p.apy);
  const currentApy = data?.top50Avg30dApy ?? 0;
  const delta = data?.delta24h ?? 0;
  const deltaSign = delta >= 0;

  const yLabels = useMemo(() => {
    if (apyPoints.length < 2) return ["—", "—", "—"];
    const max = Math.max(...apyPoints);
    const min = Math.min(...apyPoints);
    const mid = (max + min) / 2;
    return [`${max.toFixed(1)}%`, `${mid.toFixed(1)}%`, `${min.toFixed(1)}%`];
  }, [apyPoints]);

  return (
    <div
      style={{
        position: "relative",
        padding: 24,
        background: "var(--surface)",
        border: "1px solid var(--line)",
        borderRadius: 10,
        boxShadow: "var(--shadow-md)",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: -16,
          right: 24,
          padding: "7px 12px",
          background: "var(--text)",
          color: "var(--bg)",
          borderRadius: 999,
          fontSize: 11,
          fontWeight: 500,
          letterSpacing: "0.02em",
          display: "inline-flex",
          alignItems: "center",
          gap: 7,
          boxShadow: "var(--shadow-md)",
          zIndex: 3,
        }}
      >
        <span
          className="pulse-dot"
          style={{
            width: 6,
            height: 6,
            borderRadius: 999,
            background: error ? "var(--danger)" : "var(--accent)",
            boxShadow: error
              ? "0 0 8px var(--danger)"
              : "0 0 8px var(--accent)",
          }}
        />
        {error
          ? "Stale · retry pending"
          : loading && !data
            ? "Connecting…"
            : `Live · refreshed ${formatRefreshAge(fetchedAt)}`}
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 16,
          gap: 12,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div className="eyebrow">{tf} AVG · TOP 50 MARKETS</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
            <span
              className="num display"
              style={{ fontSize: 42, fontWeight: 500, letterSpacing: "-0.035em", lineHeight: 1 }}
            >
              {currentApy.toFixed(2)}
              <span style={{ color: "var(--text-dim)", fontSize: 24, fontWeight: 400 }}>%</span>
            </span>
            {data ? (
              <span
                className={deltaSign ? "delta-up" : "delta-dn"}
                style={{ fontSize: 13 }}
              >
                {deltaSign ? "▲" : "▼"} {Math.abs(delta).toFixed(2)}
              </span>
            ) : null}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            gap: 2,
            padding: 3,
            background: "var(--surface-2)",
            border: "1px solid var(--line)",
            borderRadius: 10,
            flexShrink: 0,
          }}
        >
          {TIMEFRAMES.map((t) => {
            const on = tf === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTf(t.id)}
                style={{
                  padding: "5px 12px",
                  fontSize: 11,
                  fontWeight: 500,
                  border: 0,
                  borderRadius: 7,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  background: on ? "var(--surface)" : "transparent",
                  color: on ? "var(--text)" : "var(--text-dim)",
                  boxShadow: on ? "var(--shadow-xs)" : "none",
                }}
              >
                {t.id}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ position: "relative", height: 180 }}>
        {apyPoints.length > 1 ? (
          <Spark data={apyPoints} color="var(--accent)" height={180} fill animated={false} />
        ) : (
          <div
            style={{
              height: 180,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--text-muted)",
              fontSize: 12,
            }}
          >
            {loading ? "Loading 30-day series…" : "Series unavailable"}
          </div>
        )}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            height: "100%",
            pointerEvents: "none",
          }}
        >
          {yLabels.map((y, i) => (
            <span
              key={`${y}-${i}`}
              className="mono"
              style={{ fontSize: 9.5, color: "var(--text-muted)", letterSpacing: "0.04em" }}
            >
              {y}
            </span>
          ))}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 16,
          marginTop: 20,
          paddingTop: 18,
          borderTop: "1px solid var(--line)",
        }}
      >
        <Stat
          label="TVL TRACKED"
          value={data ? formatTvl(data.totalTvl) : "—"}
          sub="live feed"
          size="sm"
        />
        <Stat
          label="MARKETS INDEXED"
          value={data ? data.poolCount.toLocaleString() : "—"}
          sub={data ? `across ${data.chainCount} chains` : "—"}
          size="sm"
        />
        <Stat
          label="DATA REFRESH"
          value={fetchedAt ? formatRefreshAge(fetchedAt) : "—"}
          sub="auto-refresh 60s"
          size="sm"
        />
      </div>
    </div>
  );
}

export default HeroChart;

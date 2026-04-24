"use client";

import { useMemo } from "react";
import { Spark } from "./Spark";
import { Stat } from "./Stat";

function walk(seed: number, n = 60, start = 52, vol = 2.2): number[] {
  let x = seed * 9301 + 49297;
  const out: number[] = [start];
  for (let i = 1; i < n; i++) {
    x = (x * 9301 + 49297) % 233280;
    const r = x / 233280 - 0.5;
    out.push(Math.max(1, out[i - 1] + r * vol + (seed % 3 === 0 ? 0.08 : -0.03)));
  }
  return out;
}

type Props = {
  apy?: number;
  delta?: string;
};

export function HeroChart({ apy = 8.42, delta = "0.34" }: Props) {
  const data = useMemo(() => walk(7, 60, 52, 2.2), []);
  return (
    <div
      style={{
        position: "relative",
        padding: 24,
        background: "var(--surface)",
        border: "1px solid var(--line)",
        borderRadius: 22,
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
        }}
      >
        <span
          className="pulse-dot"
          style={{
            width: 6,
            height: 6,
            borderRadius: 999,
            background: "var(--accent)",
            boxShadow: "0 0 8px var(--accent)",
          }}
        />
        Live · updates every 12s
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div>
          <div className="eyebrow">30-DAY AVG · TOP 50 POOLS</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 8 }}>
            <span
              className="num display"
              style={{ fontSize: 42, fontWeight: 500, letterSpacing: "-0.035em", lineHeight: 1 }}
            >
              {apy.toFixed(2)}
              <span style={{ color: "var(--text-dim)", fontSize: 24, fontWeight: 400 }}>%</span>
            </span>
            <span className="delta-up" style={{ fontSize: 13 }}>
              ▲ {delta}
            </span>
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
          }}
        >
          {["7D", "30D", "90D", "1Y"].map((tl, i) => (
            <button
              key={tl}
              type="button"
              style={{
                padding: "5px 12px",
                fontSize: 11,
                fontWeight: 500,
                border: 0,
                borderRadius: 7,
                cursor: "pointer",
                fontFamily: "inherit",
                background: i === 1 ? "var(--surface)" : "transparent",
                color: i === 1 ? "var(--text)" : "var(--text-dim)",
                boxShadow: i === 1 ? "var(--shadow-xs)" : "none",
              }}
            >
              {tl}
            </button>
          ))}
        </div>
      </div>

      <div style={{ position: "relative", height: 180 }}>
        <Spark data={data} color="var(--accent)" height={180} fill animated={false} />
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
          {["10%", "8%", "6%"].map((y) => (
            <span
              key={y}
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
        <Stat label="TVL TRACKED" value="$38.4B" sub="via DeFiLlama" size="sm" />
        <Stat label="POOLS INDEXED" value="9,812" sub="across 43 chains" size="sm" />
        <Stat label="DATA REFRESH" value="12s ago" sub="every new block" size="sm" />
      </div>
    </div>
  );
}

export default HeroChart;

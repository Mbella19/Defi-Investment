"use client";

import { useMemo } from "react";
import { ChainGlyph } from "./ChainGlyph";
import { useLiveYields } from "@/hooks/useLiveYields";

export type TapeRow = {
  pool: string;
  protocol: string;
  chain: string;
  apy: number;
  d: number;
};

type Props = {
  rows?: TapeRow[];
  count?: number;
};

const KEEP_CATEGORIES = new Set(["Lending", "LST", "LP", "Yield"]);

export function YieldTape({ rows, count = 14 }: Props) {
  const { data, error } = useLiveYields();

  const tapeRows = useMemo<TapeRow[]>(() => {
    if (rows && rows.length > 0) return rows;
    const pools = data?.pools ?? [];
    if (pools.length === 0) return [];
    return pools
      .filter((p) => KEEP_CATEGORIES.has(p.category) || p.stablecoin)
      .filter((p) => p.tvlUsd >= 25_000_000)
      .filter((p) => Number.isFinite(p.apy) && p.apy >= 0.5 && p.apy < 100)
      .slice(0, count)
      .map((p) => ({
        pool: p.symbol,
        protocol: p.protocol,
        chain: p.chain,
        apy: p.apy,
        d:
          typeof p.apyPct1D === "number" && Number.isFinite(p.apyPct1D)
            ? (p.apy * p.apyPct1D) / 100
            : 0,
      }));
  }, [rows, data, count]);

  if (tapeRows.length === 0) {
    return (
      <div
        style={{
          height: 42,
          width: "100%",
          borderTop: "1px solid var(--line)",
          borderBottom: "1px solid var(--line)",
          background: "var(--surface)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 11,
          color: "var(--text-dim)",
        }}
      >
        {error ? "Live tape unavailable — retrying" : "Loading live tape…"}
      </div>
    );
  }

  const doubled = [...tapeRows, ...tapeRows];

  return (
    <div
      style={{
        overflow: "hidden",
        width: "100%",
        borderTop: "1px solid var(--line)",
        borderBottom: "1px solid var(--line)",
        background: "var(--surface)",
      }}
    >
      <div
        style={{
          display: "flex",
          animation: "marquee 80s linear infinite",
          width: "max-content",
          whiteSpace: "nowrap",
        }}
      >
        {doubled.map((r, i) => (
          <div
            key={i}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 12,
              padding: "0 22px",
              height: 42,
              borderRight: "1px solid var(--line)",
            }}
          >
            <ChainGlyph id={r.chain} size={16} label={false} />
            <span className="mono" style={{ fontSize: 11.5, color: "var(--text-1)", fontWeight: 500 }}>
              {r.pool}
            </span>
            <span style={{ fontSize: 11, color: "var(--text-dim)" }}>{r.protocol}</span>
            <span className="num" style={{ fontSize: 13, fontWeight: 500, color: "var(--text)" }}>
              {r.apy.toFixed(2)}%
            </span>
            <span className={r.d >= 0 ? "delta-up" : "delta-dn"} style={{ fontSize: 10.5 }}>
              {r.d >= 0 ? "▲" : "▼"} {Math.abs(r.d).toFixed(2)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default YieldTape;

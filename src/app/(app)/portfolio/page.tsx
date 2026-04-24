"use client";

import { useMemo } from "react";
import {
  Icons,
  ChainGlyph,
  TokenGlyph,
  Spark,
  Stat,
  RiskBar,
} from "@/components/sovereign";
import { POSITIONS, walk } from "@/lib/demo-data";

const ALLOC = [
  { ch: "eth" as const, pct: 66, col: "var(--c-eth)" },
  { ch: "base" as const, pct: 22, col: "var(--c-base)" },
  { ch: "arb" as const, pct: 12, col: "var(--c-arb)" },
];

const NEXT_ACTIONS = [
  { d: "Rebalance sDAI → 35% (drift +3%)", k: "3d" },
  { d: "GHO APY dropped 0.4% — review", k: "now" },
];

export default function PortfolioPage() {
  const chart = useMemo(() => walk(21, 80, 100, 2.5), []);
  const mobileChart = useMemo(() => walk(22, 50, 100, 2.4), []);

  return (
    <>
      {/* ---------- DESKTOP ---------- */}
      <div className="page-wrap">
        <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr 1fr 1fr", gap: 16 }}>
          <div
            className="card-raised"
            style={{
              padding: 20,
              display: "flex",
              flexDirection: "column",
              gap: 10,
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div className="eyebrow">NET VALUE</div>
              <span className="chip good mono">
                <span className="dot good" /> EARNING
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
              <span
                className="num display"
                style={{ fontSize: 38, fontWeight: 500, letterSpacing: "-0.025em" }}
              >
                $128,412.<span style={{ color: "var(--text-dim)" }}>24</span>
              </span>
              <span className="delta-up">▲ $3,284 · 2.63%</span>
            </div>
            <div
              style={{
                position: "absolute",
                right: -10,
                bottom: 0,
                width: "55%",
                height: 80,
                opacity: 0.9,
              }}
            >
              <Spark data={chart} stroke="var(--accent)" height={80} />
            </div>
          </div>
          <div className="card" style={{ padding: 18 }}>
            <Stat
              label="BLENDED APY"
              value="7.84%"
              delta="0.12"
              deltaUp
              sub="across 4 positions"
            />
          </div>
          <div className="card" style={{ padding: 18 }}>
            <Stat label="24H YIELD" value="$28.14" sub="paid to wallet" />
          </div>
          <div className="card" style={{ padding: 18 }}>
            <Stat label="PORTFOLIO SAFETY" value="89" sub="weighted by size" />
            <div style={{ marginTop: 10 }}>
              <RiskBar value={89} />
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.7fr 1fr", gap: 16 }}>
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div
              style={{
                padding: "14px 18px",
                borderBottom: "1px solid var(--line)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>Positions</div>
                <div style={{ fontSize: 11.5, color: "var(--text-dim)" }}>
                  4 active · 1 rebalance due in 3d
                </div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button type="button" className="btn btn-ghost btn-sm">
                  Export
                </button>
                <button type="button" className="btn btn-sm">
                  <Icons.plus size={13} /> Add position
                </button>
              </div>
            </div>
            {POSITIONS.map((r, i) => (
              <div
                key={`d-${r.p}-${i}`}
                style={{
                  padding: "14px 18px",
                  display: "grid",
                  gridTemplateColumns: "1.8fr 0.8fr 1.2fr 1fr 0.8fr 0.6fr",
                  alignItems: "center",
                  gap: 8,
                  borderBottom:
                    i === POSITIONS.length - 1 ? "none" : "1px solid var(--line)",
                  fontSize: 13,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <TokenGlyph sym={r.p} size={28} />
                  <div style={{ lineHeight: 1.25 }}>
                    <div style={{ fontWeight: 500 }}>{r.p}</div>
                    <div style={{ fontSize: 11.5, color: "var(--text-dim)" }}>{r.pr}</div>
                  </div>
                </div>
                <ChainGlyph id={r.ch} size={16} />
                <div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 11,
                      color: "var(--text-dim)",
                      marginBottom: 4,
                    }}
                  >
                    <span>{r.alloc}%</span>
                  </div>
                  <div className="risk-track">
                    <div
                      className="risk-fill"
                      style={{ width: `${r.alloc}%`, background: "var(--accent)" }}
                    />
                  </div>
                </div>
                <span className="num">{r.val}</span>
                <span className="num" style={{ color: "var(--text-1)" }}>
                  {r.apy}%
                </span>
                <span className="delta-up" style={{ justifySelf: "end" }}>
                  {r.pnl}
                </span>
              </div>
            ))}
          </div>

          <div className="card" style={{ padding: 18 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: 14,
              }}
            >
              <div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>Allocation</div>
                <div style={{ fontSize: 11.5, color: "var(--text-dim)" }}>By chain</div>
              </div>
              <button type="button" className="btn btn-ghost btn-sm">
                Rebalance
              </button>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
              <svg viewBox="0 0 42 42" width={120} height={120}>
                <circle cx="21" cy="21" r="15.9" fill="none" stroke="var(--surface-3)" strokeWidth="5" />
                {[
                  { v: 66, c: "var(--c-eth)", o: 0 },
                  { v: 22, c: "var(--c-base)", o: -66 },
                  { v: 12, c: "var(--c-arb)", o: -88 },
                ].map((s, i) => (
                  <circle
                    key={i}
                    cx="21"
                    cy="21"
                    r="15.9"
                    fill="none"
                    stroke={s.c}
                    strokeWidth="5"
                    strokeDasharray={`${s.v} ${100 - s.v}`}
                    strokeDashoffset={s.o}
                    transform="rotate(-90 21 21)"
                  />
                ))}
                <text
                  x="21"
                  y="22"
                  textAnchor="middle"
                  fontFamily="Geist Mono"
                  fontSize="6"
                  fill="var(--text)"
                  fontWeight="600"
                >
                  3 chains
                </text>
              </svg>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                {ALLOC.map((r) => (
                  <div
                    key={r.ch}
                    style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}
                  >
                    <span style={{ width: 8, height: 8, background: r.col, borderRadius: 2 }} />
                    <ChainGlyph id={r.ch} size={14} />
                    <span
                      className="num"
                      style={{ marginLeft: "auto", color: "var(--text-1)" }}
                    >
                      {r.pct}%
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <hr className="hr" style={{ margin: "16px 0" }} />
            <div
              className="eyebrow"
              style={{ fontSize: 10, color: "var(--text-dim)", marginBottom: 8 }}
            >
              NEXT ACTIONS
            </div>
            {NEXT_ACTIONS.map((a, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "8px 0",
                  borderTop: i > 0 ? "1px dashed var(--line)" : "none",
                  fontSize: 12.5,
                  gap: 10,
                }}
              >
                <span style={{ color: "var(--text-1)" }}>{a.d}</span>
                <span className="chip mono" style={{ fontSize: 10 }}>
                  {a.k}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ---------- MOBILE ---------- */}
      <div className="mobile-only">
        <div className="m-header">
          <div>
            <div className="m-title">Portfolio</div>
            <div className="m-sub">4 POSITIONS · 3 CHAINS</div>
          </div>
        </div>
        <div className="m-content">
          <div className="card-raised" style={{ padding: 18 }}>
            <div className="eyebrow" style={{ fontSize: 10 }}>
              NET VALUE
            </div>
            <div
              className="num display"
              style={{
                fontSize: 30,
                fontWeight: 500,
                letterSpacing: "-0.025em",
                marginTop: 4,
              }}
            >
              $128,412<span style={{ color: "var(--text-dim)" }}>.24</span>
            </div>
            <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 2 }}>
              ▲ $3,284 · 2.63% · 24h
            </div>
            <div style={{ height: 100, margin: "12px 0 4px" }}>
              <Spark data={mobileChart} stroke="var(--accent)" height={100} />
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 11,
                color: "var(--text-dim)",
              }}
            >
              <span>1D</span>
              <span>7D</span>
              <span style={{ color: "var(--accent)", fontWeight: 600 }}>30D</span>
              <span>90D</span>
              <span>ALL</span>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div className="card" style={{ padding: 12 }}>
              <Stat size="sm" label="BLENDED APY" value="7.84%" />
            </div>
            <div className="card" style={{ padding: 12 }}>
              <Stat size="sm" label="SAFETY" value="89/100" />
            </div>
          </div>

          <div>
            <div style={{ fontSize: 13, fontWeight: 600, padding: "4px 2px 10px" }}>
              Positions
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {POSITIONS.map((r, i) => (
                <div key={`m-${r.p}-${i}`} className="card" style={{ padding: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <TokenGlyph sym={r.p} size={30} />
                    <div style={{ flex: 1, minWidth: 0, lineHeight: 1.25 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{r.p}</div>
                      <div style={{ fontSize: 11.5, color: "var(--text-dim)" }}>
                        {r.pr}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div className="num" style={{ fontSize: 13, fontWeight: 500 }}>
                        {r.val}
                      </div>
                      <div
                        className="num"
                        style={{ fontSize: 11, color: "var(--good)" }}
                      >
                        {r.apy}%
                      </div>
                    </div>
                  </div>
                  <div className="risk-track" style={{ marginTop: 8, height: 3 }}>
                    <div
                      className="risk-fill"
                      style={{ width: `${r.alloc}%`, background: "var(--accent)" }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

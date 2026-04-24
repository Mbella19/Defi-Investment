"use client";

import { useMemo, useState } from "react";
import {
  Icons,
  ChainGlyph,
  CHAINS,
  TokenGlyph,
  Spark,
  RiskBar,
  type ChainId,
} from "@/components/sovereign";
import { POOLS, fmtTVL, walk } from "@/lib/demo-data";

const CHAIN_FILTERS: Array<{ id: "All" | ChainId; label: string }> = [
  { id: "All", label: "All" },
  { id: "eth", label: "ETH" },
  { id: "arb", label: "ARB" },
  { id: "op", label: "OP" },
  { id: "base", label: "BASE" },
  { id: "sol", label: "SOL" },
];
const TYPE_FILTERS = ["All", "Lending", "LST", "LP", "Yield", "Synth"] as const;
const RISK_BANDS = ["Safe", "Balanced", "Degen"] as const;

const MOBILE_CHIPS = ["Safe", "Balanced", "Degen", "Lending", "LST", "LP"] as const;

export default function DiscoverPage() {
  const [risk, setRisk] = useState<(typeof RISK_BANDS)[number]>("Balanced");
  const [chain, setChain] = useState<"All" | ChainId>("All");
  const [type, setType] = useState<(typeof TYPE_FILTERS)[number]>("All");
  const [mobileChip, setMobileChip] = useState<(typeof MOBILE_CHIPS)[number]>("Safe");

  const sparks = useMemo(() => POOLS.map((_, i) => walk(i + 1, 24, 50, 3)), []);

  return (
    <>
      {/* ---------- DESKTOP ---------- */}
      <div className="page-wrap">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div className="eyebrow">DISCOVER</div>
            <h1
              className="display"
              style={{ fontSize: 28, margin: "6px 0 2px", letterSpacing: "-0.02em" }}
            >
              Find yield that matches your risk.
            </h1>
            <div style={{ fontSize: 13, color: "var(--text-dim)" }}>
              9,812 pools indexed · data via DeFiLlama · updated 12s ago
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-sm" type="button">
              <Icons.filter size={13} /> Saved filters
            </button>
            <button className="btn btn-primary btn-sm" type="button">
              <Icons.zap size={13} /> AI Strategy
            </button>
          </div>
        </div>

        <div
          className="card"
          style={{
            padding: 16,
            display: "grid",
            gridTemplateColumns: "1.2fr 1fr 1fr 1fr 1fr",
            gap: 12,
            alignItems: "end",
          }}
        >
          <div>
            <div className="eyebrow" style={{ fontSize: 9.5, marginBottom: 6 }}>
              BUDGET
            </div>
            <div style={{ position: "relative" }}>
              <span
                className="mono"
                style={{
                  position: "absolute",
                  left: 12,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--text-dim)",
                  fontSize: 13,
                }}
              >
                $
              </span>
              <input
                className="input mono"
                defaultValue="50,000"
                style={{ paddingLeft: 22 }}
              />
            </div>
          </div>
          <div>
            <div className="eyebrow" style={{ fontSize: 9.5, marginBottom: 6 }}>
              RISK BAND
            </div>
            <div
              style={{
                display: "flex",
                background: "var(--surface-2)",
                border: "1px solid var(--line)",
                borderRadius: 8,
                padding: 2,
              }}
            >
              {RISK_BANDS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRisk(r)}
                  style={{
                    flex: 1,
                    textAlign: "center",
                    padding: "7px 8px",
                    fontSize: 12,
                    fontWeight: 500,
                    borderRadius: 6,
                    cursor: "pointer",
                    background: risk === r ? "var(--surface)" : "transparent",
                    color: risk === r ? "var(--text)" : "var(--text-dim)",
                    boxShadow: risk === r ? "var(--shadow-xs)" : "none",
                    border: 0,
                    fontFamily: "inherit",
                  }}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="eyebrow" style={{ fontSize: 9.5, marginBottom: 6 }}>
              CHAIN
            </div>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {CHAIN_FILTERS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setChain(c.id)}
                  className="chip"
                  style={{
                    cursor: "pointer",
                    fontFamily: "inherit",
                    background: chain === c.id ? "var(--accent-soft)" : "var(--surface-2)",
                    color: chain === c.id ? "var(--accent)" : "var(--text-2)",
                    borderColor:
                      chain === c.id
                        ? "color-mix(in oklch, var(--accent) 32%, transparent)"
                        : "var(--line)",
                  }}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="eyebrow" style={{ fontSize: 9.5, marginBottom: 6 }}>
              TYPE
            </div>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {TYPE_FILTERS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className="chip"
                  style={{
                    cursor: "pointer",
                    fontFamily: "inherit",
                    background: type === t ? "var(--accent-soft)" : "var(--surface-2)",
                    color: type === t ? "var(--accent)" : "var(--text-2)",
                    borderColor:
                      type === t
                        ? "color-mix(in oklch, var(--accent) 32%, transparent)"
                        : "var(--line)",
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <button className="btn btn-primary" type="button">
            Run scan <Icons.arrow size={13} />
          </button>
        </div>

        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "2fr 1.1fr 1fr 1fr 1.2fr 1fr 0.6fr",
              padding: "10px 18px",
              background: "var(--surface-2)",
              borderBottom: "1px solid var(--line)",
              fontSize: 10.5,
              fontWeight: 500,
              color: "var(--text-dim)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            <span>Pool</span>
            <span>Chain</span>
            <span>TVL</span>
            <span>APY</span>
            <span>30d</span>
            <span>Safety</span>
            <span />
          </div>
          {POOLS.map((p, i) => (
            <div
              key={`${p.protocol}-${p.pool}-${i}`}
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 1.1fr 1fr 1fr 1.2fr 1fr 0.6fr",
                padding: "14px 18px",
                alignItems: "center",
                borderBottom: i === POOLS.length - 1 ? "none" : "1px solid var(--line)",
                fontSize: 13,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <TokenGlyph sym={p.pool.split(/[/ ]/)[0]} size={28} />
                <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.25 }}>
                  <span style={{ fontWeight: 500 }}>{p.pool}</span>
                  <span style={{ fontSize: 11.5, color: "var(--text-dim)" }}>
                    {p.protocol} · {p.type}
                  </span>
                </div>
              </div>
              <ChainGlyph id={p.chain} size={18} />
              <span className="num" style={{ color: "var(--text-1)" }}>
                {fmtTVL(p.tvl)}
              </span>
              <span className="num" style={{ fontWeight: 500, fontSize: 14 }}>
                {p.apy.toFixed(2)}%
              </span>
              <div style={{ width: 100 }}>
                <Spark
                  data={sparks[i]}
                  up={sparks[i][sparks[i].length - 1] > sparks[i][0]}
                  height={28}
                  fill={false}
                />
              </div>
              <div style={{ paddingRight: 16 }}>
                <RiskBar value={p.safe} />
              </div>
              <button
                className="btn btn-ghost btn-sm"
                type="button"
                style={{ justifySelf: "end" }}
              >
                <Icons.chevR size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ---------- MOBILE ---------- */}
      <div className="mobile-only">
        <div className="m-header">
          <div>
            <div className="m-title">Discover</div>
            <div className="m-sub">9,812 POOLS · LIVE</div>
          </div>
          <button type="button" className="m-icon-btn" aria-label="Filters">
            <Icons.filter size={18} />
          </button>
        </div>
        <div style={{ padding: "12px 16px" }}>
          <div className="chip-row">
            {MOBILE_CHIPS.map((c) => {
              const on = c === mobileChip;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setMobileChip(c)}
                  className="chip"
                  style={{
                    padding: "6px 12px",
                    fontSize: 12,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    background: on ? "var(--accent-soft)" : "var(--surface)",
                    color: on ? "var(--accent)" : "var(--text-2)",
                    borderColor: on
                      ? "color-mix(in oklch, var(--accent) 32%, transparent)"
                      : "var(--line)",
                  }}
                >
                  {c}
                </button>
              );
            })}
          </div>
        </div>
        <div
          style={{
            padding: "0 16px 100px",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          {POOLS.slice(0, 8).map((p, i) => (
            <article key={`m-${p.protocol}-${p.pool}-${i}`} className="card" style={{ padding: 14 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 10,
                }}
              >
                <TokenGlyph sym={p.pool.split(/[/ ]/)[0]} size={32} />
                <div style={{ flex: 1, lineHeight: 1.3, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{p.pool}</div>
                  <div style={{ fontSize: 11.5, color: "var(--text-dim)" }}>
                    {p.protocol} · {p.type}
                  </div>
                </div>
                <span
                  className="mono"
                  style={{
                    width: 22,
                    height: 22,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 10,
                    fontWeight: 600,
                    background: `color-mix(in oklch, ${
                      CHAINS[p.chain]?.color ?? "var(--c-eth)"
                    } 16%, transparent)`,
                    color: CHAINS[p.chain]?.color ?? "var(--c-eth)",
                    border: `1px solid color-mix(in oklch, ${
                      CHAINS[p.chain]?.color ?? "var(--c-eth)"
                    } 32%, transparent)`,
                    borderRadius: 6,
                  }}
                >
                  {CHAINS[p.chain]?.short[0] ?? "E"}
                </span>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1.1fr",
                  gap: 10,
                  alignItems: "baseline",
                }}
              >
                <div>
                  <div className="eyebrow" style={{ fontSize: 9 }}>
                    APY
                  </div>
                  <div
                    className="num"
                    style={{ fontSize: 17, fontWeight: 600, color: "var(--text)", marginTop: 4 }}
                  >
                    {p.apy.toFixed(2)}%
                  </div>
                </div>
                <div>
                  <div className="eyebrow" style={{ fontSize: 9 }}>
                    TVL
                  </div>
                  <div
                    className="num"
                    style={{ fontSize: 13, color: "var(--text-1)", marginTop: 4 }}
                  >
                    {fmtTVL(p.tvl)}
                  </div>
                </div>
                <div>
                  <div className="eyebrow" style={{ fontSize: 9 }}>
                    SAFETY
                  </div>
                  <div style={{ marginTop: 6 }}>
                    <RiskBar value={p.safe} />
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </>
  );
}

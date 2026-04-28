"use client";

import { useState } from "react";
import {
  Icons,
  ChainGlyph,
  CHAINS,
  TokenGlyph,
  Spark,
  RiskBar,
  ThemeToggle,
  AIStrategyModal,
} from "@/components/sovereign";
import { useLiveYields, formatRefreshAge, formatTvl } from "@/hooks/useLiveYields";
import type { LivePool } from "@/app/api/yields/live/route";

const CHAIN_FILTERS = [
  { id: "All", label: "All", match: (_c: string) => true },
  { id: "eth", label: "ETH", match: (c: string) => /^ethereum$/i.test(c) },
  { id: "arb", label: "ARB", match: (c: string) => /^arbitrum/i.test(c) },
  { id: "op", label: "OP", match: (c: string) => /^optimism$/i.test(c) },
  { id: "base", label: "BASE", match: (c: string) => /^base$/i.test(c) },
  { id: "poly", label: "POLY", match: (c: string) => /^polygon/i.test(c) },
  { id: "sol", label: "SOL", match: (c: string) => /^solana$/i.test(c) },
] as const;

const TYPE_FILTERS = ["All", "Lending", "LST", "LP", "Yield", "Synth"] as const;
const RISK_BANDS = ["Safe", "Balanced", "Opportunistic"] as const;
const MOBILE_CHIPS = ["Safe", "Balanced", "Opportunistic", "Lending", "LST", "LP"] as const;

type ChainFilterId = (typeof CHAIN_FILTERS)[number]["id"];

function riskMatches(p: LivePool, band: (typeof RISK_BANDS)[number]): boolean {
  if (band === "Safe") return (p.stablecoin || p.category === "LST") && p.apy <= 10;
  if (band === "Opportunistic") return p.apy >= 12;
  return p.apy >= 4 && p.apy <= 20;
}

function riskLabel(r: (typeof RISK_BANDS)[number] | (typeof MOBILE_CHIPS)[number]): string {
  return r;
}

function typeLabel(t: (typeof TYPE_FILTERS)[number]): string {
  return t === "Yield" ? "Income" : t;
}

function categoryLabel(category: string): string {
  return category === "Yield" ? "Income" : category;
}

function safetyScore(p: LivePool): number {
  let score = 50;
  if (p.tvlUsd > 1e9) score += 25;
  else if (p.tvlUsd > 1e8) score += 18;
  else if (p.tvlUsd > 1e7) score += 10;
  else if (p.tvlUsd < 1e6) score -= 15;
  if (p.stablecoin) score += 10;
  if (p.category === "LST") score += 8;
  if (p.apy > 50) score -= 25;
  else if (p.apy > 25) score -= 12;
  if (p.apyPct30D !== null && p.apyPct30D < -50) score -= 10;
  return Math.max(0, Math.min(100, score));
}

function buildSpark(p: LivePool): number[] {
  const apyNow = p.apy;
  const fromPct = (pct: number | null) =>
    pct !== null && Number.isFinite(pct) ? apyNow / (1 + pct / 100) : apyNow;
  return [
    fromPct(p.apyPct30D),
    fromPct(p.apyPct7D),
    fromPct(p.apyPct1D),
    apyNow,
  ];
}

export default function DiscoverPage() {
  const { data, loading, error, fetchedAt } = useLiveYields();
  const [risk, setRisk] = useState<(typeof RISK_BANDS)[number]>("Balanced");
  const [chain, setChain] = useState<ChainFilterId>("All");
  const [type, setType] = useState<(typeof TYPE_FILTERS)[number]>("All");
  const [budget, setBudget] = useState<number>(50000);
  const [mobileChip, setMobileChip] = useState<(typeof MOBILE_CHIPS)[number]>("Safe");
  const [aiOpen, setAiOpen] = useState(false);

  const pools = data?.pools ?? [];

  const chainFn =
    CHAIN_FILTERS.find((c) => c.id === chain)?.match ?? CHAIN_FILTERS[0].match;
  const filtered = pools
    .filter((p) => chainFn(p.chain))
    .filter((p) => type === "All" || p.category === type)
    .filter((p) => riskMatches(p, risk))
    .slice(0, 60);

  const mobileFiltered = RISK_BANDS.includes(mobileChip as (typeof RISK_BANDS)[number])
    ? pools.filter((p) => riskMatches(p, mobileChip as (typeof RISK_BANDS)[number])).slice(0, 12)
    : pools.filter((p) => p.category === mobileChip).slice(0, 12);

  const headerCount = data ? data.poolCount.toLocaleString() : "…";
  const headerAge = fetchedAt ? formatRefreshAge(fetchedAt) : "…";

  const liveBadge = error ? (
    <span style={{ color: "var(--danger)" }}>Live feed offline — showing cached</span>
  ) : (
    <>
      {headerCount} markets tracked · updated {headerAge}
    </>
  );

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
            <div className="eyebrow">MARKETS</div>
            <h1
              className="display"
              style={{ fontSize: 28, margin: "6px 0 2px", letterSpacing: "-0.02em" }}
            >
              Income markets, organized for allocation.
            </h1>
            <div style={{ fontSize: 13, color: "var(--text-dim)" }}>{liveBadge}</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-sm" type="button">
              <Icons.filter size={13} /> Saved views
            </button>
          </div>
        </div>

        {/* Allocation proposal hero */}
        <div
          style={{
            position: "relative",
            padding: "28px 32px",
            background:
              "linear-gradient(135deg, color-mix(in oklch, var(--accent) 14%, var(--surface)) 0%, var(--surface) 65%)",
            border: "1px solid color-mix(in oklch, var(--accent) 32%, var(--line))",
            borderRadius: 10,
            boxShadow: "var(--shadow-md)",
            display: "flex",
            gap: 32,
            alignItems: "center",
            flexWrap: "wrap",
            overflow: "hidden",
          }}
        >
          <div
            aria-hidden
            style={{
              position: "absolute",
              top: "-40%",
              right: "-6%",
              width: 320,
              height: 320,
              borderRadius: 999,
              background:
                "radial-gradient(circle, color-mix(in oklch, var(--accent) 22%, transparent) 0%, transparent 70%)",
              pointerEvents: "none",
            }}
          />
          <div style={{ flex: "1 1 380px", minWidth: 280, position: "relative", zIndex: 1 }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                padding: "5px 11px",
                background: "var(--accent-soft)",
                color: "var(--accent)",
                border: "1px solid color-mix(in oklch, var(--accent) 36%, transparent)",
                borderRadius: 999,
                fontSize: 10.5,
                fontWeight: 500,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                marginBottom: 14,
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
              Allocation Desk
            </div>
            <h2
              className="display"
              style={{
                fontSize: 32,
                margin: 0,
                letterSpacing: "-0.028em",
                lineHeight: 1.08,
                fontWeight: 500,
                color: "var(--text)",
              }}
            >
              Convert the shortlist into a mandate.
            </h2>
            <p
              style={{
                margin: "12px 0 18px",
                fontSize: 14,
                color: "var(--text-2)",
                maxWidth: 660,
                lineHeight: 1.55,
              }}
            >
              Set a budget and risk range, then generate a proposed allocation you can
              inspect, edit, and place under monitoring. Built for review before
              execution.
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[
                "Position sizing included",
                "Read-only monitoring available",
                "Source context close at hand",
              ].map((label) => (
                <span
                  key={label}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "5px 11px",
                    background: "var(--surface)",
                    border: "1px solid var(--line)",
                    borderRadius: 999,
                    fontSize: 11.5,
                    color: "var(--text-2)",
                    fontWeight: 500,
                  }}
                >
                  <span
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: 999,
                      background: "var(--accent)",
                    }}
                  />
                  {label}
                </span>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setAiOpen(true)}
            style={{
              position: "relative",
              zIndex: 1,
              padding: "18px 30px",
              fontSize: 15,
              fontWeight: 500,
              borderRadius: 8,
              border: 0,
              cursor: "pointer",
              fontFamily: "inherit",
              background: "var(--text)",
              color: "var(--bg)",
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              whiteSpace: "nowrap",
              boxShadow: "var(--shadow-md)",
              letterSpacing: "-0.005em",
              transition: "transform 0.15s, box-shadow 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-1px)";
              e.currentTarget.style.boxShadow = "var(--shadow-lg, var(--shadow-md))";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "none";
              e.currentTarget.style.boxShadow = "var(--shadow-md)";
            }}
          >
            <Icons.zap size={15} />
            Create allocation
            <Icons.arrow size={14} />
          </button>
        </div>

        <div
          className="card"
          style={{
            padding: 16,
            display: "grid",
            gridTemplateColumns: "1.2fr 1fr 1fr 1fr",
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
                type="number"
                min={100}
                step={100}
                value={budget}
                onChange={(e) => setBudget(Number(e.target.value || 0))}
                style={{ paddingLeft: 22 }}
              />
            </div>
          </div>
          <div>
            <div className="eyebrow" style={{ fontSize: 9.5, marginBottom: 6 }}>
              MANDATE
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
                  {riskLabel(r)}
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
              MARKET TYPE
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
                  {typeLabel(t)}
                </button>
              ))}
            </div>
          </div>
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
            <span>Market</span>
            <span>Chain</span>
            <span>TVL</span>
            <span>APY</span>
            <span>30d view</span>
            <span>Quality</span>
            <span />
          </div>
          {loading && filtered.length === 0 ? (
            <div style={{ padding: 32, textAlign: "center", color: "var(--text-dim)", fontSize: 13 }}>
              Fetching live pools…
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 32, textAlign: "center", color: "var(--text-dim)", fontSize: 13 }}>
              No markets match these filters. Broaden the mandate or chain selection.
            </div>
          ) : (
            filtered.map((p, i) => {
              const sparkData = buildSpark(p);
              const trendUp = sparkData[sparkData.length - 1] >= sparkData[0];
              const safety = safetyScore(p);
              return (
                <a
                  key={`${p.protocol}-${p.poolId}`}
                  href={`https://defillama.com/yields/pool/${p.poolId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "2fr 1.1fr 1fr 1fr 1.2fr 1fr 0.6fr",
                    padding: "14px 18px",
                    alignItems: "center",
                    borderBottom: i === filtered.length - 1 ? "none" : "1px solid var(--line)",
                    fontSize: 13,
                    textDecoration: "none",
                    color: "inherit",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-2)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    <TokenGlyph sym={p.symbol.split(/[/ \-]/)[0] || p.symbol} size={28} />
                    <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.25, minWidth: 0 }}>
                      <span
                        style={{
                          fontWeight: 500,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {p.symbol}
                      </span>
                      <span style={{ fontSize: 11.5, color: "var(--text-dim)" }}>
                        {p.protocol} · {categoryLabel(p.category)}
                      </span>
                    </div>
                  </div>
                  <ChainGlyph id={p.chain} size={18} />
                  <span className="num" style={{ color: "var(--text-1)" }}>
                    {formatTvl(p.tvlUsd)}
                  </span>
                  <span className="num" style={{ fontWeight: 500, fontSize: 14 }}>
                    {p.apy.toFixed(2)}%
                  </span>
                  <div style={{ width: 100 }}>
                    <Spark data={sparkData} up={trendUp} height={28} fill={false} />
                  </div>
                  <div style={{ paddingRight: 16 }}>
                    <RiskBar value={safety} />
                  </div>
                  <span
                    className="btn btn-ghost btn-sm"
                    style={{ justifySelf: "end", pointerEvents: "none" }}
                  >
                    <Icons.chevR size={14} />
                  </span>
                </a>
              );
            })
          )}
        </div>
      </div>

      {/* ---------- MOBILE ---------- */}
      <div className="mobile-only">
        <div className="m-header">
          <div>
            <div className="m-title">Markets</div>
            <div className="m-sub">{headerCount} POOLS · LIVE</div>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            <ThemeToggle variant="mobile" />
            <button
              type="button"
              className="m-icon-btn"
              aria-label="Create allocation"
              onClick={() => setAiOpen(true)}
            >
              <Icons.zap size={18} />
            </button>
          </div>
        </div>
        <div style={{ padding: "12px 16px 0" }}>
          <button
            type="button"
            onClick={() => setAiOpen(true)}
            style={{
              width: "100%",
              padding: "14px 16px",
              borderRadius: 10,
              border: "1px solid color-mix(in oklch, var(--accent) 32%, var(--line))",
              background:
                "linear-gradient(135deg, color-mix(in oklch, var(--accent) 16%, var(--surface)) 0%, var(--surface) 70%)",
              cursor: "pointer",
              fontFamily: "inherit",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              boxShadow: "var(--shadow-md)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
              <span
                style={{
                  width: 36,
                  height: 36,
                  flexShrink: 0,
                  borderRadius: 12,
                  background: "var(--text)",
                  color: "var(--bg)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icons.zap size={17} />
              </span>
              <div style={{ textAlign: "left", minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text)" }}>
                  Allocation Desk
                </div>
                <div
                  style={{
                    fontSize: 11.5,
                    color: "var(--text-dim)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  Build a proposal from the live market view.
                </div>
              </div>
            </div>
            <Icons.arrow size={15} />
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
                  {riskLabel(c)}
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
          {mobileFiltered.length === 0 && loading ? (
            <div style={{ textAlign: "center", color: "var(--text-dim)", fontSize: 13, padding: 20 }}>
              Loading live pools…
            </div>
          ) : (
            mobileFiltered.map((p) => {
              const safety = safetyScore(p);
              const chainColor = CHAINS[(p.chain.slice(0, 3).toLowerCase() as keyof typeof CHAINS)] ?? null;
              return (
                <a
                  key={`m-${p.protocol}-${p.poolId}`}
                  href={`https://defillama.com/yields/pool/${p.poolId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="card"
                  style={{ padding: 14, textDecoration: "none", color: "inherit" }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      marginBottom: 10,
                    }}
                  >
                    <TokenGlyph sym={p.symbol.split(/[/ \-]/)[0] || p.symbol} size={32} />
                    <div style={{ flex: 1, lineHeight: 1.3, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 500,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {p.symbol}
                      </div>
                      <div style={{ fontSize: 11.5, color: "var(--text-dim)" }}>
                        {p.protocol} · {categoryLabel(p.category)}
                      </div>
                    </div>
                    <span
                      className="mono"
                      style={{
                        padding: "2px 6px",
                        fontSize: 10,
                        fontWeight: 600,
                        background: chainColor
                          ? `color-mix(in oklch, ${chainColor.color} 16%, transparent)`
                          : "var(--surface-3)",
                        color: chainColor?.color ?? "var(--text-2)",
                        border: chainColor
                          ? `1px solid color-mix(in oklch, ${chainColor.color} 32%, transparent)`
                          : "1px solid var(--line)",
                        borderRadius: 6,
                      }}
                    >
                      {p.chain.slice(0, 4).toUpperCase()}
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
                        {formatTvl(p.tvlUsd)}
                      </div>
                    </div>
                    <div>
                      <div className="eyebrow" style={{ fontSize: 9 }}>
                        QUALITY
                      </div>
                      <div style={{ marginTop: 6 }}>
                        <RiskBar value={safety} />
                      </div>
                    </div>
                  </div>
                </a>
              );
            })
          )}
        </div>
      </div>

      <AIStrategyModal
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        initialBudget={budget}
        initialRisk={risk}
      />
    </>
  );
}

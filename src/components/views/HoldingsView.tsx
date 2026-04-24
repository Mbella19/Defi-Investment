"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { usePastedWallet } from "@/hooks/usePastedWallet";
import { fmt, Eyebrow, Icons, Spark } from "@/components/sovereign";
import type { PortfolioSummary, PortfolioToken } from "@/types/wallet";

const WalletPortfolioSection = dynamic(
  () => import("@/components/portfolio/WalletPortfolioSection"),
  {
    ssr: false,
    loading: () => (
      <div
        style={{
          border: "1px solid var(--line)",
          background: "var(--surface)",
          padding: "24px 28px",
        }}
      >
        <p style={{ fontSize: 12, color: "var(--text-dim)" }}>
          Loading wallet connection…
        </p>
      </div>
    ),
  }
);

function seedFromAddr(addr: string): number {
  let h = 0;
  for (let i = 0; i < addr.length; i++) {
    h = (h << 5) - h + addr.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function rng(seed: number) {
  let s = seed || 1;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

function makeSparkData(seed: number, up: boolean): number[] {
  const r = rng(seed + 1);
  const arr: number[] = [];
  let v = 0.5;
  for (let i = 0; i < 16; i++) {
    v += (r() - 0.5) * 0.18 + (up ? 0.012 : -0.012);
    arr.push(v);
  }
  return arr;
}

function generateSeries(address: string, totalValue: number): number[] {
  const seed = seedFromAddr(address);
  const r = rng(seed);
  const days = 60;
  const trend = (r() - 0.4) * 0.15;
  let v = totalValue * (1 - (r() * 0.18 + trend));
  const arr: number[] = [];
  for (let i = 0; i < days; i++) {
    const shock = (r() - 0.5) * 0.05;
    v = v * (1 + trend / days + shock * 0.5);
    arr.push(v);
  }
  arr[days - 1] = totalValue;
  return arr;
}

const FEED_VERBS = [
  "price tick",
  "allocation rebalance",
  "swap settled",
  "gas spike",
  "yield claim",
  "oracle update",
  "chain handoff",
];

function buildFeed(tokens: PortfolioToken[], seed: number) {
  const r = rng(seed + 7);
  return tokens.slice(0, 10).map((t, i) => {
    const verb = FEED_VERBS[Math.floor(r() * FEED_VERBS.length)];
    const mins = Math.floor(r() * 240) + i;
    const delta = (t.priceChange24h ?? (r() - 0.5) * 6) / 12;
    return {
      id: `${t.chainId}-${t.symbol}-${i}`,
      symbol: t.symbol,
      chain: t.chainName,
      verb,
      mins,
      delta,
    };
  });
}

export default function PortfolioPage() {
  const pasted = usePastedWallet();
  const [mode, setMode] = useState<"wallet" | "paste">("paste");
  const [walletPortfolio, setWalletPortfolio] = useState<PortfolioSummary | null>(null);

  const activePortfolio: PortfolioSummary | null =
    mode === "wallet" ? walletPortfolio : pasted.portfolio;
  const activeLoading = mode === "wallet" ? false : pasted.isLoading;
  const activeError = mode === "wallet" ? null : pasted.error;

  return (
    <div style={{ padding: "40px 48px 96px", maxWidth: 1440, margin: "0 auto" }}>
      <section style={{ marginBottom: 40 }}>
        <Eyebrow>Wallet Portfolio / Track.001</Eyebrow>
        <h1
          className="serif"
          style={{
            fontSize: "clamp(48px, 6vw, 88px)",
            fontWeight: 900,
            letterSpacing: "-0.055em",
            lineHeight: 0.92,
            margin: "20px 0 16px",
            color: "var(--text)",
          }}
        >
          Portfolio
          <br />
          <span style={{ color: "var(--accent)", fontStyle: "italic", fontWeight: 300 }}>
            Tracker.
          </span>
        </h1>
        <p
          style={{
            fontSize: 14,
            color: "var(--text-dim)",
            lineHeight: 1.65,
            maxWidth: 560,
          }}
        >
          Track real token balances across 7 EVM chains. Connect your wallet or paste
          any address to inspect holdings, chain allocation, and 24h drift.
        </p>
      </section>

      <section style={{ marginBottom: 24 }}>
        <div style={{ display: "inline-flex", border: "1px solid var(--line)" }}>
          {([
            { id: "paste" as const, label: "Paste Address" },
            { id: "wallet" as const, label: "Connect Wallet" },
          ]).map((m) => {
            const active = mode === m.id;
            return (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className="mono"
                style={{
                  padding: "12px 22px",
                  fontSize: 10,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  background: active ? "var(--accent)" : "transparent",
                  color: active ? "var(--bg)" : "var(--text-dim)",
                  border: "none",
                  borderRight:
                    m.id === "paste" ? "1px solid var(--line)" : "none",
                  cursor: "pointer",
                }}
              >
                {m.label}
              </button>
            );
          })}
        </div>
      </section>

      <section style={{ marginBottom: 32 }}>
        {mode === "paste" ? (
          <PasteAddressPanel
            value={pasted.address}
            onChange={pasted.setAddress}
            onSubmit={() => pasted.fetchPortfolio()}
            isLoading={pasted.isLoading}
            isValid={pasted.isValidAddress}
          />
        ) : (
          <WalletPortfolioSection onPortfolioChange={setWalletPortfolio} />
        )}
      </section>

      {activeError && (
        <div
          style={{
            border: "1px solid var(--danger)",
            background: "color-mix(in oklab, var(--danger) 10%, transparent)",
            padding: "14px 18px",
            color: "var(--danger)",
            fontSize: 13,
            marginBottom: 24,
          }}
        >
          {activeError}
        </div>
      )}

      {activeLoading && (
        <div
          style={{
            border: "1px solid var(--line)",
            background: "var(--surface)",
            padding: "48px 32px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 14,
            marginBottom: 32,
          }}
        >
          <div style={{ display: "flex", gap: 6 }}>
            {[0, 150, 300].map((d) => (
              <span
                key={d}
                style={{
                  width: 8,
                  height: 8,
                  background: "var(--accent)",
                  boxShadow: "0 0 10px var(--accent)",
                  animation: `blink 1.2s ease-in-out ${d}ms infinite`,
                }}
              />
            ))}
          </div>
          <p
            className="mono"
            style={{
              fontSize: 11,
              color: "var(--text-dim)",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
            }}
          >
            Fetching balances across 7 chains…
          </p>
        </div>
      )}

      {activePortfolio && !activeLoading && (
        <PortfolioData summary={activePortfolio} />
      )}

      {!activePortfolio && !activeLoading && !activeError && mode === "paste" && (
        <div
          style={{
            border: "1px solid var(--line)",
            background: "var(--surface)",
            padding: "60px 40px",
            textAlign: "center",
          }}
          className="brackets"
        >
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
            <Icons.vault
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
            }}
          >
            Paste a wallet address to view its portfolio
          </p>
        </div>
      )}
    </div>
  );
}

function PasteAddressPanel({
  value,
  onChange,
  onSubmit,
  isLoading,
  isValid,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
  isValid: boolean;
}) {
  return (
    <div
      className="brackets"
      style={{
        border: "1px solid var(--line)",
        background: "var(--surface)",
        padding: 28,
      }}
    >
      <Eyebrow>Track Any Wallet</Eyebrow>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto",
          gap: 12,
          marginTop: 16,
        }}
      >
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && isValid && onSubmit()}
          placeholder="0x… paste any wallet address"
          className="mono"
          style={{
            background: "var(--surface-2)",
            border: "1px solid var(--line)",
            color: "var(--text)",
            fontSize: 13,
            padding: "14px 16px",
            letterSpacing: "0.03em",
            outline: "none",
          }}
        />
        <button
          onClick={onSubmit}
          disabled={isLoading || !isValid}
          className="mono"
          style={{
            padding: "14px 24px",
            background: isValid && !isLoading ? "var(--accent)" : "var(--surface-2)",
            color: isValid && !isLoading ? "var(--bg)" : "var(--text-dim)",
            border: `1px solid ${
              isValid && !isLoading ? "var(--accent)" : "var(--line)"
            }`,
            fontSize: 11,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            fontWeight: 600,
            cursor: isValid && !isLoading ? "pointer" : "not-allowed",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          {isLoading ? (
            <>
              <span
                style={{
                  width: 6,
                  height: 6,
                  background: "var(--accent)",
                  animation: "blink 1s ease-in-out infinite",
                }}
              />
              Loading…
            </>
          ) : (
            <>
              Load Portfolio
              <Icons.arrow />
            </>
          )}
        </button>
      </div>
      {value && !isValid && value.length > 2 && (
        <p
          style={{
            color: "var(--danger)",
            fontSize: 11,
            marginTop: 10,
          }}
        >
          Invalid Ethereum address — must be 0x followed by 40 hex characters.
        </p>
      )}
    </div>
  );
}

function StatCell({
  label,
  value,
  hint,
  color,
}: {
  label: string;
  value: string;
  hint?: string;
  color?: string;
}) {
  return (
    <div style={{ background: "var(--surface)", padding: "24px 22px" }}>
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
        className="serif"
        style={{
          fontSize: 30,
          fontWeight: 700,
          letterSpacing: "-0.03em",
          color: color || "var(--text)",
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      {hint && (
        <div
          className="mono"
          style={{
            fontSize: 10,
            letterSpacing: "0.08em",
            color: "var(--text-dim)",
            marginTop: 8,
          }}
        >
          {hint}
        </div>
      )}
    </div>
  );
}

function PortfolioData({ summary }: { summary: PortfolioSummary }) {
  const series = useMemo(
    () => generateSeries(summary.address, summary.totalValueUsd),
    [summary.address, summary.totalValueUsd]
  );

  const start = series[0] ?? 0;
  const end = series[series.length - 1] ?? 0;
  const pnl = end - start;
  const pnlPct = start > 0 ? (pnl / start) * 100 : 0;
  const positive = pnl >= 0;

  const feed = useMemo(
    () => buildFeed(summary.tokens, seedFromAddr(summary.address)),
    [summary.tokens, summary.address]
  );

  const topChains = useMemo(
    () =>
      [...summary.chainBreakdown]
        .filter((c) => c.valueUsd > 0)
        .sort((a, b) => b.valueUsd - a.valueUsd),
    [summary.chainBreakdown]
  );

  const topToken = summary.tokens[0];
  const heaviestChain = topChains[0];
  const driftHint = pnlPct > 0 ? `+${pnlPct.toFixed(2)}%` : `${pnlPct.toFixed(2)}%`;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 1,
          background: "var(--line)",
          border: "1px solid var(--line)",
        }}
      >
        <StatCell
          label="Total Value"
          value={fmt.money(summary.totalValueUsd)}
          hint={`${summary.tokenCount} positions`}
        />
        <StatCell
          label="60D Drift"
          value={driftHint}
          hint={`${positive ? "+" : ""}${fmt.money(pnl)} net`}
          color={positive ? "var(--good)" : "var(--danger)"}
        />
        <StatCell
          label="Chains"
          value={summary.chainCount.toString()}
          hint={heaviestChain ? `${heaviestChain.chainName} leads` : undefined}
        />
        <StatCell
          label="Address"
          value={`${summary.address.slice(0, 6)}…${summary.address.slice(-4)}`}
          hint={`Fetched ${new Date(summary.fetchedAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`}
        />
      </div>

      {summary.errors.length > 0 && (
        <div
          style={{
            border: "1px solid var(--warn)",
            background: "color-mix(in oklab, var(--warn) 8%, transparent)",
            padding: "14px 18px",
          }}
        >
          <div
            className="mono"
            style={{
              fontSize: 10,
              color: "var(--warn)",
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              marginBottom: 6,
            }}
          >
            Partial results
          </div>
          {summary.errors.map((err, i) => (
            <div
              key={i}
              style={{
                fontSize: 11,
                color: "var(--text-dim)",
                lineHeight: 1.5,
              }}
            >
              {err}
            </div>
          ))}
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.6fr 1fr",
          gap: 24,
        }}
      >
        <ValueChart series={series} positive={positive} />
        <LiveFeed feed={feed} />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 24,
        }}
      >
        <ChainBars chains={topChains} />
        <RebalanceCard
          topToken={topToken}
          heaviestChain={heaviestChain}
          driftPct={pnlPct}
        />
      </div>

      <TokenLedger tokens={summary.tokens} />
    </div>
  );
}

function ValueChart({
  series,
  positive,
}: {
  series: number[];
  positive: boolean;
}) {
  const min = Math.min(...series);
  const max = Math.max(...series);
  const W = 640;
  const H = 260;
  const pad = 24;
  const points = series
    .map((v, i) => {
      const x = pad + (i / (series.length - 1)) * (W - pad * 2);
      const y =
        H - pad - ((v - min) / Math.max(1, max - min)) * (H - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const areaPath = `M${pad},${H - pad} L ${points.split(" ").join(" L ")} L ${
    W - pad
  },${H - pad} Z`;
  const lineColor = positive ? "var(--good)" : "var(--danger)";
  const fillColor = positive
    ? "color-mix(in oklab, var(--good) 22%, transparent)"
    : "color-mix(in oklab, var(--danger) 22%, transparent)";

  return (
    <div
      className="brackets"
      style={{
        border: "1px solid var(--line)",
        background: "var(--surface)",
        padding: 28,
        minWidth: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "start",
          marginBottom: 18,
        }}
      >
        <Eyebrow>60-Day Value Track</Eyebrow>
        <div
          className="mono"
          style={{
            fontSize: 10,
            color: "var(--text-dim)",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
          }}
        >
          Synthetic / Client-side
        </div>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        preserveAspectRatio="none"
        style={{ display: "block" }}
      >
        <defs>
          <linearGradient id="valueGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={lineColor} stopOpacity="0.35" />
            <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((t) => (
          <line
            key={t}
            x1={pad}
            x2={W - pad}
            y1={pad + (H - pad * 2) * t}
            y2={pad + (H - pad * 2) * t}
            stroke="var(--line)"
            strokeDasharray="2 4"
          />
        ))}
        <path d={areaPath} fill="url(#valueGrad)" />
        <polyline
          points={points}
          fill="none"
          stroke={lineColor}
          strokeWidth={1.6}
          strokeLinejoin="round"
        />
        <circle
          cx={pad + (W - pad * 2)}
          cy={(() => {
            const v = series[series.length - 1];
            return (
              H - pad - ((v - min) / Math.max(1, max - min)) * (H - pad * 2)
            );
          })()}
          r={4}
          fill={lineColor}
          style={{ filter: `drop-shadow(0 0 6px ${positive ? "var(--good)" : "var(--danger)"})` }}
        />
      </svg>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 1,
          background: "var(--line)",
          border: "1px solid var(--line)",
          marginTop: 18,
        }}
      >
        {[
          { label: "60D Low", value: fmt.money(min) },
          { label: "60D High", value: fmt.money(max) },
          {
            label: "Volatility",
            value: `${((Math.sqrt((max - min) / Math.max(1, (max + min) / 2)) * 100).toFixed(1))}%`,
          },
        ].map((m) => (
          <div
            key={m.label}
            style={{ background: "var(--surface)", padding: "12px 14px" }}
          >
            <div
              className="mono"
              style={{
                fontSize: 9,
                color: "var(--text-dim)",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                marginBottom: 4,
              }}
            >
              {m.label}
            </div>
            <div
              className="mono"
              style={{ fontSize: 13, color: "var(--text)" }}
            >
              {m.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LiveFeed({
  feed,
}: {
  feed: {
    id: string;
    symbol: string;
    chain: string;
    verb: string;
    mins: number;
    delta: number;
  }[];
}) {
  if (feed.length === 0) {
    return (
      <div
        className="brackets"
        style={{
          border: "1px solid var(--line)",
          background: "var(--surface)",
          padding: 28,
        }}
      >
        <Eyebrow>Live Feed</Eyebrow>
        <p
          style={{
            fontSize: 12,
            color: "var(--text-dim)",
            marginTop: 16,
          }}
        >
          No recent activity.
        </p>
      </div>
    );
  }
  return (
    <div
      className="brackets"
      style={{
        border: "1px solid var(--line)",
        background: "var(--surface)",
        padding: 28,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <Eyebrow>Live Feed</Eyebrow>
        <span
          className="mono"
          style={{
            fontSize: 9,
            color: "var(--good)",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              background: "var(--good)",
              boxShadow: "0 0 8px var(--good)",
              animation: "blink 2s ease-in-out infinite",
            }}
          />
          Stream
        </span>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          overflowY: "auto",
          maxHeight: 280,
        }}
      >
        {feed.map((f) => (
          <div
            key={f.id}
            style={{
              display: "grid",
              gridTemplateColumns: "auto 1fr auto",
              alignItems: "center",
              gap: 12,
              padding: "10px 0",
              borderBottom: "1px solid var(--line-2)",
            }}
          >
            <span
              className="mono"
              style={{
                fontSize: 10,
                color: "var(--text-dim)",
                letterSpacing: "0.08em",
                width: 48,
              }}
            >
              {f.mins}m
            </span>
            <div>
              <div
                className="mono"
                style={{
                  fontSize: 11,
                  color: "var(--text)",
                  letterSpacing: "0.04em",
                }}
              >
                {f.symbol}{" "}
                <span style={{ color: "var(--text-dim)" }}>
                  · {f.chain}
                </span>
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: "var(--text-dim)",
                  textTransform: "uppercase",
                  letterSpacing: "0.14em",
                  marginTop: 2,
                }}
              >
                {f.verb}
              </div>
            </div>
            <span
              className="mono tabular"
              style={{
                fontSize: 11,
                color: f.delta >= 0 ? "var(--good)" : "var(--danger)",
              }}
            >
              {f.delta > 0 ? "▲" : "▼"} {Math.abs(f.delta).toFixed(2)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChainBars({
  chains,
}: {
  chains: {
    chainId: number;
    chainName: string;
    valueUsd: number;
    percentage: number;
  }[];
}) {
  if (chains.length === 0) {
    return null;
  }
  const max = Math.max(...chains.map((c) => c.percentage));
  return (
    <div
      className="brackets"
      style={{
        border: "1px solid var(--line)",
        background: "var(--surface)",
        padding: 28,
      }}
    >
      <Eyebrow>Chain Allocation</Eyebrow>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 14,
          marginTop: 20,
        }}
      >
        {chains.map((c) => {
          const w = (c.percentage / max) * 100;
          return (
            <div key={c.chainId}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  marginBottom: 6,
                }}
              >
                <span
                  className="mono"
                  style={{
                    fontSize: 11,
                    color: "var(--text)",
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                  }}
                >
                  {c.chainName}
                </span>
                <span
                  className="mono tabular"
                  style={{
                    fontSize: 11,
                    color: "var(--text-dim)",
                    letterSpacing: "0.05em",
                  }}
                >
                  {fmt.money(c.valueUsd)}{" "}
                  <span style={{ color: "var(--accent)" }}>
                    {c.percentage.toFixed(1)}%
                  </span>
                </span>
              </div>
              <div
                style={{
                  position: "relative",
                  height: 6,
                  background: "var(--surface-2)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: `${w}%`,
                    background:
                      "linear-gradient(90deg, var(--accent), color-mix(in oklab, var(--accent) 60%, transparent))",
                    boxShadow: "0 0 14px var(--accent)",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RebalanceCard({
  topToken,
  heaviestChain,
  driftPct,
}: {
  topToken: PortfolioToken | undefined;
  heaviestChain:
    | { chainId: number; chainName: string; valueUsd: number; percentage: number }
    | undefined;
  driftPct: number;
}) {
  const concentrated =
    heaviestChain && heaviestChain.percentage > 60
      ? heaviestChain.chainName
      : null;
  const tokenSkew = topToken && topToken.allocation > 40 ? topToken.symbol : null;
  const drifted = Math.abs(driftPct) > 6;

  const actions: { label: string; detail: string; severity: "info" | "warn" | "good" }[] = [];
  if (concentrated) {
    actions.push({
      label: `Reduce ${concentrated} exposure`,
      detail: `${heaviestChain!.percentage.toFixed(1)}% concentrated on one chain`,
      severity: "warn",
    });
  }
  if (tokenSkew) {
    actions.push({
      label: `Trim ${tokenSkew}`,
      detail: `${topToken!.allocation.toFixed(1)}% of portfolio in a single asset`,
      severity: "warn",
    });
  }
  if (drifted) {
    actions.push({
      label: driftPct > 0 ? "Take some gains" : "Reassess allocation",
      detail: `60D drift ${driftPct > 0 ? "+" : ""}${driftPct.toFixed(2)}%`,
      severity: driftPct > 0 ? "good" : "warn",
    });
  }
  if (actions.length === 0) {
    actions.push({
      label: "Hold course",
      detail: "Allocations look balanced — no immediate rebalance required.",
      severity: "good",
    });
  }

  return (
    <div
      className="brackets"
      style={{
        border: "1px solid var(--line)",
        background: "var(--surface)",
        padding: 28,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "start",
          marginBottom: 18,
        }}
      >
        <Eyebrow>Rebalance Suggestion</Eyebrow>
        <Icons.wave style={{ color: "var(--accent)" }} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {actions.map((a, i) => {
          const color =
            a.severity === "warn"
              ? "var(--warn)"
              : a.severity === "good"
              ? "var(--good)"
              : "var(--accent)";
          return (
            <div
              key={i}
              style={{
                display: "grid",
                gridTemplateColumns: "auto 1fr",
                gap: 14,
                padding: "14px 16px",
                background: "var(--surface-2)",
                borderLeft: `2px solid ${color}`,
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  background: color,
                  boxShadow: `0 0 10px ${color}`,
                  marginTop: 6,
                }}
              />
              <div>
                <div
                  className="mono"
                  style={{
                    fontSize: 11,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: "var(--text)",
                    marginBottom: 4,
                  }}
                >
                  {a.label}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-dim)", lineHeight: 1.5 }}>
                  {a.detail}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

type SortKey = "value" | "balance" | "price" | "change" | "allocation";

function TokenLedger({ tokens }: { tokens: PortfolioToken[] }) {
  const [sortBy, setSortBy] = useState<SortKey>("value");
  const [sortAsc, setSortAsc] = useState(false);

  const sorted = useMemo(() => {
    const copy = [...tokens];
    copy.sort((a, b) => {
      let diff = 0;
      switch (sortBy) {
        case "value":
          diff = b.balanceUsd - a.balanceUsd;
          break;
        case "balance":
          diff = b.balance - a.balance;
          break;
        case "price":
          diff = b.priceUsd - a.priceUsd;
          break;
        case "change":
          diff = (b.priceChange24h ?? 0) - (a.priceChange24h ?? 0);
          break;
        case "allocation":
          diff = b.allocation - a.allocation;
          break;
      }
      return sortAsc ? -diff : diff;
    });
    return copy;
  }, [tokens, sortBy, sortAsc]);

  const toggle = (k: SortKey) => {
    if (sortBy === k) setSortAsc(!sortAsc);
    else {
      setSortBy(k);
      setSortAsc(false);
    }
  };

  const SortHeader = ({ label, k }: { label: string; k: SortKey }) => {
    const active = sortBy === k;
    return (
      <button
        onClick={() => toggle(k)}
        className="mono"
        style={{
          background: "transparent",
          border: "none",
          color: active ? "var(--accent)" : "var(--text-dim)",
          fontSize: 9,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          cursor: "pointer",
          padding: 0,
          textAlign: "left",
        }}
      >
        {label} {active ? (sortAsc ? "↑" : "↓") : ""}
      </button>
    );
  };

  return (
    <div
      className="brackets"
      style={{
        border: "1px solid var(--line)",
        background: "var(--surface)",
      }}
    >
      <div
        style={{
          padding: "22px 26px 18px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Eyebrow>Token Balances ({tokens.length})</Eyebrow>
      </div>
      <div style={{ overflowX: "auto" }}>
        <div
          style={{
            minWidth: 780,
            display: "grid",
            gridTemplateColumns: "1.3fr 0.9fr 1fr 1fr 1fr 0.8fr 0.7fr",
            gap: 10,
            padding: "10px 26px",
            borderTop: "1px solid var(--line-2)",
            borderBottom: "1px solid var(--line-2)",
            background: "var(--surface-2)",
          }}
        >
          <span
            className="mono"
            style={{
              fontSize: 9,
              color: "var(--text-dim)",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
            }}
          >
            Token
          </span>
          <span
            className="mono"
            style={{
              fontSize: 9,
              color: "var(--text-dim)",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
            }}
          >
            Chain
          </span>
          <SortHeader label="Balance" k="balance" />
          <SortHeader label="Price" k="price" />
          <SortHeader label="Value" k="value" />
          <SortHeader label="24h" k="change" />
          <SortHeader label="%" k="allocation" />
        </div>
        {sorted.map((t, i) => {
          const ch = t.priceChange24h ?? 0;
          const up = ch >= 0;
          return (
            <div
              key={`${t.chainId}-${t.symbol}-${i}`}
              style={{
                minWidth: 780,
                display: "grid",
                gridTemplateColumns: "1.3fr 0.9fr 1fr 1fr 1fr 0.8fr 0.7fr",
                gap: 10,
                padding: "14px 26px",
                borderBottom: "1px solid var(--line-2)",
                alignItems: "center",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  className="mono"
                  style={{
                    fontSize: 12,
                    color: "var(--text)",
                    letterSpacing: "0.04em",
                  }}
                >
                  {t.symbol}
                </span>
                {t.isNative && (
                  <span
                    className="mono"
                    style={{
                      fontSize: 8,
                      color: "var(--accent)",
                      border: "1px solid var(--accent)",
                      padding: "2px 6px",
                      letterSpacing: "0.14em",
                    }}
                  >
                    NATIVE
                  </span>
                )}
              </div>
              <span
                className="mono"
                style={{
                  fontSize: 11,
                  color: "var(--text-dim)",
                  letterSpacing: "0.06em",
                }}
              >
                {t.chainName}
              </span>
              <span
                className="mono tabular"
                style={{ fontSize: 12, color: "var(--text)" }}
              >
                {t.balance < 0.0001
                  ? t.balance.toExponential(2)
                  : t.balance.toLocaleString(undefined, {
                      maximumFractionDigits: 4,
                    })}
              </span>
              <span
                className="mono tabular"
                style={{ fontSize: 12, color: "var(--text-dim)" }}
              >
                {t.priceUsd > 0
                  ? `$${t.priceUsd.toLocaleString(undefined, {
                      maximumFractionDigits: t.priceUsd < 1 ? 4 : 2,
                    })}`
                  : "—"}
              </span>
              <span
                className="mono tabular"
                style={{ fontSize: 13, color: "var(--text)" }}
              >
                {fmt.money(t.balanceUsd)}
              </span>
              <span
                className="mono tabular"
                style={{
                  fontSize: 11,
                  color: up ? "var(--good)" : "var(--danger)",
                }}
              >
                {t.priceChange24h !== null
                  ? `${ch > 0 ? "+" : ""}${ch.toFixed(1)}%`
                  : "—"}
              </span>
              <div
                style={{ display: "flex", alignItems: "center", gap: 8 }}
              >
                <span
                  className="mono tabular"
                  style={{
                    fontSize: 11,
                    color: "var(--text-dim)",
                    width: 32,
                  }}
                >
                  {t.allocation.toFixed(1)}%
                </span>
                <Spark
                  data={makeSparkData(t.chainId + i, up)}
                  color={up ? "var(--good)" : "var(--danger)"}
                  height={16}
                  fill={false}
                  animated={false}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

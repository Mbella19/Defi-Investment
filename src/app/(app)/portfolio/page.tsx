"use client";

import { useMemo } from "react";
import { ConnectButton as RainbowConnectButton } from "@rainbow-me/rainbowkit";
import {
  Icons,
  TokenGlyph,
  Stat,
  ThemeToggle,
} from "@/components/sovereign";
import { usePortfolio } from "@/hooks/usePortfolio";
import type { PortfolioToken } from "@/types/wallet";

const CHAIN_COLOR: Record<number, string> = {
  1: "var(--c-eth)",
  42161: "var(--c-arb)",
  10: "var(--c-op)",
  8453: "var(--c-base)",
  137: "var(--c-poly)",
  56: "var(--c-sol)",
  43114: "var(--c-op)",
};

const CHAIN_SHORT: Record<number, string> = {
  1: "ETH",
  42161: "ARB",
  10: "OP",
  8453: "BASE",
  137: "POLY",
  56: "BSC",
  43114: "AVAX",
};

function fmtUsd(n: number, decimals = 2) {
  if (!Number.isFinite(n)) return "$0";
  if (Math.abs(n) >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

function fmtBalance(n: number) {
  if (n === 0) return "0";
  if (n < 0.0001) return n.toExponential(2);
  if (n < 1) return n.toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
  if (n < 1000) return n.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export default function PortfolioPage() {
  const { isConnected, address, portfolio, isLoading, error, refetch } =
    usePortfolio();

  const totalDelta24h = useMemo(() => {
    if (!portfolio) return null;
    let weighted = 0;
    let total = 0;
    for (const t of portfolio.tokens) {
      if (t.priceChange24h == null) continue;
      weighted += (t.priceChange24h / 100) * t.balanceUsd;
      total += t.balanceUsd;
    }
    if (total === 0) return null;
    return { abs: weighted, pct: (weighted / total) * 100 };
  }, [portfolio]);

  // ------- DISCONNECTED STATE -------
  if (!isConnected) {
    return (
      <>
        <div className="page-wrap">
          <div>
            <div className="eyebrow">PORTFOLIO</div>
            <h1
              className="display"
              style={{ fontSize: 28, margin: "6px 0 2px", letterSpacing: "-0.02em" }}
            >
              Your real on-chain holdings.
            </h1>
            <div style={{ fontSize: 13, color: "var(--text-dim)" }}>
              Connect a wallet to pull live balances across 7 EVM chains.
            </div>
          </div>

          <div
            className="card-raised"
            style={{
              padding: 36,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 16,
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 16,
                background: "var(--accent-soft)",
                color: "var(--accent)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icons.wallet size={26} />
            </div>
            <div style={{ maxWidth: 460 }}>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
                No wallet connected
              </div>
              <div style={{ fontSize: 13, color: "var(--text-dim)", lineHeight: 1.5 }}>
                We never custody funds, never ask for approvals, and never index
                fake balances. Connect to see real values from on-chain RPCs and
                CoinGecko prices.
              </div>
            </div>
            <RainbowConnectButton />
            <div className="mono" style={{ fontSize: 10.5, color: "var(--text-muted)", letterSpacing: "0.14em" }}>
              ETH · ARB · OP · BASE · POLY · BSC · AVAX
            </div>
          </div>
        </div>

        <div className="mobile-only">
          <div className="m-header">
            <div>
              <div className="m-title">Portfolio</div>
              <div className="m-sub">CONNECT TO BEGIN</div>
            </div>
            <ThemeToggle variant="mobile" />
          </div>
          <div className="m-content">
            <div
              className="card-raised"
              style={{
                padding: 28,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 14,
                textAlign: "center",
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 14,
                  background: "var(--accent-soft)",
                  color: "var(--accent)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icons.wallet size={22} />
              </div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>No wallet connected</div>
              <div style={{ fontSize: 12.5, color: "var(--text-dim)", lineHeight: 1.5 }}>
                Connect to pull live balances across 7 EVM chains.
              </div>
              <RainbowConnectButton />
            </div>
          </div>
        </div>
      </>
    );
  }

  // ------- CONNECTED STATE -------
  const tokens = portfolio?.tokens ?? [];
  const chains = portfolio?.chainBreakdown ?? [];
  const total = portfolio?.totalValueUsd ?? 0;

  return (
    <>
      {/* ---------- DESKTOP ---------- */}
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
            <div className="eyebrow">PORTFOLIO</div>
            <h1
              className="display"
              style={{ fontSize: 28, margin: "6px 0 2px", letterSpacing: "-0.02em" }}
            >
              {address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "Portfolio"}
            </h1>
            <div style={{ fontSize: 13, color: "var(--text-dim)" }}>
              {portfolio
                ? `${portfolio.tokenCount} tokens · ${portfolio.chainCount} chains · updated ${new Date(portfolio.fetchedAt).toLocaleTimeString()}`
                : isLoading
                  ? "Reading on-chain balances…"
                  : "Live balances via on-chain RPC"}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              className="btn btn-sm"
              onClick={refetch}
              disabled={isLoading}
            >
              <Icons.refresh size={13} /> {isLoading ? "Loading…" : "Refresh"}
            </button>
          </div>
        </div>

        {error ? (
          <div
            className="card"
            style={{
              padding: 14,
              borderColor: "color-mix(in oklch, var(--danger) 40%, var(--line))",
              color: "var(--danger)",
              fontSize: 13,
            }}
          >
            {error}
          </div>
        ) : null}

        <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr 1fr 1fr", gap: 16 }}>
          <div
            className="card-raised"
            style={{
              padding: 20,
              display: "flex",
              flexDirection: "column",
              gap: 10,
              minHeight: 132,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div className="eyebrow">NET VALUE</div>
              {tokens.length > 0 ? (
                <span className="chip mono">
                  <span className="dot good" /> LIVE
                </span>
              ) : null}
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
              <span
                className="num display"
                style={{ fontSize: 38, fontWeight: 500, letterSpacing: "-0.025em" }}
              >
                {fmtUsd(total)}
              </span>
              {totalDelta24h ? (
                <span className={totalDelta24h.abs >= 0 ? "delta-up" : "delta-dn"}>
                  {totalDelta24h.abs >= 0 ? "▲" : "▼"} {fmtUsd(Math.abs(totalDelta24h.abs))} ·{" "}
                  {Math.abs(totalDelta24h.pct).toFixed(2)}%
                </span>
              ) : null}
            </div>
          </div>
          <div className="card" style={{ padding: 18 }}>
            <Stat
              label="TOKENS"
              value={String(portfolio?.tokenCount ?? 0)}
              sub="non-zero balances"
            />
          </div>
          <div className="card" style={{ padding: 18 }}>
            <Stat
              label="CHAINS"
              value={String(portfolio?.chainCount ?? 0)}
              sub="with positions"
            />
          </div>
          <div className="card" style={{ padding: 18 }}>
            <Stat
              label="LARGEST POSITION"
              value={tokens[0]?.symbol ?? "—"}
              sub={
                tokens[0]
                  ? `${tokens[0].allocation.toFixed(1)}% of book`
                  : "no holdings"
              }
            />
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
                <div style={{ fontSize: 14, fontWeight: 600 }}>Holdings</div>
                <div style={{ fontSize: 11.5, color: "var(--text-dim)" }}>
                  {tokens.length} non-zero · sorted by value
                </div>
              </div>
            </div>

            {tokens.length === 0 ? (
              <EmptyHoldings loading={isLoading} />
            ) : (
              <>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1.6fr 0.8fr 1fr 1fr 0.9fr",
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
                  <span>Token</span>
                  <span>Chain</span>
                  <span>Balance</span>
                  <span>Value</span>
                  <span style={{ textAlign: "right" }}>24h</span>
                </div>
                {tokens.map((t) => (
                  <HoldingRow key={`${t.chainId}-${t.symbol}`} t={t} />
                ))}
              </>
            )}
          </div>

          <div className="card" style={{ padding: 18 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
              Allocation
            </div>
            <div style={{ fontSize: 11.5, color: "var(--text-dim)", marginBottom: 16 }}>
              By chain
            </div>
            {chains.length === 0 ? (
              <div style={{ fontSize: 12.5, color: "var(--text-dim)" }}>
                No balances yet.
              </div>
            ) : (
              <>
                <ChainDonut chains={chains} />
                <div
                  style={{
                    marginTop: 16,
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  {chains.map((c) => (
                    <div
                      key={c.chainId}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        fontSize: 12.5,
                      }}
                    >
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 2,
                          background: CHAIN_COLOR[c.chainId] ?? "var(--text-2)",
                        }}
                      />
                      <span style={{ color: "var(--text-1)" }}>{c.chainName}</span>
                      <span
                        className="num"
                        style={{
                          marginLeft: "auto",
                          color: "var(--text-1)",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {c.percentage.toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {portfolio && portfolio.errors.length > 0 ? (
          <div
            className="card"
            style={{
              padding: 14,
              fontSize: 12,
              color: "var(--text-dim)",
              borderColor: "var(--line)",
            }}
          >
            <div className="eyebrow" style={{ marginBottom: 8 }}>
              PARTIAL DATA
            </div>
            {portfolio.errors.map((e, i) => (
              <div key={i}>· {e}</div>
            ))}
          </div>
        ) : null}
      </div>

      {/* ---------- MOBILE ---------- */}
      <div className="mobile-only">
        <div className="m-header">
          <div>
            <div className="m-title">Portfolio</div>
            <div className="m-sub">
              {address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "—"}
            </div>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            <ThemeToggle variant="mobile" />
            <button
              type="button"
              className="m-icon-btn"
              aria-label="Refresh"
              onClick={refetch}
              disabled={isLoading}
            >
              <Icons.refresh size={18} />
            </button>
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
              {fmtUsd(total)}
            </div>
            {totalDelta24h ? (
              <div
                style={{
                  fontSize: 12,
                  color:
                    totalDelta24h.abs >= 0 ? "var(--good)" : "var(--danger)",
                  marginTop: 2,
                }}
              >
                {totalDelta24h.abs >= 0 ? "▲" : "▼"} {fmtUsd(Math.abs(totalDelta24h.abs))} ·{" "}
                {Math.abs(totalDelta24h.pct).toFixed(2)}% · 24h
              </div>
            ) : (
              <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 2 }}>
                {isLoading ? "fetching…" : "no 24h delta"}
              </div>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div className="card" style={{ padding: 12 }}>
              <Stat
                size="sm"
                label="TOKENS"
                value={String(portfolio?.tokenCount ?? 0)}
              />
            </div>
            <div className="card" style={{ padding: 12 }}>
              <Stat
                size="sm"
                label="CHAINS"
                value={String(portfolio?.chainCount ?? 0)}
              />
            </div>
          </div>

          <div>
            <div style={{ fontSize: 13, fontWeight: 600, padding: "4px 2px 10px" }}>
              Holdings
            </div>
            {tokens.length === 0 ? (
              <div
                className="card"
                style={{ padding: 16, textAlign: "center", color: "var(--text-dim)", fontSize: 12.5 }}
              >
                {isLoading ? "Reading balances…" : "No non-zero balances yet."}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {tokens.map((t) => (
                  <div
                    key={`m-${t.chainId}-${t.symbol}`}
                    className="card"
                    style={{ padding: 12 }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <TokenGlyph sym={t.symbol} size={30} />
                      <div style={{ flex: 1, minWidth: 0, lineHeight: 1.25 }}>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{t.symbol}</div>
                        <div
                          style={{
                            fontSize: 11.5,
                            color: "var(--text-dim)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {t.chainName} · {fmtBalance(t.balance)}
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div className="num" style={{ fontSize: 13, fontWeight: 500 }}>
                          {fmtUsd(t.balanceUsd)}
                        </div>
                        {t.priceChange24h != null ? (
                          <div
                            className="num"
                            style={{
                              fontSize: 11,
                              color:
                                t.priceChange24h >= 0 ? "var(--good)" : "var(--danger)",
                            }}
                          >
                            {t.priceChange24h >= 0 ? "+" : ""}
                            {t.priceChange24h.toFixed(2)}%
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function HoldingRow({ t }: { t: PortfolioToken }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1.6fr 0.8fr 1fr 1fr 0.9fr",
        padding: "14px 18px",
        alignItems: "center",
        borderBottom: "1px solid var(--line)",
        fontSize: 13,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <TokenGlyph sym={t.symbol} size={28} />
        <div style={{ lineHeight: 1.25, minWidth: 0 }}>
          <div style={{ fontWeight: 500 }}>{t.symbol}</div>
          <div
            style={{
              fontSize: 11.5,
              color: "var(--text-dim)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {t.name}
          </div>
        </div>
      </div>
      <span
        className="mono"
        style={{
          padding: "2px 8px",
          fontSize: 10.5,
          borderRadius: 6,
          background: `color-mix(in oklch, ${
            CHAIN_COLOR[t.chainId] ?? "var(--text-2)"
          } 14%, transparent)`,
          color: CHAIN_COLOR[t.chainId] ?? "var(--text-2)",
          border: `1px solid color-mix(in oklch, ${
            CHAIN_COLOR[t.chainId] ?? "var(--text-2)"
          } 32%, transparent)`,
          justifySelf: "start",
          fontWeight: 500,
        }}
      >
        {CHAIN_SHORT[t.chainId] ?? t.chainName}
      </span>
      <span className="num" style={{ color: "var(--text-1)" }}>
        {fmtBalance(t.balance)}
      </span>
      <span className="num" style={{ fontWeight: 500 }}>
        {fmtUsd(t.balanceUsd)}
      </span>
      <span
        className="num"
        style={{
          textAlign: "right",
          color:
            t.priceChange24h == null
              ? "var(--text-dim)"
              : t.priceChange24h >= 0
                ? "var(--good)"
                : "var(--danger)",
        }}
      >
        {t.priceChange24h == null
          ? "—"
          : `${t.priceChange24h >= 0 ? "+" : ""}${t.priceChange24h.toFixed(2)}%`}
      </span>
    </div>
  );
}

function ChainDonut({
  chains,
}: {
  chains: { chainId: number; percentage: number }[];
}) {
  let offset = 0;
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
      <svg viewBox="0 0 42 42" width={140} height={140}>
        <circle
          cx="21"
          cy="21"
          r="15.9"
          fill="none"
          stroke="var(--surface-3)"
          strokeWidth="5"
        />
        {chains.map((c) => {
          const dash = c.percentage;
          const dashoffset = -offset;
          offset += dash;
          return (
            <circle
              key={c.chainId}
              cx="21"
              cy="21"
              r="15.9"
              fill="none"
              stroke={CHAIN_COLOR[c.chainId] ?? "var(--text-2)"}
              strokeWidth="5"
              strokeDasharray={`${dash} ${100 - dash}`}
              strokeDashoffset={dashoffset}
              transform="rotate(-90 21 21)"
            />
          );
        })}
        <text
          x="21"
          y="22"
          textAnchor="middle"
          fontFamily="Geist Mono"
          fontSize="6"
          fill="var(--text)"
          fontWeight="600"
        >
          {chains.length} chain{chains.length === 1 ? "" : "s"}
        </text>
      </svg>
    </div>
  );
}

function EmptyHoldings({ loading }: { loading: boolean }) {
  return (
    <div
      style={{
        padding: 36,
        textAlign: "center",
        color: "var(--text-dim)",
        fontSize: 13,
      }}
    >
      {loading
        ? "Reading balances across all 7 chains…"
        : "No non-zero balances detected for this address."}
    </div>
  );
}

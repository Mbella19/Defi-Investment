"use client";

import { useMemo } from "react";
import { ConnectButton as RainbowConnectButton } from "@rainbow-me/rainbowkit";
import { Eye, LockKeyhole, RefreshCw, WalletCards } from "lucide-react";
import {
  ChainBadge,
  CommandStrip,
  EmptyState,
  MetricTile,
  MiniLine,
} from "@/components/site/ui";
import { PoolIcon } from "@/components/site/PoolIcon";
import {
  chainIdFromEvmId,
  chainMeta,
  formatBalance,
  formatMoney,
  formatPct,
  formatUsd,
} from "@/lib/design-utils";
import { usePortfolio } from "@/hooks/usePortfolio";
import { usePlan } from "@/hooks/usePlan";
import { Paywall } from "@/components/site/Paywall";

export default function PortfolioPage() {
  const { isConnected, address, portfolio, isLoading, error, refetch } = usePortfolio();
  const plan = usePlan();

  const total = portfolio?.totalValueUsd ?? 0;
  const tokens = portfolio?.tokens ?? [];
  const chains = portfolio?.chainBreakdown ?? [];

  const weightedChange = useMemo(() => {
    if (!portfolio) return null;
    let weighted = 0;
    let denom = 0;
    for (const t of portfolio.tokens) {
      if (t.priceChange24h == null) continue;
      weighted += (t.priceChange24h / 100) * t.balanceUsd;
      denom += t.balanceUsd;
    }
    if (denom === 0) return null;
    return (weighted / denom) * 100;
  }, [portfolio]);

  const sparkPoints = useMemo(() => {
    if (!total) return [0, 0, 0, 0, 0, 0];
    // Synthetic 6-point trend so the right-rail mini chart has a shape even
    // before we wire historic balance snapshots. Anchored on the live total.
    const drift = weightedChange != null ? weightedChange / 100 : 0;
    return [
      total * (1 - drift * 0.9),
      total * (1 - drift * 0.6),
      total * (1 - drift * 0.4),
      total * (1 - drift * 0.2),
      total * (1 - drift * 0.05),
      total,
    ];
  }, [total, weightedChange]);

  const shortAddress = address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "Portfolio";

  return (
    <div className="page">
      <div className="page-title">
        <div>
          <p className="eyebrow">Portfolio</p>
          <h1>Read-only exposure command.</h1>
          <p>
            Wallet positions become allocation context: chain mix, token shelves, drift,
            and yield sleeves in one view — never custodial.
          </p>
        </div>
      </div>

      <CommandStrip
        file="file/04.portfolio"
        items={[
          {
            label: "mode",
            value: isConnected ? "wallet linked" : "preview",
            tone: isConnected ? "ok" : "warn",
          },
          { label: "permission", value: "read-only", tone: "info" },
          { label: "custody", value: "never requested", tone: "ok" },
        ]}
      />

      {!plan.isLoading && !plan.capabilities.toolPortfolioLens ? (
        <Paywall
          title="Portfolio lens is a paid feature"
          body="Portfolio lens reads live on-chain balances across 7 supported networks and ties them back to your strategies. It unlocks on the Pro plan."
          requiredTier="pro"
          currentTier={plan.tier}
          feature="Portfolio"
        />
      ) : !isConnected ? (
        <EmptyState
          icon={LockKeyhole}
          title="Private by default"
          body="Connect a wallet to read live balances. Sovereign reads on-chain state directly — it never custodies funds, requests approvals, or signs transactions."
          action={
            <div style={{ marginTop: 16 }}>
              <RainbowConnectButton />
            </div>
          }
        />
      ) : isLoading && !portfolio ? (
        <EmptyState
          icon={RefreshCw}
          title="Reading on-chain balances…"
          body="Pulling live token positions across the supported chains. Should take a few seconds."
        />
      ) : error ? (
        <EmptyState
          icon={LockKeyhole}
          title="Could not read balances"
          body={error}
          action={
            <button type="button" className="ghost-button" onClick={refetch} style={{ marginTop: 14 }}>
              <RefreshCw size={16} aria-hidden="true" /> Retry
            </button>
          }
        />
      ) : (
        <>
          <div className="metric-grid" style={{ marginBottom: 18 }}>
            <MetricTile label="Net value" value={formatMoney(total)} icon={WalletCards} tone="#6ee7b7" />
            <MetricTile
              label="24h drift"
              value={weightedChange == null ? "—" : formatPct(weightedChange, true)}
              icon={RefreshCw}
              tone="#60a5fa"
            />
            <MetricTile label="Positions" value={String(tokens.length)} icon={Eye} tone="#fbbf24" />
            <MetricTile label="Networks" value={String(chains.length)} icon={LockKeyhole} tone="#fb7185" />
          </div>

          <div className="page-tools" style={{ marginBottom: 18 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span className="eyebrow" style={{ marginBottom: 0 }}>{shortAddress}</span>
              <span style={{ fontSize: 13, color: "var(--muted)" }}>
                {portfolio
                  ? `${portfolio.tokenCount} tokens · ${portfolio.chainCount} chains · updated ${new Date(portfolio.fetchedAt).toLocaleTimeString()}`
                  : ""}
              </span>
            </div>
            <div className="filter-row">
              <button type="button" className="ghost-button" onClick={refetch}>
                <RefreshCw size={16} aria-hidden="true" /> Refresh
              </button>
            </div>
          </div>

          <div className="portfolio-layout">
            <div className="portfolio-stack">
              {tokens.length === 0 ? (
                <EmptyState
                  icon={WalletCards}
                  title="No tracked tokens here"
                  body="This wallet has no balances on the supported chains. Try a different address."
                />
              ) : (
                tokens.map((token) => {
                  const chain = chainIdFromEvmId(token.chainId);
                  return (
                    <div className="portfolio-row" key={`${token.chainId}-${token.symbol}-${token.name}`}>
                      <div className="token-cell">
                        <PoolIcon symbol={token.symbol} protocol={token.name} />
                        <div>
                          <strong>{token.symbol}</strong>
                          <span>{token.name}</span>
                        </div>
                      </div>
                      <ChainBadge chain={chain} />
                      <span className="desktop-cell">
                        {formatBalance(token.balance)} {token.symbol}
                      </span>
                      <strong>{formatMoney(token.balanceUsd)}</strong>
                      <span className={(token.priceChange24h ?? 0) >= 0 ? "delta-good" : "delta-bad"}>
                        {token.priceChange24h == null ? "—" : formatPct(token.priceChange24h, true)}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            <aside className="boost-panel">
              <p className="eyebrow">Chain Exposure</p>
              <h2 style={{ margin: "0 0 16px", fontSize: 32 }}>{formatMoney(total)}</h2>
              <div className="exposure-bars">
                {chains.length === 0 ? (
                  <span style={{ color: "var(--muted)", fontSize: 13 }}>
                    No exposure to break down yet.
                  </span>
                ) : (
                  chains.map((c) => {
                    const id = chainIdFromEvmId(c.chainId);
                    const meta = chainMeta[id];
                    return (
                      <div className="exposure-bar" key={c.chainId}>
                        <strong>{meta.label}</strong>
                        <span className="share-track" aria-label={`${c.percentage.toFixed(0)}%`}>
                          <i style={{ width: `${c.percentage}%`, background: meta.color }} />
                        </span>
                        <span>{c.percentage.toFixed(0)}%</span>
                      </div>
                    );
                  })
                )}
              </div>
              <div style={{ marginTop: 24 }}>
                <MiniLine points={sparkPoints} accent="#60a5fa" />
              </div>
              <div style={{ marginTop: 12 }} className="ticker">
                <span>{formatUsd(total)} total · read-only</span>
              </div>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}

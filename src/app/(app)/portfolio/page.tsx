"use client";

import { useMemo } from "react";
import { LockKeyhole, RefreshCw } from "lucide-react";
import {
  BookHeader,
  ChainBadge,
  Console,
  EmptyState,
  type TapeStat,
} from "@/components/site/ui";
import { PoolIcon } from "@/components/site/PoolIcon";
import {
  chainIdFromEvmId,
  chainMeta,
  formatBalance,
  formatMoney,
  formatPct,
} from "@/lib/design-utils";
import { usePortfolio } from "@/hooks/usePortfolio";
import { usePlan } from "@/hooks/usePlan";
import { Paywall } from "@/components/site/Paywall";
import { WalletButton } from "@/components/site/WalletButton";

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

  const shortAddress = address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "No wallet linked";
  const gated = !plan.isLoading && !plan.capabilities.toolPortfolioLens;

  const tape: TapeStat[] = portfolio
    ? [
        { label: "net value", value: formatMoney(total), tone: "ok" },
        {
          label: "24h drift",
          value: weightedChange == null ? "—" : formatPct(weightedChange, true),
          tone: weightedChange == null ? "plain" : weightedChange >= 0 ? "ok" : "danger",
        },
        { label: "positions", value: String(tokens.length), tone: "plain" },
        { label: "networks", value: String(chains.length), tone: "info" },
      ]
    : [];

  return (
    <div className="page">
      <div className="page-title">
        <div>
          <p className="eyebrow">Portfolio</p>
          <h1>Your DeFi positions, one console.</h1>
          <p>
            Live exposure across every supported chain, watched by the same security
            engine that vets your allocations. We never request approvals, never custody
            funds, never move a position — we just give you the picture and ping you
            when something changes.
          </p>
        </div>
      </div>

      {gated ? (
        <Paywall
          title="Portfolio lens is a paid feature"
          body="Portfolio lens reads live on-chain balances across 7 supported networks and ties them back to your strategies. It unlocks on the Pro plan."
          requiredTier="pro"
          currentTier={plan.tier}
          feature="Portfolio"
        />
      ) : (
        <>
          <Console
            file="file/04.portfolio"
            chips={[
              {
                label: "mode",
                value: isConnected ? "wallet linked" : "preview",
                tone: isConnected ? "ok" : "warn",
              },
              { label: "permission", value: "read-only", tone: "info" },
              { label: "custody", value: "never requested", tone: "ok" },
            ]}
            tape={tape}
          >
            {!isConnected ? (
              <EmptyState
                icon={LockKeyhole}
                title="Private by default"
                body="Connect a wallet to read live balances. Sovereign reads on-chain state directly — it never custodies funds, requests approvals, or signs transactions."
                action={
                  <div style={{ marginTop: 16 }}>
                    <WalletButton />
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
                <div className="desk-title">
                  <div>
                    <p className="eyebrow">Wallet lens</p>
                    <h2>{shortAddress}</h2>
                  </div>
                  <div className="filter-row">
                    <button type="button" className="ghost-button" onClick={refetch}>
                      <RefreshCw size={16} aria-hidden="true" /> Refresh
                    </button>
                  </div>
                </div>

                <p className="ticket-note" style={{ margin: 0 }}>
                  {portfolio
                    ? `${portfolio.tokenCount} tokens · ${portfolio.chainCount} chains · updated ${new Date(portfolio.fetchedAt).toLocaleTimeString()} · read-only`
                    : ""}
                </p>

                {chains.length > 0 ? (
                  <div style={{ display: "grid", gap: 10 }}>
                    <div className="exposure-strip" aria-label="Chain exposure breakdown">
                      {chains.map((c) => {
                        const id = chainIdFromEvmId(c.chainId);
                        const meta = chainMeta[id];
                        return (
                          <i
                            key={c.chainId}
                            style={{ width: `${c.percentage}%`, background: meta.color }}
                            title={`${meta.label} ${c.percentage.toFixed(0)}%`}
                          />
                        );
                      })}
                    </div>
                    <div className="exposure-legend">
                      {chains.map((c) => {
                        const id = chainIdFromEvmId(c.chainId);
                        const meta = chainMeta[id];
                        return (
                          <span key={c.chainId}>
                            <i style={{ background: meta.color }} />
                            {meta.label} <b>{c.percentage.toFixed(0)}%</b>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <p className="ticket-note" style={{ margin: 0 }}>
                    No exposure to break down yet.
                  </p>
                )}
              </>
            )}
          </Console>

          {isConnected && portfolio && !error ? (
            <>
              <BookHeader
                index="04.1"
                title="Positions"
                meta={`${tokens.length} tracked`}
              />
              {tokens.length === 0 ? (
                <p className="book-empty">
                  This wallet has no balances on the supported chains. Try a different
                  address.
                </p>
              ) : (
                <div className="portfolio-stack">
                  {tokens.map((token) => {
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
                  })}
                </div>
              )}
            </>
          ) : null}
        </>
      )}
    </div>
  );
}


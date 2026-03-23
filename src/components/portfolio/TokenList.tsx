"use client";

import { useState, useMemo } from "react";
import type { PortfolioToken } from "@/types/wallet";
import { formatCurrency } from "@/lib/formatters";

type SortKey = "value" | "balance" | "price" | "change" | "allocation";

interface TokenListProps {
  tokens: PortfolioToken[];
}

export default function TokenList({ tokens }: TokenListProps) {
  const [sortBy, setSortBy] = useState<SortKey>("value");
  const [sortAsc, setSortAsc] = useState(false);

  const sorted = useMemo(() => {
    const copy = [...tokens];
    copy.sort((a, b) => {
      let diff = 0;
      switch (sortBy) {
        case "value": diff = b.balanceUsd - a.balanceUsd; break;
        case "balance": diff = b.balance - a.balance; break;
        case "price": diff = b.priceUsd - a.priceUsd; break;
        case "change": diff = (b.priceChange24h ?? 0) - (a.priceChange24h ?? 0); break;
        case "allocation": diff = b.allocation - a.allocation; break;
      }
      return sortAsc ? -diff : diff;
    });
    return copy;
  }, [tokens, sortBy, sortAsc]);

  const toggleSort = (key: SortKey) => {
    if (sortBy === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortBy(key);
      setSortAsc(false);
    }
  };

  const SortHeader = ({ label, sortKey }: { label: string; sortKey: SortKey }) => (
    <button
      onClick={() => toggleSort(sortKey)}
      className={`text-[13px] font-semibold uppercase tracking-[0.2em] transition-colors ${
        sortBy === sortKey ? "text-accent" : "text-label/70 hover:text-on-surface"
      }`}
    >
      {label} {sortBy === sortKey ? (sortAsc ? "↑" : "↓") : ""}
    </button>
  );

  return (
    <div className="bg-surface-low border border-outline">
      <div className="flex items-center gap-3 p-4 sm:px-8 sm:pt-8 sm:pb-4">
        <div className="w-2 h-2 bg-accent" />
        <span className="text-[13px] font-semibold uppercase tracking-[0.2em] text-label/70">
          Token Balances ({tokens.length})
        </span>
      </div>

      <div className="overflow-x-auto">
        {/* Header */}
        <div className="grid grid-cols-[1fr_80px_100px_100px_100px_80px_60px] gap-2 px-4 sm:px-8 py-3 border-b border-outline min-w-[700px]">
          <span className="text-[13px] font-semibold uppercase tracking-[0.2em] text-label/70">Token</span>
          <span className="text-[13px] font-semibold uppercase tracking-[0.2em] text-label/70">Chain</span>
          <SortHeader label="Balance" sortKey="balance" />
          <SortHeader label="Price" sortKey="price" />
          <SortHeader label="Value" sortKey="value" />
          <SortHeader label="24h" sortKey="change" />
          <SortHeader label="%" sortKey="allocation" />
        </div>

        {/* Rows */}
        {sorted.map((token, i) => (
          <div
            key={`${token.chainId}-${token.symbol}-${i}`}
            className="grid grid-cols-[1fr_80px_100px_100px_100px_80px_60px] gap-2 px-4 sm:px-8 py-3 border-b border-outline/50 hover:bg-surface-highest/50 transition-colors min-w-[700px]"
          >
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-on-surface">{token.symbol}</span>
              {token.isNative && (
                <span className="text-xs text-accent bg-accent/10 px-1.5 py-0.5">NATIVE</span>
              )}
            </div>
            <span className="text-sm text-muted">{token.chainName}</span>
            <span className="text-sm text-on-surface font-medium">
              {token.balance < 0.0001 ? token.balance.toExponential(2) : token.balance.toLocaleString(undefined, { maximumFractionDigits: 4 })}
            </span>
            <span className="text-sm text-on-surface-variant">
              {token.priceUsd > 0 ? `$${token.priceUsd.toLocaleString(undefined, { maximumFractionDigits: token.priceUsd < 1 ? 4 : 2 })}` : "—"}
            </span>
            <span className="text-sm font-bold text-on-surface">
              {formatCurrency(token.balanceUsd)}
            </span>
            <span className={`text-sm font-medium ${
              (token.priceChange24h ?? 0) >= 0 ? "text-accent" : "text-danger"
            }`}>
              {token.priceChange24h !== null
                ? `${token.priceChange24h > 0 ? "+" : ""}${token.priceChange24h.toFixed(1)}%`
                : "—"}
            </span>
            <span className="text-sm text-muted">{token.allocation.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

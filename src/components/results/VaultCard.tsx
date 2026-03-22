"use client";

import Link from "next/link";
import type { ScanResult } from "@/types/scanner";
import { formatCurrency, formatApy, formatPercentChange, formatBudget } from "@/lib/formatters";
import RiskBadge from "./RiskBadge";

interface VaultCardProps {
  result: ScanResult;
  budget: number;
}

function getInvestUrl(pool: ScanResult["pool"]): string {
  // DeFiLlama pool detail page - always works and links to the protocol
  return `https://defillama.com/yields/pool/${pool.pool}`;
}

export default function VaultCard({ result, budget }: VaultCardProps) {
  const { pool, riskClassification, suggestedAllocation, matchScore } = result;
  const change7d = formatPercentChange(pool.apyPct7D);
  const allocationPct = budget > 0 ? ((suggestedAllocation / budget) * 100).toFixed(1) : "0";
  const investUrl = getInvestUrl(pool);

  return (
    <div className="group bg-surface-low hover:bg-surface-high transition-all duration-300 p-8 border border-outline-variant/5">
      {/* Top row */}
      <div className="flex justify-between items-start mb-8">
        <div>
          <RiskBadge risk={riskClassification} />
          <h3 className="font-headline text-2xl mt-2">{pool.project}</h3>
          <p className="text-[10px] text-on-surface-variant mt-1 font-label">
            {pool.symbol} &middot; {pool.chain}
          </p>
        </div>
        <div className="text-right">
          <span className="block text-[9px] uppercase tracking-widest text-on-surface-variant font-bold">
            APY
          </span>
          <span className="text-3xl font-headline text-primary">{formatApy(pool.apy)}</span>
          {pool.apyBase !== null && pool.apyReward !== null && pool.apyReward > 0 && (
            <span className="block text-[10px] text-on-surface-variant mt-1">
              {formatApy(pool.apyBase)} base + {formatApy(pool.apyReward)} reward
            </span>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4 border-t border-outline-variant/10 pt-4 mb-6">
        <div>
          <span className="block text-[9px] uppercase tracking-widest text-on-surface-variant font-bold">
            TVL
          </span>
          <span className="text-sm font-label font-medium">{formatCurrency(pool.tvlUsd)}</span>
        </div>
        <div>
          <span className="block text-[9px] uppercase tracking-widest text-on-surface-variant font-bold">
            7D Change
          </span>
          <span className={`text-sm font-label font-medium ${change7d.positive ? "text-primary" : "text-error"}`}>
            {change7d.text}
          </span>
        </div>
        <div>
          <span className="block text-[9px] uppercase tracking-widest text-on-surface-variant font-bold">
            Match
          </span>
          <span className="text-sm font-label font-medium text-primary">{matchScore}%</span>
        </div>
      </div>

      {/* Allocation */}
      {suggestedAllocation > 0 && (
        <div className="mb-6 bg-surface-lowest p-3">
          <span className="text-[9px] uppercase tracking-widest text-on-surface-variant font-bold">
            Suggested Allocation
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="font-headline text-xl text-on-surface">
              {formatBudget(suggestedAllocation)}
            </span>
            <span className="text-[10px] text-on-surface-variant">({allocationPct}%)</span>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <Link
          href={`/protocol/${pool.project}`}
          className="w-12 bg-transparent border border-outline text-on-surface py-3 text-[10px] uppercase font-bold tracking-widest hover:bg-on-surface hover:text-background transition-all flex items-center justify-center"
          title="AI Deep Research"
        >
          <span className="material-symbols-outlined text-sm">psychology</span>
        </Link>
        <a
          href={investUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 bg-primary text-on-primary py-3 text-[10px] uppercase font-bold tracking-widest hover:bg-primary-dim transition-all text-center flex items-center justify-center gap-2"
        >
          Invest
          <span className="material-symbols-outlined text-sm">open_in_new</span>
        </a>
      </div>
    </div>
  );
}

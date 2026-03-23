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
  if (pool.source === "beefy" && pool.beefyVaultId) {
    return `https://app.beefy.com/vault/${pool.beefyVaultId}`;
  }
  return `https://defillama.com/yields/pool/${pool.pool}`;
}

export default function VaultCard({ result, budget }: VaultCardProps) {
  const { pool, riskClassification, suggestedAllocation, matchScore } = result;
  const change7d = formatPercentChange(pool.apyPct7D);
  const allocationPct = budget > 0 ? ((suggestedAllocation / budget) * 100).toFixed(1) : "0";
  const investUrl = getInvestUrl(pool);

  return (
    <div className="group bg-surface-low border border-outline hover:border-accent/30 hover:-translate-y-0.5 transition-all duration-300 p-4 sm:p-8">
      {/* Top row */}
      <div className="flex justify-between items-start mb-6 sm:mb-8">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <RiskBadge risk={riskClassification} />
            {pool.source === "beefy" && (
              <span className="text-xs font-semibold uppercase tracking-[0.1em] bg-cta/10 text-cta px-2 py-0.5">Beefy</span>
            )}
            {pool.autoCompound && (
              <span className="text-xs font-semibold uppercase tracking-[0.1em] bg-accent/10 text-accent px-2 py-0.5">Auto-Compound</span>
            )}
            {pool.securityData && (
              <span className={`inline-block w-2 h-2 ${
                pool.securityData.securityScore >= 70 ? "bg-accent" : pool.securityData.securityScore >= 40 ? "bg-cta" : "bg-danger"
              }`} title={`Security: ${pool.securityData.securityScore}/100`} />
            )}
          </div>
          <h3 className="font-headline text-2xl font-black text-on-surface mt-2">{pool.project}</h3>
          <p className="text-xs text-muted mt-1">
            {pool.symbol} &middot; {pool.chain}
          </p>
        </div>
        <div className="text-right">
          <span className="block text-[13px] font-semibold uppercase tracking-[0.2em] text-label/70">
            APY
          </span>
          <span className="font-headline text-2xl sm:text-4xl font-black text-accent">{formatApy(pool.apy)}</span>
          {pool.apyBase !== null && pool.apyReward !== null && pool.apyReward > 0 && (
            <span className="block text-xs text-muted mt-1">
              {formatApy(pool.apyBase)} base + {formatApy(pool.apyReward)} reward
            </span>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4 border-t border-outline pt-4 mb-6">
        <div>
          <span className="block text-[13px] font-semibold uppercase tracking-[0.2em] text-label/70">
            TVL
          </span>
          <span className="text-sm font-medium text-on-surface-variant">{formatCurrency(pool.tvlUsd)}</span>
        </div>
        <div>
          <span className="block text-[13px] font-semibold uppercase tracking-[0.2em] text-label/70">
            7D Change
          </span>
          <span className={`text-sm font-medium ${change7d.positive ? "text-accent" : "text-danger"}`}>
            {change7d.text}
          </span>
        </div>
        <div>
          <span className="block text-[13px] font-semibold uppercase tracking-[0.2em] text-label/70">
            Match
          </span>
          <span className="text-sm font-black text-accent">{matchScore}%</span>
        </div>
      </div>

      {/* Allocation */}
      {suggestedAllocation > 0 && (
        <div className="mb-6 bg-surface-highest border border-outline p-4">
          <span className="text-[13px] font-semibold uppercase tracking-[0.2em] text-label/70">
            Suggested Allocation
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="font-headline text-xl font-black text-on-surface">
              {formatBudget(suggestedAllocation)}
            </span>
            <span className="text-xs text-muted">({allocationPct}%)</span>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <Link
          href={`/protocol/${pool.project}`}
          className="w-12 bg-transparent border border-btn text-btn py-3 text-xs uppercase font-semibold tracking-[0.12em] hover:border-accent/30 hover:text-on-surface transition-all duration-300 flex items-center justify-center"
          title="AI Deep Research"
        >
          <span className="material-symbols-outlined text-sm">psychology</span>
        </Link>
        <a
          href={investUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="group/btn flex-1 bg-cta text-white py-3 text-[13px] uppercase font-semibold tracking-[0.12em] hover:bg-cta/90 transition-all duration-300 text-center flex items-center justify-center gap-2"
        >
          Invest
          <span className="material-symbols-outlined text-sm inline-block transition-transform duration-300 group-hover/btn:translate-x-1">open_in_new</span>
        </a>
      </div>
    </div>
  );
}

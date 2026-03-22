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
    <div className="group bg-[#f2f3f5] border border-[#d7dade] hover:border-[#00D4AA]/30 hover:-translate-y-0.5 transition-all duration-300 p-8">
      {/* Top row */}
      <div className="flex justify-between items-start mb-8">
        <div>
          <RiskBadge risk={riskClassification} />
          <h3 className="font-headline text-2xl font-black text-[#203241] mt-2">{pool.project}</h3>
          <p className="text-[10px] text-[#6b7781] mt-1">
            {pool.symbol} &middot; {pool.chain}
          </p>
        </div>
        <div className="text-right">
          <span className="block text-[11px] font-semibold uppercase tracking-[0.28em] text-[#45515d]/70">
            APY
          </span>
          <span className="font-headline text-4xl font-black text-[#00D4AA]">{formatApy(pool.apy)}</span>
          {pool.apyBase !== null && pool.apyReward !== null && pool.apyReward > 0 && (
            <span className="block text-[10px] text-[#6b7781] mt-1">
              {formatApy(pool.apyBase)} base + {formatApy(pool.apyReward)} reward
            </span>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4 border-t border-[#d7dade] pt-4 mb-6">
        <div>
          <span className="block text-[11px] font-semibold uppercase tracking-[0.28em] text-[#45515d]/70">
            TVL
          </span>
          <span className="text-sm font-medium text-[#43515d]">{formatCurrency(pool.tvlUsd)}</span>
        </div>
        <div>
          <span className="block text-[11px] font-semibold uppercase tracking-[0.28em] text-[#45515d]/70">
            7D Change
          </span>
          <span className={`text-sm font-medium ${change7d.positive ? "text-[#00896e]" : "text-[#ff4d4d]"}`}>
            {change7d.text}
          </span>
        </div>
        <div>
          <span className="block text-[11px] font-semibold uppercase tracking-[0.28em] text-[#45515d]/70">
            Match
          </span>
          <span className="text-sm font-black text-[#00D4AA]">{matchScore}%</span>
        </div>
      </div>

      {/* Allocation */}
      {suggestedAllocation > 0 && (
        <div className="mb-6 bg-white border border-[#d7dade] p-4">
          <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#45515d]/70">
            Suggested Allocation
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="font-headline text-xl font-black text-[#203241]">
              {formatBudget(suggestedAllocation)}
            </span>
            <span className="text-[10px] text-[#6b7781]">({allocationPct}%)</span>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <Link
          href={`/protocol/${pool.project}`}
          className="w-12 bg-transparent border border-[#2a3a46] text-[#2a3a46] py-3 text-[10px] uppercase font-semibold tracking-[0.15em] hover:border-[#00D4AA]/30 hover:text-[#203241] transition-all duration-300 flex items-center justify-center"
          title="AI Deep Research"
        >
          <span className="material-symbols-outlined text-sm">psychology</span>
        </Link>
        <a
          href={investUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="group/btn flex-1 bg-[#ff6c12] text-white py-3 text-[11px] uppercase font-semibold tracking-[0.15em] hover:bg-[#ff6c12]/90 transition-all duration-300 text-center flex items-center justify-center gap-2"
        >
          Invest
          <span className="material-symbols-outlined text-sm inline-block transition-transform duration-300 group-hover/btn:translate-x-1">open_in_new</span>
        </a>
      </div>
    </div>
  );
}

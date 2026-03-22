"use client";

import { useState, useMemo } from "react";
import type { ScanResult } from "@/types/scanner";
import VaultCard from "./VaultCard";

type SortKey = "match" | "apy_desc" | "apy_asc" | "tvl_desc" | "tvl_asc" | "stable_first" | "chain";

interface ResultsGridProps {
  results: ScanResult[];
  budget: number;
}

const sortOptions: { key: SortKey; label: string }[] = [
  { key: "match", label: "Best Match" },
  { key: "apy_desc", label: "Highest APY" },
  { key: "apy_asc", label: "Lowest APY" },
  { key: "tvl_desc", label: "Highest TVL" },
  { key: "tvl_asc", label: "Lowest TVL" },
  { key: "stable_first", label: "Stablecoins First" },
  { key: "chain", label: "By Chain" },
];

export default function ResultsGrid({ results, budget }: ResultsGridProps) {
  const [sortBy, setSortBy] = useState<SortKey>("match");
  const [filterChain, setFilterChain] = useState<string>("");
  const [filterProtocol, setFilterProtocol] = useState<string>("");
  const [showStableOnly, setShowStableOnly] = useState(false);

  // Extract unique chains and protocols for filter dropdowns
  const chains = useMemo(() => {
    const set = new Set(results.map((r) => r.pool.chain));
    return Array.from(set).sort();
  }, [results]);

  const protocols = useMemo(() => {
    const set = new Set(results.map((r) => r.pool.project));
    return Array.from(set).sort();
  }, [results]);

  // Filter
  const filtered = useMemo(() => {
    let list = results;
    if (filterChain) list = list.filter((r) => r.pool.chain === filterChain);
    if (filterProtocol) list = list.filter((r) => r.pool.project === filterProtocol);
    if (showStableOnly) list = list.filter((r) => r.pool.stablecoin);
    return list;
  }, [results, filterChain, filterProtocol, showStableOnly]);

  // Sort
  const sorted = useMemo(() => {
    const copy = [...filtered];
    switch (sortBy) {
      case "apy_desc":
        return copy.sort((a, b) => (b.pool.apy || 0) - (a.pool.apy || 0));
      case "apy_asc":
        return copy.sort((a, b) => (a.pool.apy || 0) - (b.pool.apy || 0));
      case "tvl_desc":
        return copy.sort((a, b) => (b.pool.tvlUsd || 0) - (a.pool.tvlUsd || 0));
      case "tvl_asc":
        return copy.sort((a, b) => (a.pool.tvlUsd || 0) - (b.pool.tvlUsd || 0));
      case "stable_first":
        return copy.sort((a, b) => (b.pool.stablecoin ? 1 : 0) - (a.pool.stablecoin ? 1 : 0) || (b.pool.apy || 0) - (a.pool.apy || 0));
      case "chain":
        return copy.sort((a, b) => a.pool.chain.localeCompare(b.pool.chain) || (b.pool.apy || 0) - (a.pool.apy || 0));
      case "match":
      default:
        return copy.sort((a, b) => b.matchScore - a.matchScore || (b.pool.apy || 0) - (a.pool.apy || 0));
    }
  }, [filtered, sortBy]);

  if (results.length === 0) {
    return (
      <div className="bg-[#f2f3f5] border border-[#d7dade] p-16 text-center">
        <span className="material-symbols-outlined text-4xl text-[#6b7781] mb-4 block">
          search_off
        </span>
        <h3 className="font-headline text-2xl font-black text-[#203241] mb-2">No Results Found</h3>
        <p className="text-[#6b7781] text-sm max-w-md mx-auto">
          No yield opportunities match your criteria. Try adjusting your risk appetite, budget, or
          switching to all asset types.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Sort & Filter Bar */}
      <div className="mb-8 flex flex-wrap items-end gap-4 bg-[#f2f3f5] border border-[#d7dade] p-8 transition-all duration-300">
        {/* Sort */}
        <div className="flex flex-col gap-2">
          <label className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#45515d]/70">
            Sort By
          </label>
          <div className="flex gap-1">
            {sortOptions.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setSortBy(opt.key)}
                className={`px-3 py-1.5 text-[10px] font-semibold tracking-[0.1em] transition-all duration-300 ${
                  sortBy === opt.key
                    ? "bg-[#00D4AA] text-white"
                    : "bg-white border border-[#d7dade] text-[#6b7781] hover:text-[#43515d] hover:border-[#00D4AA]/30"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="h-8 w-px bg-[#d7dade] hidden lg:block" />

        {/* Chain filter */}
        <div className="flex flex-col gap-2">
          <label className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#45515d]/70">
            Chain
          </label>
          <select
            value={filterChain}
            onChange={(e) => setFilterChain(e.target.value)}
            className="bg-white border border-[#d7dade] text-[11px] py-1.5 px-3 outline-none text-[#203241] appearance-none cursor-pointer transition-all duration-300 hover:border-[#00D4AA]/30"
          >
            <option value="">All Chains ({chains.length})</option>
            {chains.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* Protocol filter */}
        <div className="flex flex-col gap-2">
          <label className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#45515d]/70">
            Protocol
          </label>
          <select
            value={filterProtocol}
            onChange={(e) => setFilterProtocol(e.target.value)}
            className="bg-white border border-[#d7dade] text-[11px] py-1.5 px-3 outline-none text-[#203241] appearance-none cursor-pointer transition-all duration-300 hover:border-[#00D4AA]/30"
          >
            <option value="">All Protocols ({protocols.length})</option>
            {protocols.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        {/* Stablecoin toggle */}
        <button
          onClick={() => setShowStableOnly(!showStableOnly)}
          className={`px-3 py-1.5 text-[10px] font-semibold tracking-[0.1em] transition-all duration-300 ${
            showStableOnly
              ? "bg-[#00D4AA] text-white"
              : "bg-white border border-[#d7dade] text-[#6b7781] hover:text-[#43515d] hover:border-[#00D4AA]/30"
          }`}
        >
          Stablecoins Only
        </button>

        {/* Count */}
        <span className="text-[11px] text-[#6b7781] ml-auto">
          Showing {sorted.length} of {results.length}
        </span>
      </div>

      {/* Results Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-in">
        {sorted.map((result, i) => (
          <div key={result.pool.pool} className="animate-slide-up" style={{ animationDelay: `${Math.min(i, 10) * 30}ms` }}>
            <VaultCard result={result} budget={budget} />
          </div>
        ))}
      </div>
    </div>
  );
}

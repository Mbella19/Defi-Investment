"use client";

import { useEffect, useState } from "react";
import { formatCurrency } from "@/lib/formatters";

interface MarketStats {
  totalTvl: number;
  topChains: { name: string; tvl: number }[];
  poolCount: number;
}

export default function MarketOverview() {
  const [stats, setStats] = useState<MarketStats | null>(null);

  useEffect(() => {
    async function fetchStats() {
      try {
        const [chainsRes, poolsRes] = await Promise.all([
          fetch("/api/chains"),
          fetch("https://yields.llama.fi/pools"),
        ]);
        const chains = await chainsRes.json();
        const poolsData = await poolsRes.json();

        const totalTvl = chains.reduce(
          (sum: number, c: { tvl: number }) => sum + c.tvl,
          0
        );

        setStats({
          totalTvl,
          topChains: chains.slice(0, 5),
          poolCount: poolsData.data?.length || 0,
        });
      } catch {
        // Fail silently - dashboard stats are non-critical
      }
    }
    fetchStats();
  }, []);

  if (!stats) {
    return (
      <div className="grid grid-cols-12 gap-[1px] bg-surface mb-12">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="col-span-3 bg-surface-low p-8 animate-pulse-slow">
            <div className="h-3 w-20 bg-surface-highest mb-2" />
            <div className="h-8 w-32 bg-surface-highest" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <section className="mb-12">
      <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-on-surface-variant mb-6 block">
        Market Intelligence
      </span>
      <div className="grid grid-cols-12 gap-[1px] bg-surface">
        <div className="col-span-6 lg:col-span-3 bg-surface-low ghost-border hover:bg-surface-high transition-all p-8">
          <span className="text-[9px] uppercase tracking-widest text-on-surface-variant font-bold block mb-2">
            Total DeFi TVL
          </span>
          <span className="font-headline text-3xl text-on-surface block">
            {formatCurrency(stats.totalTvl)}
          </span>
        </div>
        <div className="col-span-6 lg:col-span-3 bg-surface-low ghost-border hover:bg-surface-high transition-all p-8">
          <span className="text-[9px] uppercase tracking-widest text-on-surface-variant font-bold block mb-2">
            Yield Pools
          </span>
          <span className="font-headline text-3xl text-on-surface block">
            {stats.poolCount.toLocaleString()}
          </span>
        </div>
        {stats.topChains.slice(0, 2).map((chain) => (
          <div
            key={chain.name}
            className="col-span-6 lg:col-span-3 bg-surface-low ghost-border hover:bg-surface-high transition-all p-8"
          >
            <span className="text-[9px] uppercase tracking-widest text-on-surface-variant font-bold block mb-2">
              {chain.name}
            </span>
            <span className="font-headline text-3xl text-primary block">
              {formatCurrency(chain.tvl)}
            </span>
          </div>
        ))}
      </div>

      {/* Top chains row */}
      <div className="grid grid-cols-12 gap-[1px] bg-surface mt-[1px]">
        {stats.topChains.slice(2, 5).map((chain) => (
          <div
            key={chain.name}
            className="col-span-4 bg-surface-low ghost-border hover:bg-surface-high transition-all p-6"
          >
            <span className="text-[9px] uppercase tracking-widest text-on-surface-variant font-bold block mb-1">
              {chain.name}
            </span>
            <span className="font-label text-lg text-on-surface">{formatCurrency(chain.tvl)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

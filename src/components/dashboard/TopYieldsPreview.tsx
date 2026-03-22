"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { DefiLlamaPool } from "@/types/pool";
import { formatCurrency, formatApy } from "@/lib/formatters";

export default function TopYieldsPreview() {
  const [pools, setPools] = useState<DefiLlamaPool[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("https://yields.llama.fi/pools")
      .then((res) => res.json())
      .then((data) => {
        const filtered = (data.data as DefiLlamaPool[])
          .filter(
            (p) =>
              p.apy &&
              p.apy > 0 &&
              p.tvlUsd &&
              p.tvlUsd > 10_000_000 &&
              p.stablecoin
          )
          .sort((a, b) => (b.apy || 0) - (a.apy || 0))
          .slice(0, 6);
        setPools(filtered);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <section className="mb-12">
      <div className="flex items-center justify-between mb-6">
        <div>
          <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-on-surface-variant mb-2 block">
            Top Opportunities
          </span>
          <h3 className="font-headline text-2xl text-on-surface">
            Stablecoin <span className="italic text-primary">Yields</span>
          </h3>
        </div>
        <Link
          href="/scanner"
          className="text-[10px] text-primary uppercase tracking-widest font-bold hover:text-on-surface transition-colors"
        >
          Scan All &rarr;
        </Link>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[1px] bg-surface">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-surface-low p-6 animate-pulse-slow">
              <div className="h-4 w-24 bg-surface-highest mb-3" />
              <div className="h-8 w-16 bg-surface-highest" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[1px] bg-surface">
          {pools.map((pool) => (
            <Link
              key={pool.pool}
              href={`/protocol/${pool.project}`}
              className="bg-surface-low hover:bg-surface-high transition-all duration-300 p-6 group"
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <span className="text-[10px] text-on-surface-variant block">{pool.chain}</span>
                  <span className="font-headline text-lg text-on-surface">{pool.project}</span>
                </div>
                <span className="text-2xl font-headline text-primary">{formatApy(pool.apy)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-on-surface-variant">{pool.symbol}</span>
                <span className="text-[10px] text-on-surface-variant">
                  TVL: {formatCurrency(pool.tvlUsd)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

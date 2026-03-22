"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import type { ScanResponse } from "@/types/scanner";
import type { RiskAppetite, AssetType } from "@/types/scanner";
import ResultsGrid from "@/components/results/ResultsGrid";
import { GridSkeleton } from "@/components/ui/LoadingState";
import { formatBudget } from "@/lib/formatters";
import Link from "next/link";

function ResultsContent() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<ScanResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const budget = Number(searchParams.get("budget")) || 10000;
  const risk = (searchParams.get("risk") || "low") as RiskAppetite;
  const asset = (searchParams.get("asset") || "stablecoins") as AssetType;
  const chain = searchParams.get("chain") || null;

  useEffect(() => {
    setIsLoading(true);
    fetch("/api/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        budget,
        riskAppetite: risk,
        assetType: asset,
        chain,
      }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Scan failed");
        return res.json();
      })
      .then((result: ScanResponse) => {
        setData(result);
        setIsLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setIsLoading(false);
      });
  }, [budget, risk, asset, chain]);

  return (
    <div className="p-8">
      {/* Hero */}
      <section className="mb-12 grid grid-cols-12 gap-8 items-end">
        <div className="col-span-12 lg:col-span-8">
          <h2 className="font-headline text-5xl md:text-7xl font-light leading-none mb-4 tracking-tighter text-on-surface">
            Vault <br />
            <span className="italic text-primary">Explorer.</span>
          </h2>
          {data && (
            <p className="font-body text-on-surface-variant max-w-xl text-sm leading-relaxed">
              Found {data.totalMatchingPools} matching pools. Showing top {data.results.length}{" "}
              results ranked by match score.
            </p>
          )}
        </div>
        <div className="col-span-12 lg:col-span-4 flex flex-col items-end gap-2">
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">
              Budget
            </p>
            <p className="font-headline text-3xl">{formatBudget(budget)}</p>
          </div>
        </div>
      </section>

      {/* Active Filters */}
      <section className="mb-8 flex flex-wrap items-center gap-4 bg-surface-low p-4 border-l-2 border-primary">
        <div className="flex flex-col gap-1 pr-6">
          <label className="text-[9px] uppercase tracking-widest text-on-surface-variant font-bold">
            Risk
          </label>
          <span className="text-[11px] text-on-surface capitalize">{risk}</span>
        </div>
        <div className="h-8 w-[1px] bg-outline-variant/20 hidden sm:block" />
        <div className="flex flex-col gap-1 px-4">
          <label className="text-[9px] uppercase tracking-widest text-on-surface-variant font-bold">
            Assets
          </label>
          <span className="text-[11px] text-on-surface">
            {asset === "stablecoins" ? "Stablecoins Only" : "All Assets"}
          </span>
        </div>
        <div className="h-8 w-[1px] bg-outline-variant/20 hidden sm:block" />
        <div className="flex flex-col gap-1 px-4">
          <label className="text-[9px] uppercase tracking-widest text-on-surface-variant font-bold">
            Network
          </label>
          <span className="text-[11px] text-on-surface">{chain || "All Networks"}</span>
        </div>
        <Link
          href="/scanner"
          className="ml-auto bg-transparent border border-outline px-6 py-2 text-[10px] uppercase font-bold tracking-widest hover:bg-on-surface hover:text-background transition-all"
        >
          Modify Scan
        </Link>
      </section>

      {/* Results */}
      {error ? (
        <div className="bg-error-container/20 border-l-2 border-error p-8 text-center">
          <span className="material-symbols-outlined text-3xl text-error mb-4 block">error</span>
          <p className="text-error text-sm">{error}</p>
          <Link
            href="/scanner"
            className="inline-block mt-4 bg-primary text-on-primary px-6 py-2 text-[10px] uppercase font-bold tracking-widest"
          >
            Try Again
          </Link>
        </div>
      ) : isLoading ? (
        <div>
          <div className="flex items-center gap-3 mb-8">
            <div className="w-2 h-2 bg-primary animate-pulse" />
            <span className="text-[11px] text-on-surface-variant uppercase tracking-widest">
              Scanning 10,000+ pools across DeFi...
            </span>
          </div>
          <GridSkeleton count={6} />
        </div>
      ) : data ? (
        <ResultsGrid results={data.results} budget={budget} />
      ) : null}
    </div>
  );
}

export default function ResultsPage() {
  return (
    <Suspense fallback={<div className="p-8"><GridSkeleton count={6} /></div>}>
      <ResultsContent />
    </Suspense>
  );
}

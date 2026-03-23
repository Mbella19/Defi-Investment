"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import type { ScanResponse } from "@/types/scanner";
import type { RiskAppetite, AssetType } from "@/types/scanner";
import ResultsGrid from "@/components/results/ResultsGrid";
import { GridSkeleton } from "@/components/ui/LoadingState";
import { formatBudget } from "@/lib/formatters";
import Link from "next/link";

function ResultsRequest({
  budget,
  risk,
  asset,
  chain,
}: {
  budget: number;
  risk: RiskAppetite;
  asset: AssetType;
  chain: string | null;
}) {
  const [data, setData] = useState<ScanResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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
      })
      .catch((err) => {
        setError(err.message);
      });
  }, [budget, risk, asset, chain]);

  const isLoading = data === null && error === null;

  return (
    <>
      {error ? (
        <div className="bg-danger/5 border border-danger/10 p-8 text-center">
          <span className="material-symbols-outlined text-3xl text-danger mb-4 block">error</span>
          <p className="text-danger text-sm">{error}</p>
          <Link
            href="/scanner"
            className="inline-block mt-4 bg-cta text-white px-8 py-4 text-[13px] uppercase font-semibold tracking-[0.12em] hover:bg-cta/90 transition-all duration-300"
          >
            Try Again
          </Link>
        </div>
      ) : isLoading ? (
        <div>
          <div className="flex items-center gap-3 mb-8">
            <div className="w-2 h-2 bg-accent animate-pulse" />
            <span className="text-[13px] font-semibold tracking-[0.2em] uppercase text-label/70">
              Scanning 10,000+ pools across DeFi...
            </span>
          </div>
          <GridSkeleton count={6} />
        </div>
      ) : data ? (
        <ResultsGrid results={data.results} budget={budget} />
      ) : null}
    </>
  );
}

function ResultsContent() {
  const searchParams = useSearchParams();
  const budget = Number(searchParams.get("budget")) || 10000;
  const risk = (searchParams.get("risk") || "low") as RiskAppetite;
  const asset = (searchParams.get("asset") || "stablecoins") as AssetType;
  const chain = searchParams.get("chain") || null;
  const requestKey = [budget, risk, asset, chain ?? "all"].join(":");

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-8 sm:py-12">
      {/* Hero */}
      <section className="mb-12 grid grid-cols-12 gap-4 sm:gap-8 items-end">
        <div className="col-span-12 lg:col-span-8">
          <h2 className="font-headline text-3xl sm:text-5xl md:text-7xl font-black leading-none mb-4 tracking-tighter text-on-surface">
            Vault <br />
            <span className="italic text-accent">Explorer.</span>
          </h2>
          <p className="text-muted max-w-xl text-sm leading-relaxed">
            Scanning 10,000+ DeFi pools to find the best risk-adjusted yields for your portfolio.
          </p>
        </div>
        <div className="col-span-12 lg:col-span-4 flex flex-col items-start lg:items-end gap-2">
          <div className="text-left lg:text-right">
            <div className="flex items-center gap-3 lg:justify-end">
              <div className="w-2 h-2 bg-accent" />
              <p className="text-[13px] font-semibold uppercase tracking-[0.2em] text-label/70">
                Budget
              </p>
            </div>
            <p className="font-headline text-4xl font-black text-accent mt-1">{formatBudget(budget)}</p>
          </div>
        </div>
      </section>

      {/* Active Filters */}
      <section className="mb-8 flex flex-wrap items-center gap-4 bg-surface-low border border-outline p-4 sm:p-8 transition-all duration-300">
        <div className="flex flex-col gap-1 pr-6">
          <label className="text-[13px] font-semibold uppercase tracking-[0.2em] text-label/70">
            Risk
          </label>
          <span className="text-[13px] text-on-surface capitalize">{risk}</span>
        </div>
        <div className="h-8 w-px border-t border-outline hidden sm:block" />
        <div className="flex flex-col gap-1 px-4">
          <label className="text-[13px] font-semibold uppercase tracking-[0.2em] text-label/70">
            Assets
          </label>
          <span className="text-[13px] text-on-surface">
            {asset === "stablecoins" ? "Stablecoins Only" : "All Assets"}
          </span>
        </div>
        <div className="h-8 w-px border-t border-outline hidden sm:block" />
        <div className="flex flex-col gap-1 px-4">
          <label className="text-[13px] font-semibold uppercase tracking-[0.2em] text-label/70">
            Network
          </label>
          <span className="text-[13px] text-on-surface">{chain || "All Networks"}</span>
        </div>
        <Link
          href="/scanner"
          className="group ml-auto bg-transparent border border-btn px-8 py-4 text-[13px] uppercase font-semibold tracking-[0.12em] text-btn hover:border-accent/30 hover:text-on-surface transition-all duration-300 flex items-center gap-2"
        >
          Modify Scan
          <span className="inline-block transition-transform duration-300 group-hover:translate-x-1">&rarr;</span>
        </Link>
      </section>

      {/* Results */}
      <ResultsRequest key={requestKey} budget={budget} risk={risk} asset={asset} chain={chain} />
    </div>
  );
}

export default function ResultsPage() {
  return (
    <Suspense fallback={<div className="px-4 sm:px-6 lg:px-10 py-8 sm:py-12"><GridSkeleton count={6} /></div>}>
      <ResultsContent />
    </Suspense>
  );
}

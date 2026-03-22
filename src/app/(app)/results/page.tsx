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
        <div className="bg-[#ff4d4d]/5 border border-[#ff4d4d]/10 p-8 text-center">
          <span className="material-symbols-outlined text-3xl text-[#ff4d4d] mb-4 block">error</span>
          <p className="text-[#ff4d4d] text-sm">{error}</p>
          <Link
            href="/scanner"
            className="inline-block mt-4 bg-[#ff6c12] text-white px-8 py-4 text-[11px] uppercase font-semibold tracking-[0.15em] hover:bg-[#ff6c12]/90 transition-all duration-300"
          >
            Try Again
          </Link>
        </div>
      ) : isLoading ? (
        <div>
          <div className="flex items-center gap-3 mb-8">
            <div className="w-2 h-2 bg-[#00D4AA] animate-pulse" />
            <span className="text-[11px] font-semibold tracking-[0.28em] uppercase text-[#45515d]/70">
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
    <div className="px-6 lg:px-10 py-12">
      {/* Hero */}
      <section className="mb-12 grid grid-cols-12 gap-8 items-end">
        <div className="col-span-12 lg:col-span-8">
          <h2 className="font-headline text-5xl md:text-7xl font-black leading-none mb-4 tracking-tighter text-[#203241]">
            Vault <br />
            <span className="italic text-[#00D4AA]">Explorer.</span>
          </h2>
          {data && (
            <p className="text-[#6b7781] max-w-xl text-sm leading-relaxed">
              Found {data.totalMatchingPools} matching pools. Showing top {data.results.length}{" "}
              results ranked by match score.
            </p>
          )}
        </div>
        <div className="col-span-12 lg:col-span-4 flex flex-col items-end gap-2">
          <div className="text-right">
            <div className="flex items-center gap-3 justify-end">
              <div className="w-2 h-2 bg-[#00D4AA]" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#45515d]/70">
                Budget
              </p>
            </div>
            <p className="font-headline text-4xl font-black text-[#00D4AA] mt-1">{formatBudget(budget)}</p>
          </div>
        </div>
      </section>

      {/* Active Filters */}
      <section className="mb-8 flex flex-wrap items-center gap-4 bg-[#f2f3f5] border border-[#d7dade] p-8 transition-all duration-300">
        <div className="flex flex-col gap-1 pr-6">
          <label className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#45515d]/70">
            Risk
          </label>
          <span className="text-[11px] text-[#203241] capitalize">{risk}</span>
        </div>
        <div className="h-8 w-px border-t border-[#d7dade] hidden sm:block" />
        <div className="flex flex-col gap-1 px-4">
          <label className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#45515d]/70">
            Assets
          </label>
          <span className="text-[11px] text-[#203241]">
            {asset === "stablecoins" ? "Stablecoins Only" : "All Assets"}
          </span>
        </div>
        <div className="h-8 w-px border-t border-[#d7dade] hidden sm:block" />
        <div className="flex flex-col gap-1 px-4">
          <label className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#45515d]/70">
            Network
          </label>
          <span className="text-[11px] text-[#203241]">{chain || "All Networks"}</span>
        </div>
        <Link
          href="/scanner"
          className="group ml-auto bg-transparent border border-[#2a3a46] px-8 py-4 text-[11px] uppercase font-semibold tracking-[0.15em] text-[#2a3a46] hover:border-[#00D4AA]/30 hover:text-[#203241] transition-all duration-300 flex items-center gap-2"
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
    <Suspense fallback={<div className="px-6 lg:px-10 py-12"><GridSkeleton count={6} /></div>}>
      <ResultsContent />
    </Suspense>
  );
}

"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { DefiLlamaProtocol, DefiLlamaPool } from "@/types/pool";
import type { ProtocolAnalysis } from "@/types/analysis";
import ProtocolHeader from "@/components/protocol/ProtocolHeader";
import LegitimacyReport from "@/components/protocol/LegitimacyReport";
import { AnalysisSkeleton } from "@/components/ui/LoadingState";
import Link from "next/link";

export default function ProtocolPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [protocol, setProtocol] = useState<DefiLlamaProtocol | null>(null);
  const [pools, setPools] = useState<DefiLlamaPool[]>([]);
  const [analysis, setAnalysis] = useState<ProtocolAnalysis | null>(null);
  const [protocolLoading, setProtocolLoading] = useState(true);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Fetch protocol data from DeFiLlama
  useEffect(() => {
    async function fetchData() {
      try {
        const [protocolsRes, poolsRes] = await Promise.all([
          fetch("https://api.llama.fi/protocols"),
          fetch("https://yields.llama.fi/pools"),
        ]);
        const protocols: DefiLlamaProtocol[] = await protocolsRes.json();
        const poolsData = await poolsRes.json();

        const found = protocols.find((p) => p.slug === slug);
        if (found) {
          setProtocol(found);
          const protocolPools = (poolsData.data as DefiLlamaPool[]).filter(
            (p) => p.project === slug
          );
          setPools(protocolPools);
        }
      } catch (err) {
        console.error("Failed to fetch protocol data:", err);
      } finally {
        setProtocolLoading(false);
      }
    }
    fetchData();
  }, [slug]);

  // Trigger AI analysis
  const runAnalysis = async () => {
    setAnalysisLoading(true);
    setAnalysisError(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ protocolSlug: slug }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Analysis failed");
      }
      const data: ProtocolAnalysis = await res.json();
      setAnalysis(data);
    } catch (err) {
      setAnalysisError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setAnalysisLoading(false);
    }
  };

  if (protocolLoading) {
    return (
      <div className="px-4 sm:px-6 lg:px-10 py-8 sm:py-12">
        <AnalysisSkeleton />
      </div>
    );
  }

  if (!protocol) {
    return (
      <div className="px-4 sm:px-6 lg:px-10 py-8 sm:py-12">
        <div className="bg-surface-low border border-outline p-8 sm:p-16 text-center">
          <span className="material-symbols-outlined text-4xl text-danger mb-4 block">error</span>
          <h3 className="font-headline text-2xl font-black text-on-surface mb-2">Protocol Not Found</h3>
          <p className="text-muted text-sm mb-4">
            Could not find protocol &quot;{slug}&quot; on DeFiLlama.
          </p>
          <Link
            href="/scanner"
            className="inline-block bg-cta text-white px-8 py-4 text-[13px] uppercase font-semibold tracking-[0.12em] hover:bg-cta/90 transition-all duration-300"
          >
            Back to Scanner
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-8 sm:py-12">
      <ProtocolHeader protocol={protocol} pools={pools} />

      {/* AI Analysis Section */}
      <section className="mt-12">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-2 h-2 bg-accent" />
              <span className="text-[13px] font-semibold uppercase tracking-[0.2em] text-label/70">
                AI Intelligence Report
              </span>
            </div>
            <h3 className="font-headline text-3xl sm:text-5xl font-black text-on-surface">
              Legitimacy <span className="italic text-accent">Analysis</span>
            </h3>
          </div>
          {!analysis && !analysisLoading && (
            <button
              onClick={runAnalysis}
              className="group bg-cta text-white px-8 py-4 text-[13px] uppercase font-semibold tracking-[0.12em] hover:bg-cta/90 transition-all duration-300 flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-sm">psychology</span>
              Run Deep Research
              <span className="inline-block transition-transform duration-300 group-hover:translate-x-1">&rarr;</span>
            </button>
          )}
        </div>

        {!analysis && !analysisLoading && !analysisError && (
          <div className="bg-surface-low border border-outline p-6 sm:p-12 text-center transition-all duration-300">
            <span className="material-symbols-outlined text-5xl text-muted mb-4 block">
              smart_toy
            </span>
            <h4 className="font-headline text-xl font-black text-on-surface mb-2">
              AI Analysis Available
            </h4>
            <p className="text-muted text-sm max-w-md mx-auto mb-6">
              Click &quot;Run Deep Research&quot; to have our AI analyze this protocol&apos;s
              legitimacy, audit history, team reputation, and smart contract risks.
            </p>
            <p className="text-[13px] text-muted">
              Powered by Claude Opus &middot; Takes 10-20 seconds
            </p>
          </div>
        )}

        {analysisLoading && (
          <div>
            <div className="flex items-center gap-3 mb-8">
              <div className="w-2 h-2 bg-accent animate-pulse" />
              <span className="text-[13px] text-muted uppercase tracking-[0.2em]">
                AI is analyzing {protocol.name}...
              </span>
            </div>
            <AnalysisSkeleton />
          </div>
        )}

        {analysisError && (
          <div className="bg-danger/5 border border-danger/10 p-8">
            <span className="material-symbols-outlined text-2xl text-danger mb-2 block">error</span>
            <p className="text-danger text-sm mb-4">{analysisError}</p>
            <button
              onClick={runAnalysis}
              className="bg-cta text-white px-8 py-4 text-[13px] uppercase font-semibold tracking-[0.12em] hover:bg-cta/90 transition-all duration-300"
            >
              Retry Analysis
            </button>
          </div>
        )}

        {analysis && <LegitimacyReport analysis={analysis} />}
      </section>

      {/* Pools for this Protocol */}
      {pools.length > 0 && (
        <section className="mt-16">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-2 h-2 bg-accent" />
            <span className="text-[13px] font-semibold uppercase tracking-[0.2em] text-label/70">
              Yield Opportunities
            </span>
          </div>
          <h3 className="font-headline text-3xl sm:text-5xl font-black text-on-surface mb-8">
            Available <span className="italic text-accent">Pools</span>
          </h3>
          <div className="bg-surface-highest border border-outline overflow-x-auto">
            <div className="grid grid-cols-12 gap-4 p-4 text-[13px] font-semibold uppercase tracking-[0.2em] text-label/70 border-b border-outline min-w-[640px]">
              <span className="col-span-3">Pool</span>
              <span className="col-span-2">Chain</span>
              <span className="col-span-2 text-right">APY</span>
              <span className="col-span-2 text-right">TVL</span>
              <span className="col-span-1 text-center">Stable</span>
              <span className="col-span-2 text-right">Action</span>
            </div>
            {pools
              .sort((a, b) => (b.apy || 0) - (a.apy || 0))
              .slice(0, 20)
              .map((pool) => (
                <div
                  key={pool.pool}
                  className="grid grid-cols-12 gap-4 p-4 hover:bg-surface-low transition-all duration-300 items-center border-b border-outline last:border-b-0 min-w-[640px]"
                >
                  <span className="col-span-3 text-sm text-on-surface">{pool.symbol}</span>
                  <span className="col-span-2 text-[13px] text-muted">
                    {pool.chain}
                  </span>
                  <span className="col-span-2 text-right text-sm font-black text-accent">
                    {pool.apy?.toFixed(2)}%
                  </span>
                  <span className="col-span-2 text-right text-sm text-on-surface-variant">
                    {pool.tvlUsd
                      ? `$${(pool.tvlUsd / 1_000_000).toFixed(2)}M`
                      : "N/A"}
                  </span>
                  <span className="col-span-1 text-center">
                    {pool.stablecoin ? (
                      <span className="text-accent text-xs">YES</span>
                    ) : (
                      <span className="text-muted text-xs">NO</span>
                    )}
                  </span>
                  <span className="col-span-2 text-right">
                    <a
                      href={`https://defillama.com/yields/pool/${pool.pool}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[13px] text-cta hover:text-cta/80 uppercase tracking-[0.12em] font-semibold transition-all duration-300"
                    >
                      Invest &rarr;
                    </a>
                  </span>
                </div>
              ))}
          </div>
        </section>
      )}
    </div>
  );
}

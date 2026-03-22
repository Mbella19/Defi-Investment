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
      <div className="p-8">
        <AnalysisSkeleton />
      </div>
    );
  }

  if (!protocol) {
    return (
      <div className="p-8">
        <div className="bg-surface-lowest p-16 text-center border-l-4 border-error">
          <span className="material-symbols-outlined text-4xl text-error mb-4 block">error</span>
          <h3 className="font-headline text-2xl text-on-surface mb-2">Protocol Not Found</h3>
          <p className="text-on-surface-variant text-sm mb-4">
            Could not find protocol &quot;{slug}&quot; on DeFiLlama.
          </p>
          <Link
            href="/scanner"
            className="inline-block bg-primary text-on-primary px-6 py-2 text-[10px] uppercase font-bold tracking-widest"
          >
            Back to Scanner
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <ProtocolHeader protocol={protocol} pools={pools} />

      {/* AI Analysis Section */}
      <section className="mt-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-on-surface-variant mb-2 block">
              AI Intelligence Report
            </span>
            <h3 className="font-headline text-3xl text-on-surface">
              Legitimacy <span className="italic text-primary">Analysis</span>
            </h3>
          </div>
          {!analysis && !analysisLoading && (
            <button
              onClick={runAnalysis}
              className="bg-primary text-on-primary px-8 py-3 text-[10px] uppercase font-bold tracking-widest hover:bg-primary-dim transition-all flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-sm">psychology</span>
              Run Deep Research
            </button>
          )}
        </div>

        {!analysis && !analysisLoading && !analysisError && (
          <div className="bg-surface-lowest p-12 text-center border-l-4 border-outline-variant">
            <span className="material-symbols-outlined text-5xl text-on-surface-variant mb-4 block">
              smart_toy
            </span>
            <h4 className="font-headline text-xl text-on-surface mb-2">
              AI Analysis Available
            </h4>
            <p className="text-on-surface-variant text-sm max-w-md mx-auto mb-6">
              Click &quot;Run Deep Research&quot; to have our AI analyze this protocol&apos;s
              legitimacy, audit history, team reputation, and smart contract risks.
            </p>
            <p className="text-[10px] text-on-surface-variant">
              Powered by Claude Opus &middot; Takes 10-20 seconds
            </p>
          </div>
        )}

        {analysisLoading && (
          <div>
            <div className="flex items-center gap-3 mb-8">
              <div className="w-2 h-2 bg-primary animate-pulse" />
              <span className="text-[11px] text-on-surface-variant uppercase tracking-widest">
                AI is analyzing {protocol.name}...
              </span>
            </div>
            <AnalysisSkeleton />
          </div>
        )}

        {analysisError && (
          <div className="bg-error-container/20 border-l-2 border-error p-8">
            <span className="material-symbols-outlined text-2xl text-error mb-2 block">error</span>
            <p className="text-error text-sm mb-4">{analysisError}</p>
            <button
              onClick={runAnalysis}
              className="bg-primary text-on-primary px-6 py-2 text-[10px] uppercase font-bold tracking-widest"
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
          <h3 className="font-headline text-2xl text-on-surface mb-6">
            Available <span className="italic text-primary">Pools</span>
          </h3>
          <div className="bg-surface-low ghost-border">
            <div className="grid grid-cols-12 gap-4 p-4 text-[9px] uppercase tracking-widest text-on-surface-variant font-bold border-b border-outline-variant/10">
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
                  className="grid grid-cols-12 gap-4 p-4 hover:bg-surface-high transition-colors items-center"
                >
                  <span className="col-span-3 text-sm font-label">{pool.symbol}</span>
                  <span className="col-span-2 text-[11px] text-on-surface-variant">
                    {pool.chain}
                  </span>
                  <span className="col-span-2 text-right text-sm font-label text-primary">
                    {pool.apy?.toFixed(2)}%
                  </span>
                  <span className="col-span-2 text-right text-sm font-label">
                    {pool.tvlUsd
                      ? `$${(pool.tvlUsd / 1_000_000).toFixed(2)}M`
                      : "N/A"}
                  </span>
                  <span className="col-span-1 text-center">
                    {pool.stablecoin ? (
                      <span className="text-primary text-[10px]">YES</span>
                    ) : (
                      <span className="text-on-surface-variant text-[10px]">NO</span>
                    )}
                  </span>
                  <span className="col-span-2 text-right">
                    <a
                      href={`https://defillama.com/yields/pool/${pool.pool}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-primary hover:text-on-surface uppercase tracking-widest font-bold transition-colors"
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

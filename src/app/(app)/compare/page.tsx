"use client";

import { useState } from "react";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Legend,
} from "recharts";
import { formatCurrency, formatBudget } from "@/lib/formatters";
import type { InvestmentStrategy } from "@/types/strategy";
import { CHART_PALETTE, ChartContainer } from "@/components/ui/ChartTheme";
import Link from "next/link";

interface StrategyResult {
  label: string;
  risk: string;
  strategy: InvestmentStrategy | null;
  error?: string;
  poolsScanned: number;
  protocolsAnalyzed: number;
  protocolsDeepAnalyzed: number;
}

const budgetPresets = [5000, 10000, 50000, 100000, 500000];

export default function ComparePage() {
  const [budget, setBudget] = useState(10000);
  const [apyMin, setApyMin] = useState(1);
  const [apyMax, setApyMax] = useState(500);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const [results, setResults] = useState<StrategyResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setLoading(true);
    setError(null);
    setResults([]);
    setProgress("Generating Conservative strategy...");

    const t1 = setTimeout(() => setProgress("Running deep AI analysis on protocols..."), 15000);
    const t2 = setTimeout(() => setProgress("Generating Balanced strategy..."), 120000);
    const t3 = setTimeout(() => setProgress("Generating Aggressive strategy..."), 240000);
    const t4 = setTimeout(() => setProgress("Finalizing all three strategies..."), 360000);

    try {
      const res = await fetch("/api/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ budget, targetApyMin: apyMin, targetApyMax: apyMax }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Comparison failed");
      }

      const data = await res.json();
      setResults(data.strategies);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate strategies");
    } finally {
      setLoading(false);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    }
  };

  const validResults = results.filter((r) => r.strategy);

  // Build radar chart data
  const radarData = validResults.length > 0 ? [
    {
      metric: "Projected APY",
      ...Object.fromEntries(validResults.map((r) => [r.label, Math.min(r.strategy!.projectedApy, 100)])),
    },
    {
      metric: "Avg Safety",
      ...Object.fromEntries(validResults.map((r) => {
        const scores = r.strategy!.allocations.map((a) => a.legitimacyScore || 50);
        return [r.label, scores.length > 0 ? scores.reduce((s, v) => s + v, 0) / scores.length : 50];
      })),
    },
    {
      metric: "Diversification",
      ...Object.fromEntries(validResults.map((r) => {
        const chains = new Set(r.strategy!.allocations.map((a) => a.chain));
        return [r.label, chains.size * 15]; // Scale up
      })),
    },
    {
      metric: "Stablecoin %",
      ...Object.fromEntries(validResults.map((r) => {
        const stable = r.strategy!.allocations.filter((a) => a.stablecoin).length;
        return [r.label, (stable / Math.max(r.strategy!.allocations.length, 1)) * 100];
      })),
    },
    {
      metric: "Allocations",
      ...Object.fromEntries(validResults.map((r) => [r.label, r.strategy!.allocations.length * 7])),
    },
  ] : [];

  return (
    <div className="px-6 lg:px-10 py-12">
      {/* Hero */}
      <section className="mb-10">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-2 h-2 bg-[#00D4AA]" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#45515d]/70">
            Multi-Strategy Analysis
          </span>
        </div>
        <h2 className="text-5xl font-black tracking-[-0.05em] leading-none mb-4 text-[#203241]">
          Strategy <br />
          <span className="italic text-[#00D4AA]">Comparison.</span>
        </h2>
        <p className="text-[#6b7781] max-w-xl text-sm leading-relaxed">
          Generate three strategies simultaneously — Conservative, Balanced, and Aggressive —
          and compare them side by side with radar charts and metrics.
        </p>
      </section>

      {/* Form */}
      {results.length === 0 && !loading && (
        <div className="max-w-xl space-y-8">
          <div className="bg-[#f2f3f5] border border-[#d7dade] p-8 space-y-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-2 h-2 bg-[#00D4AA]" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#45515d]/70">Configuration</span>
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#45515d]/70 block mb-2">
                Budget
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#6b7781]">$</span>
                <input
                  type="text"
                  value={budget.toLocaleString("en-US")}
                  onChange={(e) => setBudget(parseInt(e.target.value.replace(/[^0-9]/g, "")) || 0)}
                  className="w-full bg-white border border-[#d7dade] text-sm font-black px-4 py-3 pl-8 focus:border-[#00D4AA] outline-none transition-colors text-[#203241]"
                />
              </div>
              <div className="flex gap-2 mt-3 flex-wrap">
                {budgetPresets.map((p) => (
                  <button key={p} onClick={() => setBudget(p)}
                    className={`px-4 py-2 text-[11px] font-semibold transition-all duration-300 ${budget === p ? "bg-[#00D4AA] text-white" : "bg-[#ebedf0] text-[#43515d] hover:text-[#203241]"}`}>
                    ${p.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-[#ff4d4d]/5 border border-[#ff4d4d]/20 p-4">
              <p className="text-[#ff4d4d] text-sm">{error}</p>
            </div>
          )}

          <button
            onClick={generate}
            disabled={budget <= 0}
            className="group w-full bg-[#ff6c12] text-white px-8 py-4 text-[11px] uppercase font-semibold tracking-[0.15em] hover:bg-[#e86210] transition-all duration-300 flex items-center justify-center gap-3"
          >
            <span className="material-symbols-outlined text-sm">compare</span>
            Generate 3 Strategies
            <span className="inline-block transition-transform duration-300 group-hover:translate-x-1">&rarr;</span>
          </button>
          <p className="text-[11px] text-[#6b7781] text-center">
            This generates Conservative, Balanced, and Aggressive strategies with full deep analysis. May take 10-30 minutes.
          </p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="bg-[#f2f3f5] border border-[#d7dade] p-16 text-center">
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="w-2 h-2 bg-[#00D4AA] animate-pulse" />
            <div className="w-2 h-2 bg-[#00D4AA] animate-pulse" style={{ animationDelay: "200ms" }} />
            <div className="w-2 h-2 bg-[#00D4AA] animate-pulse" style={{ animationDelay: "400ms" }} />
          </div>
          <span className="material-symbols-outlined text-5xl text-[#00D4AA] mb-4 block">compare</span>
          <h3 className="text-2xl font-black tracking-[-0.05em] text-[#203241] mb-2">Generating 3 Strategies</h3>
          <p className="text-[#6b7781] text-sm">{progress}</p>
        </div>
      )}

      {/* Results */}
      {validResults.length > 0 && (
        <div className="space-y-10 animate-fade-in">
          {/* Radar Chart */}
          {radarData.length > 0 && (
            <ChartContainer title="Strategy Comparison" subtitle="Radar chart comparing key metrics across all strategies">
              <ResponsiveContainer width="100%" height={400}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#d7dade" />
                  <PolarAngleAxis dataKey="metric" tick={{ fill: "#6b7781", fontSize: 10, fontFamily: "Inter" }} />
                  <PolarRadiusAxis tick={{ fill: "#6b7781", fontSize: 9 }} />
                  {validResults.map((r, i) => (
                    <Radar
                      key={r.label}
                      name={r.label}
                      dataKey={r.label}
                      stroke={CHART_PALETTE[i]}
                      fill={CHART_PALETTE[i]}
                      fillOpacity={0.15}
                      strokeWidth={2}
                    />
                  ))}
                  <Legend wrapperStyle={{ fontSize: 11, fontFamily: "Inter" }} />
                </RadarChart>
              </ResponsiveContainer>
            </ChartContainer>
          )}

          {/* Comparison Table */}
          <div className="bg-[#f2f3f5] border border-[#d7dade] p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-2 h-2 bg-[#00D4AA]" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#45515d]/70">
                Key Metrics
              </span>
            </div>
            <div className="bg-white border border-[#d7dade]">
              <div className={`grid gap-4 text-[11px] uppercase tracking-[0.15em] text-[#6b7781] font-semibold p-4 bg-[#f2f3f5]`} style={{ gridTemplateColumns: `200px repeat(${validResults.length}, 1fr)` }}>
                <span>Metric</span>
                {validResults.map((r) => <span key={r.label} className="text-right">{r.label}</span>)}
              </div>
              {[
                { label: "Projected APY", values: validResults.map((r) => `${r.strategy!.projectedApy.toFixed(2)}%`) },
                { label: "Yearly Return", values: validResults.map((r) => formatCurrency(r.strategy!.projectedYearlyReturn)) },
                { label: "Allocations", values: validResults.map((r) => `${r.strategy!.allocations.length} pools`) },
                { label: "Pools Scanned", values: validResults.map((r) => r.poolsScanned.toLocaleString()) },
                { label: "Deep Analyzed", values: validResults.map((r) => `${r.protocolsDeepAnalyzed} protocols`) },
                {
                  label: "Avg Safety Score",
                  values: validResults.map((r) => {
                    const scores = r.strategy!.allocations.map((a) => a.legitimacyScore || 0);
                    return scores.length > 0 ? `${(scores.reduce((s, v) => s + v, 0) / scores.length).toFixed(0)}/100` : "N/A";
                  }),
                },
                {
                  label: "Unique Chains",
                  values: validResults.map((r) => `${new Set(r.strategy!.allocations.map((a) => a.chain)).size}`),
                },
                {
                  label: "Stablecoin %",
                  values: validResults.map((r) => {
                    const pct = r.strategy!.allocations.filter((a) => a.stablecoin).length / Math.max(r.strategy!.allocations.length, 1) * 100;
                    return `${pct.toFixed(0)}%`;
                  }),
                },
              ].map((row) => (
                <div key={row.label} className="bg-white hover:bg-[#f2f3f5] transition-all duration-300 p-4 border-t border-[#e2e3e7]" style={{ display: "grid", gridTemplateColumns: `200px repeat(${validResults.length}, 1fr)`, gap: "1rem" }}>
                  <span className="text-[#203241] text-[13px] font-medium">{row.label}</span>
                  {row.values.map((v, i) => (
                    <span key={i} className="text-right text-[13px] text-[#00D4AA] font-bold">{v}</span>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Individual Strategy Summaries */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {validResults.map((r, i) => (
              <div key={r.label} className="bg-white border border-[#d7dade] hover:border-[#00D4AA]/40 p-8 transition-all duration-300">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-2 h-2" style={{ backgroundColor: CHART_PALETTE[i] }} />
                  <span className="text-[11px] font-semibold uppercase tracking-[0.28em]" style={{ color: CHART_PALETTE[i] }}>
                    {r.label}
                  </span>
                </div>
                <span className="text-[42px] font-black text-[#00D4AA] block mb-1">
                  {r.strategy!.projectedApy.toFixed(2)}%
                </span>
                <span className="text-[#6b7781] text-[11px] block mb-6">
                  {formatCurrency(r.strategy!.projectedYearlyReturn)} / year
                </span>
                <p className="text-[#6b7781] text-[11px] leading-relaxed line-clamp-4 mb-6">
                  {r.strategy!.summary.slice(0, 200)}...
                </p>
                <div className="space-y-2">
                  {r.strategy!.allocations.slice(0, 5).map((a, ai) => (
                    <div key={ai} className="flex justify-between text-[11px]">
                      <span className="text-[#6b7781]">{a.protocol} ({a.symbol})</span>
                      <span className="text-[#00D4AA] font-bold">{a.allocationPercent}%</span>
                    </div>
                  ))}
                  {r.strategy!.allocations.length > 5 && (
                    <span className="text-[#6b7781] text-[11px]">+{r.strategy!.allocations.length - 5} more</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Back */}
          <button
            onClick={() => setResults([])}
            className="group bg-[#ff6c12] text-white px-8 py-4 text-[11px] uppercase font-semibold tracking-[0.15em] hover:bg-[#e86210] transition-all duration-300 flex items-center gap-3"
          >
            <span className="material-symbols-outlined text-sm">refresh</span>
            New Comparison
            <span className="inline-block transition-transform duration-300 group-hover:translate-x-1">&rarr;</span>
          </button>
        </div>
      )}
    </div>
  );
}

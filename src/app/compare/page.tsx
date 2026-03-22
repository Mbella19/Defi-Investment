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
    <div className="p-8">
      {/* Hero */}
      <section className="mb-8">
        <span className="font-label uppercase tracking-[0.3em] text-[10px] text-secondary-dim font-bold mb-4 block">
          Multi-Strategy Analysis
        </span>
        <h2 className="font-headline text-5xl md:text-7xl font-light leading-none mb-4 tracking-tighter text-on-surface">
          Strategy <br />
          <span className="italic text-primary">Comparison.</span>
        </h2>
        <p className="font-body text-on-surface-variant max-w-xl text-sm leading-relaxed">
          Generate three strategies simultaneously — Conservative, Balanced, and Aggressive —
          and compare them side by side with radar charts and metrics.
        </p>
      </section>

      {/* Form */}
      {results.length === 0 && !loading && (
        <div className="max-w-xl space-y-6">
          <div className="bg-surface-lowest border-l-4 border-primary p-6 space-y-4">
            <div>
              <label className="text-[9px] uppercase tracking-widest text-on-surface-variant font-bold block mb-2">
                Budget
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant">$</span>
                <input
                  type="text"
                  value={budget.toLocaleString("en-US")}
                  onChange={(e) => setBudget(parseInt(e.target.value.replace(/[^0-9]/g, "")) || 0)}
                  className="w-full bg-surface-low border-b border-outline-variant/30 text-xl font-headline pl-8 pr-4 py-3 focus:border-primary transition-colors outline-none text-on-surface"
                />
              </div>
              <div className="flex gap-2 mt-2 flex-wrap">
                {budgetPresets.map((p) => (
                  <button key={p} onClick={() => setBudget(p)}
                    className={`px-3 py-1.5 text-[10px] font-bold transition-all ${budget === p ? "bg-primary text-on-primary" : "bg-surface-highest text-on-surface-variant"}`}>
                    ${p.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-error-container/20 border-l-2 border-error p-4">
              <p className="text-error text-sm">{error}</p>
            </div>
          )}

          <button
            onClick={generate}
            disabled={budget <= 0}
            className="w-full py-4 text-sm uppercase font-bold tracking-widest bg-primary text-on-primary hover:bg-primary-dim transition-all flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-sm">compare</span>
            Generate 3 Strategies
          </button>
          <p className="text-[10px] text-on-surface-variant text-center">
            This generates Conservative, Balanced, and Aggressive strategies with full deep analysis. May take 10-30 minutes.
          </p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="bg-surface-lowest border-l-4 border-primary p-12 text-center">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="w-2 h-2 bg-primary animate-pulse" />
            <div className="w-2 h-2 bg-primary animate-pulse" style={{ animationDelay: "200ms" }} />
            <div className="w-2 h-2 bg-primary animate-pulse" style={{ animationDelay: "400ms" }} />
          </div>
          <span className="material-symbols-outlined text-5xl text-primary mb-4 block">compare</span>
          <h3 className="font-headline text-2xl text-on-surface mb-2">Generating 3 Strategies</h3>
          <p className="text-on-surface-variant text-sm">{progress}</p>
        </div>
      )}

      {/* Results */}
      {validResults.length > 0 && (
        <div className="space-y-8 animate-fade-in">
          {/* Radar Chart */}
          {radarData.length > 0 && (
            <ChartContainer title="Strategy Comparison" subtitle="Radar chart comparing key metrics across all strategies">
              <ResponsiveContainer width="100%" height={400}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#484848" />
                  <PolarAngleAxis dataKey="metric" tick={{ fill: "#acabaa", fontSize: 10, fontFamily: "Inter" }} />
                  <PolarRadiusAxis tick={{ fill: "#767575", fontSize: 9 }} />
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
          <div className="bg-surface-lowest border-l-4 border-primary p-6">
            <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-on-surface-variant mb-4 block">
              Key Metrics
            </span>
            <div className="space-y-[1px]">
              <div className={`grid gap-4 text-[9px] uppercase tracking-widest text-on-surface-variant font-bold bg-surface-high p-3`} style={{ gridTemplateColumns: `200px repeat(${validResults.length}, 1fr)` }}>
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
                <div key={row.label} className="bg-surface-low hover:bg-surface-high transition-all p-3" style={{ display: "grid", gridTemplateColumns: `200px repeat(${validResults.length}, 1fr)`, gap: "1rem" }}>
                  <span className="text-on-surface text-[11px] font-label">{row.label}</span>
                  {row.values.map((v, i) => (
                    <span key={i} className="text-right text-[11px] text-primary font-bold">{v}</span>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Individual Strategy Summaries */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {validResults.map((r, i) => (
              <div key={r.label} className="bg-surface-low border-l-4 p-6" style={{ borderColor: CHART_PALETTE[i] }}>
                <span className="text-[10px] uppercase tracking-[0.3em] font-bold block mb-2" style={{ color: CHART_PALETTE[i] }}>
                  {r.label}
                </span>
                <span className="font-headline text-3xl text-on-surface block mb-1">
                  {r.strategy!.projectedApy.toFixed(2)}%
                </span>
                <span className="text-on-surface-variant text-[11px] block mb-4">
                  {formatCurrency(r.strategy!.projectedYearlyReturn)} / year
                </span>
                <p className="text-on-surface-variant text-[11px] leading-relaxed line-clamp-4">
                  {r.strategy!.summary.slice(0, 200)}...
                </p>
                <div className="mt-4 space-y-1">
                  {r.strategy!.allocations.slice(0, 5).map((a, ai) => (
                    <div key={ai} className="flex justify-between text-[10px]">
                      <span className="text-on-surface-variant">{a.protocol} ({a.symbol})</span>
                      <span className="text-primary font-bold">{a.allocationPercent}%</span>
                    </div>
                  ))}
                  {r.strategy!.allocations.length > 5 && (
                    <span className="text-on-surface-variant text-[9px]">+{r.strategy!.allocations.length - 5} more</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Back */}
          <button
            onClick={() => setResults([])}
            className="bg-primary text-on-primary px-8 py-3 text-[10px] uppercase font-bold tracking-widest hover:bg-primary-dim transition-all flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-sm">refresh</span>
            New Comparison
          </button>
        </div>
      )}
    </div>
  );
}

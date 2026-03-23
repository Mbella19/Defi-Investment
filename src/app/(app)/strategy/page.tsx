"use client";

import { useState } from "react";
import type { StrategyCriteria, InvestmentStrategy } from "@/types/strategy";
import { formatBudget, formatCurrency } from "@/lib/formatters";
import { saveStrategy } from "@/lib/storage";
import { generateStrategyPDF } from "@/lib/pdf-generator";
import { useActiveStrategies } from "@/hooks/useActiveStrategies";
import Link from "next/link";

const riskOptions = [
  { value: "low" as const, label: "Conservative", desc: "Established protocols, high TVL, stablecoins preferred" },
  { value: "medium" as const, label: "Balanced", desc: "Mix of established and emerging protocols" },
  { value: "high" as const, label: "Aggressive", desc: "Higher yields, newer protocols, more risk" },
];

const apyPresets = [
  { label: "Safe (2-8%)", min: 2, max: 8 },
  { label: "Moderate (5-15%)", min: 5, max: 15 },
  { label: "Growth (10-30%)", min: 10, max: 30 },
  { label: "Aggressive (20-100%)", min: 20, max: 100 },
  { label: "Full Range (1-500%)", min: 1, max: 500 },
];

const budgetPresets = [1000, 5000, 10000, 50000, 100000, 500000];

export default function StrategyPage() {
  const [budget, setBudget] = useState(10000);
  const [risk, setRisk] = useState<"low" | "medium" | "high">("low");
  const [apyMin, setApyMin] = useState(2);
  const [apyMax, setApyMax] = useState(15);
  const [assetType, setAssetType] = useState<"stablecoins" | "all">("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    strategy: InvestmentStrategy;
    poolsScanned: number;
    protocolsAnalyzed: number;
    protocolsDeepAnalyzed: number;
  } | null>(null);
  const [progress, setProgress] = useState("");
  const [activating, setActivating] = useState(false);
  const [activated, setActivated] = useState(false);
  const { activateStrategy } = useActiveStrategies();

  const generate = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setProgress("Scanning all yield pools on DeFiLlama...");

    const timer = setTimeout(() => setProgress("Filtering protocols by your criteria..."), 5000);
    const timer2 = setTimeout(() => setProgress("Running deep AI security analysis on each protocol..."), 12000);
    const timer3 = setTimeout(() => setProgress("Analyzing audit history, team reputation, TVL stability, smart contract risks..."), 30000);
    const timer4 = setTimeout(() => setProgress("Deep research in progress — analyzing protocol legitimacy..."), 60000);
    const timer5 = setTimeout(() => setProgress("Building your strategy with safety-weighted allocations..."), 120000);
    const timer6 = setTimeout(() => setProgress("Almost there — finalizing portfolio and instructions..."), 180000);

    try {
      const res = await fetch("/api/strategy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          budget,
          riskAppetite: risk,
          targetApyMin: apyMin,
          targetApyMax: apyMax,
          assetType,
        } as StrategyCriteria),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Strategy generation failed");
      }

      const data = await res.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate strategy");
    } finally {
      setLoading(false);
      clearTimeout(timer);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);
      clearTimeout(timer5);
      clearTimeout(timer6);
    }
  };

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-8 sm:py-12">
      {/* Hero */}
      <section className="mb-12 sm:mb-16 grid grid-cols-12 gap-6 sm:gap-8 items-end pt-4">
        <div className="col-span-12 lg:col-span-8">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-2 h-2 bg-accent" />
            <span className="text-[13px] font-semibold uppercase tracking-[0.2em] text-label/70">
              AI Investment Strategist
            </span>
          </div>
          <h2 className="text-5xl md:text-7xl font-black leading-none mb-6 tracking-[-0.05em] text-on-surface">
            Auto <br />
            <span className="italic text-accent">Strategist.</span>
          </h2>
          <p className="text-muted max-w-xl text-sm leading-relaxed">
            Tell the AI your budget, risk appetite, and target APY. It will scan every protocol
            on DeFiLlama, deep-research the results, and create a complete investment strategy
            with exact allocations and step-by-step instructions.
          </p>
        </div>
        <div className="col-span-12 lg:col-span-4 flex flex-col items-start lg:items-end gap-2">
          <div className="flex gap-8 sm:gap-12">
            <div className="text-right">
              <span className="text-4xl font-black tracking-[-0.05em] text-accent">Claude</span>
              <span className="block text-[13px] font-semibold uppercase tracking-[0.2em] text-label/70 mt-1">
                Engine
              </span>
            </div>
            <div className="text-right">
              <span className="text-4xl font-black tracking-[-0.05em] text-accent">Live</span>
              <span className="block text-[13px] font-semibold uppercase tracking-[0.2em] text-label/70 mt-1">
                Data Feed
              </span>
            </div>
          </div>
        </div>
      </section>

      {!result && (
        <div className="grid grid-cols-12 gap-6 sm:gap-10">
          {/* Form */}
          <div className="col-span-12 lg:col-span-8 space-y-10 sm:space-y-12">
            {/* Budget */}
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-accent" />
                <span className="text-[13px] font-semibold uppercase tracking-[0.2em] text-label/70">
                  Investment Budget
                </span>
              </div>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted text-lg font-light">$</span>
                <input
                  type="text"
                  value={budget.toLocaleString("en-US")}
                  onChange={(e) => {
                    const num = parseInt(e.target.value.replace(/[^0-9]/g, "")) || 0;
                    setBudget(Math.min(num, 10000000));
                  }}
                  className="w-full bg-surface-highest border border-outline text-2xl font-black tracking-[-0.05em] pl-10 pr-4 py-4 focus:border-accent transition-all duration-300 outline-none text-on-surface"
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                {budgetPresets.map((p) => (
                  <button
                    key={p}
                    onClick={() => setBudget(p)}
                    className={`px-4 py-2 text-[13px] font-semibold tracking-[0.1em] transition-all duration-300 ${
                      budget === p
                        ? "bg-accent text-white"
                        : "bg-surface-container text-on-surface-variant hover:text-on-surface"
                    }`}
                  >
                    ${p.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>

            {/* Risk */}
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-accent" />
                <span className="text-[13px] font-semibold uppercase tracking-[0.2em] text-label/70">
                  Risk Appetite
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {riskOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setRisk(opt.value)}
                    className={`p-6 text-left transition-all duration-300 border ${
                      risk === opt.value
                        ? "bg-accent/5 border-accent"
                        : "bg-surface-highest border-outline hover:border-accent"
                    }`}
                  >
                    <span className={`text-[13px] uppercase tracking-[0.12em] font-semibold block mb-2 ${
                      risk === opt.value ? "text-accent" : "text-muted"
                    }`}>
                      {opt.label}
                    </span>
                    <span className="text-sm text-muted leading-relaxed block">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* APY Range */}
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-accent" />
                <span className="text-[13px] font-semibold uppercase tracking-[0.2em] text-label/70">
                  Target APY Range
                </span>
              </div>
              <div className="flex gap-4 items-center">
                <div className="flex-1">
                  <span className="text-[13px] font-semibold uppercase tracking-[0.2em] text-label/70 block mb-2">Min APY</span>
                  <input
                    type="number"
                    value={apyMin}
                    onChange={(e) => setApyMin(Number(e.target.value))}
                    className="w-full bg-surface-highest border border-outline text-sm px-4 py-3 focus:border-accent transition-all duration-300 outline-none text-on-surface"
                  />
                </div>
                <span className="text-muted mt-6">to</span>
                <div className="flex-1">
                  <span className="text-[13px] font-semibold uppercase tracking-[0.2em] text-label/70 block mb-2">Max APY</span>
                  <input
                    type="number"
                    value={apyMax}
                    onChange={(e) => setApyMax(Number(e.target.value))}
                    className="w-full bg-surface-highest border border-outline text-sm px-4 py-3 focus:border-accent transition-all duration-300 outline-none text-on-surface"
                  />
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                {apyPresets.map((p) => (
                  <button
                    key={p.label}
                    onClick={() => { setApyMin(p.min); setApyMax(p.max); }}
                    className={`px-4 py-2 text-[13px] font-semibold tracking-[0.1em] transition-all duration-300 ${
                      apyMin === p.min && apyMax === p.max
                        ? "bg-accent text-white"
                        : "bg-surface-container text-on-surface-variant hover:text-on-surface"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Asset Type */}
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-accent" />
                <span className="text-[13px] font-semibold uppercase tracking-[0.2em] text-label/70">
                  Asset Type
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setAssetType("stablecoins")}
                  className={`p-6 text-left transition-all duration-300 border ${
                    assetType === "stablecoins"
                      ? "bg-accent/5 border-accent"
                      : "bg-surface-highest border-outline hover:border-accent"
                  }`}
                >
                  <span className="material-symbols-outlined text-sm block mb-2">toll</span>
                  <span className={`text-[13px] uppercase tracking-[0.12em] font-semibold block mb-1 ${
                    assetType === "stablecoins" ? "text-accent" : "text-muted"
                  }`}>
                    Stablecoins Only
                  </span>
                  <span className="text-sm text-muted leading-relaxed block">
                    USDC, USDT, DAI — lower risk, stable value
                  </span>
                </button>
                <button
                  onClick={() => setAssetType("all")}
                  className={`p-6 text-left transition-all duration-300 border ${
                    assetType === "all"
                      ? "bg-accent/5 border-accent"
                      : "bg-surface-highest border-outline hover:border-accent"
                  }`}
                >
                  <span className="material-symbols-outlined text-sm block mb-2">token</span>
                  <span className={`text-[13px] uppercase tracking-[0.12em] font-semibold block mb-1 ${
                    assetType === "all" ? "text-accent" : "text-muted"
                  }`}>
                    All Assets
                  </span>
                  <span className="text-sm text-muted leading-relaxed block">
                    ETH, BTC, altcoins + stablecoins — higher potential
                  </span>
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="bg-danger/10 border border-danger/20 p-6">
                <p className="text-danger text-sm">{error}</p>
              </div>
            )}

            {/* Submit */}
            <button
              onClick={generate}
              disabled={loading || budget <= 0}
              className={`group w-full px-8 py-4 text-sm uppercase font-semibold tracking-[0.08em] flex items-center justify-center gap-3 transition-all duration-300 ${
                loading
                  ? "bg-surface-container text-muted"
                  : "bg-cta text-white hover:-translate-y-1"
              }`}
            >
              {loading ? (
                <>
                  <div className="w-2 h-2 bg-accent animate-pulse" />
                  {progress}
                </>
              ) : (
                <>
                  Generate AI Strategy
                  <span className="inline-block transition-transform duration-300 group-hover:translate-x-1">&rarr;</span>
                </>
              )}
            </button>
          </div>

          {/* Sidebar */}
          <div className="col-span-12 lg:col-span-4">
            <div className="bg-surface-low border border-outline p-8 sticky top-20">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-2 h-2 bg-accent" />
                <span className="text-[13px] font-semibold uppercase tracking-[0.2em] text-label/70">
                  How It Works
                </span>
              </div>
              <div className="space-y-8">
                {[
                  { step: "01", text: "Scans every yield pool on DeFiLlama matching your APY range" },
                  { step: "02", text: "Runs deep AI security analysis on each protocol — audits, team, TVL, smart contracts, red flags" },
                  { step: "03", text: "Uses legitimacy scores to build a safety-weighted portfolio with exact allocations" },
                  { step: "04", text: "Provides step-by-step instructions on how to make each investment" },
                ].map((s) => (
                  <div key={s.step} className="flex gap-4">
                    <span className="text-xl font-black text-accent/30">{s.step}</span>
                    <p className="text-sm text-muted leading-relaxed">{s.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="mt-10 bg-surface-low border border-outline p-16 text-center">
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="w-2 h-2 bg-accent animate-pulse" />
            <div className="w-2 h-2 bg-accent animate-pulse" style={{ animationDelay: "200ms" }} />
            <div className="w-2 h-2 bg-accent animate-pulse" style={{ animationDelay: "400ms" }} />
          </div>
          <h3 className="text-3xl font-black tracking-[-0.05em] text-on-surface mb-3">Building Your Strategy</h3>
          <p className="text-muted text-sm max-w-md mx-auto leading-relaxed">{progress}</p>
        </div>
      )}

      {/* Strategy Results */}
      {result && (
        <div className="space-y-10 animate-fade-in">
          {/* Stats Bar */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-surface-low border border-outline p-8">
              <span className="text-2xl sm:text-[42px] font-black text-on-surface tracking-[-0.06em]">{result.poolsScanned.toLocaleString()}</span>
              <span className="block text-[13px] font-semibold uppercase tracking-[0.2em] text-label/70 mt-2">
                Pools Scanned
              </span>
            </div>
            <div className="bg-surface-low border border-outline p-8">
              <span className="text-2xl sm:text-[42px] font-black text-on-surface tracking-[-0.06em]">{result.protocolsAnalyzed}</span>
              <span className="block text-[13px] font-semibold uppercase tracking-[0.2em] text-label/70 mt-2">
                Protocols Found
              </span>
            </div>
            <div className="bg-surface-low border border-outline p-8">
              <span className="text-2xl sm:text-[42px] font-black text-accent tracking-[-0.06em]">{result.protocolsDeepAnalyzed}</span>
              <span className="block text-[13px] font-semibold uppercase tracking-[0.2em] text-label/70 mt-2">
                Deep Analyzed
              </span>
            </div>
            <div className="bg-surface-low border border-outline p-8">
              <span className="text-2xl sm:text-[42px] font-black text-accent tracking-[-0.06em]">{result.strategy.projectedApy.toFixed(2)}%</span>
              <span className="block text-[13px] font-semibold uppercase tracking-[0.2em] text-label/70 mt-2">
                Projected APY
              </span>
            </div>
            <div className="bg-surface-low border border-outline p-8">
              <span className="text-2xl sm:text-[42px] font-black text-accent tracking-[-0.06em]">{formatCurrency(result.strategy.projectedYearlyReturn)}</span>
              <span className="block text-[13px] font-semibold uppercase tracking-[0.2em] text-label/70 mt-2">
                Yearly Return
              </span>
            </div>
          </div>

          {/* Summary */}
          <div className="bg-surface-low border border-outline p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-2 h-2 bg-accent" />
              <span className="text-[13px] font-semibold uppercase tracking-[0.2em] text-label/70">
                Strategy Overview
              </span>
            </div>
            <p className="text-on-surface-variant text-sm leading-relaxed whitespace-pre-line">{result.strategy.summary}</p>
          </div>

          {/* Allocations */}
          <div>
            <div className="flex items-center gap-3 mb-8">
              <div className="w-2 h-2 bg-accent" />
              <span className="text-[13px] font-semibold uppercase tracking-[0.2em] text-label/70">
                Portfolio Allocations
              </span>
            </div>
            <div className="space-y-3">
              {result.strategy.allocations.map((alloc, i) => {
                const verdictColor =
                  alloc.verdict === "high_confidence" ? "text-accent bg-accent/10"
                  : alloc.verdict === "moderate_confidence" ? "text-[#7a8200] bg-lime/20"
                  : alloc.verdict === "low_confidence" ? "text-cta bg-cta/10"
                  : "text-danger bg-danger/10";
                const verdictLabel =
                  alloc.verdict === "high_confidence" ? "HIGH CONFIDENCE"
                  : alloc.verdict === "moderate_confidence" ? "MODERATE"
                  : alloc.verdict === "low_confidence" ? "LOW CONFIDENCE"
                  : "CAUTION";
                const scoreColor =
                  alloc.legitimacyScore >= 70 ? "text-accent"
                  : alloc.legitimacyScore >= 50 ? "text-[#7a8200]"
                  : "text-danger";

                return (
                  <div key={i} className="bg-surface-highest border border-outline hover:border-accent transition-all duration-300 p-4 sm:p-6">
                    <div className="flex flex-col gap-4">
                      {/* Protocol name */}
                      <div className="flex items-center gap-3">
                        <span className="text-2xl font-black text-accent/30">{String(i + 1).padStart(2, "0")}</span>
                        <div>
                          <h4 className="font-black text-lg tracking-[-0.05em] text-on-surface">{alloc.protocol}</h4>
                          <p className="text-xs text-muted">{alloc.symbol} &middot; {alloc.chain}</p>
                        </div>
                      </div>
                      {/* Stats row */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="text-center sm:text-left">
                          <span className="text-[13px] font-semibold uppercase tracking-[0.2em] text-label/70 block mb-1">Safety</span>
                          <span className={`font-black text-xl ${scoreColor}`}>{alloc.legitimacyScore}</span>
                        </div>
                        <div className="text-center sm:text-left">
                          <span className="text-[13px] font-semibold uppercase tracking-[0.2em] text-label/70 block mb-1">Verdict</span>
                          <span className={`text-xs font-semibold uppercase tracking-[0.1em] px-3 py-1 inline-block ${verdictColor}`}>
                            {verdictLabel}
                          </span>
                        </div>
                        <div className="text-center sm:text-left">
                          <span className="text-[13px] font-semibold uppercase tracking-[0.2em] text-label/70 block mb-1">APY</span>
                          <span className="font-black text-xl text-accent">{alloc.apy.toFixed(2)}%</span>
                        </div>
                        <div className="text-center sm:text-left">
                          <span className="text-[13px] font-semibold uppercase tracking-[0.2em] text-label/70 block mb-1">Allocate</span>
                          <span className="font-black text-xl text-on-surface">{formatBudget(alloc.allocationAmount)}</span>
                          <span className="text-xs text-muted block">({alloc.allocationPercent}%)</span>
                        </div>
                      </div>
                      {/* Actions */}
                      <div className="flex gap-2 justify-end">
                        <Link
                          href={`/protocol/${alloc.protocol}`}
                          className="w-10 h-10 border border-outline flex items-center justify-center hover:border-accent hover:text-accent transition-all duration-300 text-muted"
                          title="AI Research"
                        >
                          <span className="material-symbols-outlined text-sm">psychology</span>
                        </Link>
                        <a
                          href={`https://defillama.com/yields/pool/${alloc.poolId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group flex-1 md:flex-none h-10 px-6 bg-cta text-white flex items-center justify-center gap-2 text-xs uppercase font-semibold tracking-[0.12em] hover:-translate-y-0.5 transition-all duration-300"
                        >
                          Invest
                          <span className="inline-block transition-transform duration-300 group-hover:translate-x-0.5">&rarr;</span>
                        </a>
                      </div>
                    </div>
                    <div className="mt-4">
                      <p className="text-sm text-on-surface-variant leading-relaxed">{alloc.reasoning}</p>
                    </div>
                    {alloc.redFlags && alloc.redFlags.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {alloc.redFlags.map((flag, fi) => (
                          <span key={fi} className="text-xs text-danger bg-danger/10 border border-danger/20 px-3 py-1">
                            {flag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Risk Assessment */}
          <div className="bg-surface-low border border-outline p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-2 h-2 bg-cta" />
              <span className="text-[13px] font-semibold uppercase tracking-[0.2em] text-cta">
                Risk Assessment
              </span>
            </div>
            <p className="text-on-surface-variant text-[13px] leading-relaxed">{result.strategy.riskAssessment}</p>
          </div>

          {/* Diversification */}
          <div className="bg-surface-low border border-outline p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-2 h-2 bg-accent" />
              <span className="text-[13px] font-semibold uppercase tracking-[0.2em] text-accent">
                Diversification
              </span>
            </div>
            <p className="text-on-surface-variant text-[13px] leading-relaxed">{result.strategy.diversificationNotes}</p>
          </div>

          {/* Steps */}
          <div className="bg-surface-low border border-outline p-8">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-2 h-2 bg-accent" />
              <span className="text-[13px] font-semibold uppercase tracking-[0.2em] text-label/70">
                Step-by-Step Instructions
              </span>
            </div>
            <div className="space-y-5">
              {result.strategy.steps.map((step, i) => (
                <div key={i} className="flex gap-4 items-start">
                  <span className="w-8 h-8 bg-accent text-white flex items-center justify-center text-xs font-semibold shrink-0">
                    {i + 1}
                  </span>
                  <p className="text-on-surface-variant text-[13px] leading-relaxed pt-1.5">{step}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Warnings */}
          {result.strategy.warnings.length > 0 && (
            <div className="bg-cta/10 border border-cta/20 p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-2 h-2 bg-cta" />
                <span className="text-[13px] font-semibold uppercase tracking-[0.2em] text-cta">
                  Warnings
                </span>
              </div>
              <ul className="space-y-3">
                {result.strategy.warnings.map((w, i) => (
                  <li key={i} className="text-[13px] text-on-surface-variant flex items-start gap-3">
                    <span className="text-cta mt-0.5">&#9888;</span>
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Actions + Disclaimer */}
          <div className="flex flex-col gap-4">
            <div className="bg-surface-low border border-outline p-6">
              <p className="text-[13px] text-muted text-center leading-relaxed">
                This strategy is AI-generated and for informational purposes only. Not financial advice.
                Always do your own research. Generated at {new Date(result.strategy.generatedAt).toLocaleString()}.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => {
                  saveStrategy({ ...result.strategy, criteria: { budget, riskAppetite: risk } });
                  alert("Strategy saved! You can load it in Risk Lab or Portfolio Monitor.");
                }}
                className="border border-btn text-btn px-6 py-4 text-sm uppercase font-semibold tracking-[0.08em] hover:bg-btn hover:text-white transition-all duration-300 flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-sm">save</span>
                Save
              </button>
              <button
                onClick={async () => {
                  setActivating(true);
                  try {
                    await activateStrategy(
                      result.strategy,
                      { budget, riskAppetite: risk, targetApyMin: apyMin, targetApyMax: apyMax, assetType },
                    );
                    setActivated(true);
                  } catch {
                    alert("Failed to activate strategy. Please try again.");
                  } finally {
                    setActivating(false);
                  }
                }}
                disabled={activating || activated}
                className={`px-6 py-4 text-sm uppercase font-semibold tracking-[0.08em] transition-all duration-300 flex items-center justify-center gap-2 ${
                  activated
                    ? "bg-accent/20 text-accent border border-accent/30"
                    : "bg-accent text-white hover:-translate-y-0.5"
                }`}
              >
                <span className="material-symbols-outlined text-sm">
                  {activated ? "check_circle" : "monitoring"}
                </span>
                {activating ? "Activating..." : activated ? "Monitoring Active" : "Activate & Monitor"}
              </button>
              <button
                onClick={() => generateStrategyPDF(result.strategy, { budget, riskAppetite: risk })}
                className="border border-btn text-btn px-6 py-4 text-sm uppercase font-semibold tracking-[0.08em] hover:bg-btn hover:text-white transition-all duration-300 flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-sm">picture_as_pdf</span>
                Export PDF
              </button>
              <button
                onClick={() => setResult(null)}
                className="group bg-cta text-white px-8 py-4 text-sm uppercase font-semibold tracking-[0.08em] hover:-translate-y-1 transition-all duration-300 flex items-center justify-center gap-2"
              >
                New Strategy
                <span className="inline-block transition-transform duration-300 group-hover:translate-x-1">&rarr;</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

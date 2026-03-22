"use client";

import { useState } from "react";
import type { StrategyCriteria, InvestmentStrategy } from "@/types/strategy";
import { formatBudget, formatCurrency } from "@/lib/formatters";
import { saveStrategy } from "@/lib/storage";
import { generateStrategyPDF } from "@/lib/pdf-generator";
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    strategy: InvestmentStrategy;
    poolsScanned: number;
    protocolsAnalyzed: number;
    protocolsDeepAnalyzed: number;
  } | null>(null);
  const [progress, setProgress] = useState("");

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
    <div className="p-8">
      {/* Hero */}
      <section className="mb-12 grid grid-cols-12 gap-8 items-end">
        <div className="col-span-12 lg:col-span-8">
          <span className="font-label uppercase tracking-[0.3em] text-[10px] text-secondary-dim font-bold mb-4 block">
            AI Investment Strategist
          </span>
          <h2 className="font-headline text-5xl md:text-7xl font-light leading-none mb-4 tracking-tighter text-on-surface">
            Auto <br />
            <span className="italic text-primary">Strategist.</span>
          </h2>
          <p className="font-body text-on-surface-variant max-w-xl text-sm leading-relaxed">
            Tell the AI your budget, risk appetite, and target APY. It will scan every protocol
            on DeFiLlama, deep-research the results, and create a complete investment strategy
            with exact allocations and step-by-step instructions.
          </p>
        </div>
        <div className="col-span-12 lg:col-span-4 flex flex-col items-end gap-2">
          <div className="flex gap-8">
            <div className="text-right">
              <p className="text-[9px] uppercase tracking-widest text-on-surface-variant font-bold">Engine</p>
              <p className="font-label text-sm text-primary">Claude AI</p>
            </div>
            <div className="text-right">
              <p className="text-[9px] uppercase tracking-widest text-on-surface-variant font-bold">Data</p>
              <p className="font-label text-sm text-primary">DeFiLlama</p>
            </div>
          </div>
        </div>
      </section>

      {!result && (
        <div className="grid grid-cols-12 gap-8">
          {/* Form */}
          <div className="col-span-12 lg:col-span-8 space-y-10">
            {/* Budget */}
            <div className="space-y-4">
              <label className="text-[9px] uppercase tracking-widest text-on-surface-variant font-bold block">
                Investment Budget
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg font-light">$</span>
                <input
                  type="text"
                  value={budget.toLocaleString("en-US")}
                  onChange={(e) => {
                    const num = parseInt(e.target.value.replace(/[^0-9]/g, "")) || 0;
                    setBudget(Math.min(num, 10000000));
                  }}
                  className="w-full bg-surface-lowest border-b border-outline-variant/30 text-2xl font-headline pl-10 pr-4 py-4 focus:border-primary transition-colors outline-none text-on-surface"
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                {budgetPresets.map((p) => (
                  <button
                    key={p}
                    onClick={() => setBudget(p)}
                    className={`px-4 py-1.5 text-[10px] font-bold transition-all ${
                      budget === p ? "bg-primary text-on-primary" : "bg-surface-highest text-on-surface-variant hover:text-on-surface"
                    }`}
                  >
                    ${p.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>

            {/* Risk */}
            <div className="space-y-4">
              <label className="text-[9px] uppercase tracking-widest text-on-surface-variant font-bold block">
                Risk Appetite
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-[1px] bg-surface">
                {riskOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setRisk(opt.value)}
                    className={`p-6 text-left transition-all duration-300 ${
                      risk === opt.value
                        ? "bg-surface-high border-l-2 border-primary"
                        : "bg-surface-low hover:bg-surface-container border-l-2 border-transparent"
                    }`}
                  >
                    <span className={`text-[10px] uppercase tracking-widest font-bold block mb-2 ${risk === opt.value ? "text-primary" : "text-on-surface-variant"}`}>
                      {opt.label}
                    </span>
                    <span className="text-[11px] text-on-surface-variant leading-relaxed block">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* APY Range */}
            <div className="space-y-4">
              <label className="text-[9px] uppercase tracking-widest text-on-surface-variant font-bold block">
                Target APY Range
              </label>
              <div className="flex gap-4 items-center">
                <div className="flex-1">
                  <span className="text-[9px] text-on-surface-variant block mb-1">Min APY</span>
                  <input
                    type="number"
                    value={apyMin}
                    onChange={(e) => setApyMin(Number(e.target.value))}
                    className="w-full bg-surface-lowest border-b border-outline-variant/30 text-lg font-label px-4 py-3 focus:border-primary transition-colors outline-none text-on-surface"
                  />
                </div>
                <span className="text-on-surface-variant mt-4">to</span>
                <div className="flex-1">
                  <span className="text-[9px] text-on-surface-variant block mb-1">Max APY</span>
                  <input
                    type="number"
                    value={apyMax}
                    onChange={(e) => setApyMax(Number(e.target.value))}
                    className="w-full bg-surface-lowest border-b border-outline-variant/30 text-lg font-label px-4 py-3 focus:border-primary transition-colors outline-none text-on-surface"
                  />
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                {apyPresets.map((p) => (
                  <button
                    key={p.label}
                    onClick={() => { setApyMin(p.min); setApyMax(p.max); }}
                    className={`px-4 py-1.5 text-[10px] font-bold transition-all ${
                      apyMin === p.min && apyMax === p.max
                        ? "bg-primary text-on-primary"
                        : "bg-surface-highest text-on-surface-variant hover:text-on-surface"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="bg-error-container/20 border-l-2 border-error p-4">
                <p className="text-error text-sm">{error}</p>
              </div>
            )}

            {/* Submit */}
            <button
              onClick={generate}
              disabled={loading || budget <= 0}
              className={`w-full py-4 text-sm uppercase font-bold tracking-widest flex items-center justify-center gap-2 transition-all ${
                loading ? "bg-surface-high text-on-surface-variant" : "bg-primary text-on-primary hover:bg-primary-dim"
              }`}
            >
              {loading ? (
                <>
                  <div className="w-2 h-2 bg-primary animate-pulse" />
                  {progress}
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-sm">auto_awesome</span>
                  Generate AI Strategy
                </>
              )}
            </button>
          </div>

          {/* Sidebar */}
          <div className="col-span-12 lg:col-span-4">
            <div className="bg-surface-lowest p-8 border-l-4 border-primary sticky top-20">
              <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-on-surface-variant mb-6 block">
                How It Works
              </span>
              <div className="space-y-6">
                {[
                  { step: "01", text: "Scans every yield pool on DeFiLlama matching your APY range" },
                  { step: "02", text: "Runs deep AI security analysis on each protocol — audits, team, TVL, smart contracts, red flags" },
                  { step: "03", text: "Uses legitimacy scores to build a safety-weighted portfolio with exact allocations" },
                  { step: "04", text: "Provides step-by-step instructions on how to make each investment" },
                ].map((s) => (
                  <div key={s.step} className="flex gap-3">
                    <span className="text-xl font-headline text-primary/30">{s.step}</span>
                    <p className="text-[11px] text-on-surface-variant leading-relaxed">{s.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="mt-8 bg-surface-lowest border-l-4 border-primary p-12 text-center">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="w-2 h-2 bg-primary animate-pulse" />
            <div className="w-2 h-2 bg-primary animate-pulse" style={{ animationDelay: "200ms" }} />
            <div className="w-2 h-2 bg-primary animate-pulse" style={{ animationDelay: "400ms" }} />
          </div>
          <span className="material-symbols-outlined text-5xl text-primary mb-4 block">auto_awesome</span>
          <h3 className="font-headline text-2xl text-on-surface mb-2">Building Your Strategy</h3>
          <p className="text-on-surface-variant text-sm max-w-md mx-auto">{progress}</p>
        </div>
      )}

      {/* Strategy Results */}
      {result && (
        <div className="space-y-8 animate-fade-in">
          {/* Stats Bar */}
          <div className="flex flex-wrap gap-[1px] bg-surface">
            <div className="flex-1 min-w-[150px] bg-surface-low p-6">
              <span className="text-[9px] uppercase tracking-widest text-on-surface-variant font-bold block mb-1">Pools Scanned</span>
              <span className="font-headline text-3xl text-on-surface">{result.poolsScanned.toLocaleString()}</span>
            </div>
            <div className="flex-1 min-w-[150px] bg-surface-low p-6">
              <span className="text-[9px] uppercase tracking-widest text-on-surface-variant font-bold block mb-1">Protocols Found</span>
              <span className="font-headline text-3xl text-on-surface">{result.protocolsAnalyzed}</span>
            </div>
            <div className="flex-1 min-w-[150px] bg-surface-low p-6">
              <span className="text-[9px] uppercase tracking-widest text-on-surface-variant font-bold block mb-1">Deep Analyzed</span>
              <span className="font-headline text-3xl text-primary">{result.protocolsDeepAnalyzed}</span>
            </div>
            <div className="flex-1 min-w-[150px] bg-surface-low p-6">
              <span className="text-[9px] uppercase tracking-widest text-on-surface-variant font-bold block mb-1">Projected APY</span>
              <span className="font-headline text-3xl text-primary">{result.strategy.projectedApy.toFixed(2)}%</span>
            </div>
            <div className="flex-1 min-w-[150px] bg-surface-low p-6">
              <span className="text-[9px] uppercase tracking-widest text-on-surface-variant font-bold block mb-1">Yearly Return</span>
              <span className="font-headline text-3xl text-primary">{formatCurrency(result.strategy.projectedYearlyReturn)}</span>
            </div>
          </div>

          {/* Summary */}
          <div className="bg-surface-lowest p-10 border-l-4 border-primary">
            <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-on-surface-variant mb-4 block">Strategy Overview</span>
            <p className="text-on-surface text-sm leading-relaxed whitespace-pre-line">{result.strategy.summary}</p>
          </div>

          {/* Allocations */}
          <div>
            <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-on-surface-variant mb-6 block">Portfolio Allocations</span>
            <div className="space-y-[1px]">
              {result.strategy.allocations.map((alloc, i) => {
                const verdictColor =
                  alloc.verdict === "high_confidence" ? "text-green-400 bg-green-400/10 border-green-400/30"
                  : alloc.verdict === "moderate_confidence" ? "text-yellow-400 bg-yellow-400/10 border-yellow-400/30"
                  : alloc.verdict === "low_confidence" ? "text-orange-400 bg-orange-400/10 border-orange-400/30"
                  : "text-red-400 bg-red-400/10 border-red-400/30";
                const verdictLabel =
                  alloc.verdict === "high_confidence" ? "HIGH CONFIDENCE"
                  : alloc.verdict === "moderate_confidence" ? "MODERATE"
                  : alloc.verdict === "low_confidence" ? "LOW CONFIDENCE"
                  : "CAUTION";
                const scoreColor =
                  alloc.legitimacyScore >= 70 ? "text-green-400"
                  : alloc.legitimacyScore >= 50 ? "text-yellow-400"
                  : "text-red-400";

                return (
                  <div key={i} className="bg-surface-low hover:bg-surface-high transition-all p-6">
                    <div className="grid grid-cols-12 gap-4 items-center">
                      <div className="col-span-12 md:col-span-3">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl font-headline text-primary/30">{String(i + 1).padStart(2, "0")}</span>
                          <div>
                            <h4 className="font-headline text-lg text-on-surface">{alloc.protocol}</h4>
                            <p className="text-[10px] text-on-surface-variant">{alloc.symbol} &middot; {alloc.chain}</p>
                          </div>
                        </div>
                      </div>
                      <div className="col-span-3 md:col-span-1 text-center">
                        <span className="text-[9px] uppercase tracking-widest text-on-surface-variant font-bold block">Safety</span>
                        <span className={`font-headline text-xl ${scoreColor}`}>{alloc.legitimacyScore}</span>
                      </div>
                      <div className="col-span-3 md:col-span-2 text-center">
                        <span className="text-[9px] uppercase tracking-widest text-on-surface-variant font-bold block mb-1">Verdict</span>
                        <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 border ${verdictColor}`}>
                          {verdictLabel}
                        </span>
                      </div>
                      <div className="col-span-3 md:col-span-1 text-center">
                        <span className="text-[9px] uppercase tracking-widest text-on-surface-variant font-bold block">APY</span>
                        <span className="font-headline text-xl text-primary">{alloc.apy.toFixed(2)}%</span>
                      </div>
                      <div className="col-span-3 md:col-span-2 text-center">
                        <span className="text-[9px] uppercase tracking-widest text-on-surface-variant font-bold block">Allocate</span>
                        <span className="font-headline text-xl text-on-surface">{formatBudget(alloc.allocationAmount)}</span>
                        <span className="text-[10px] text-on-surface-variant block">({alloc.allocationPercent}%)</span>
                      </div>
                      <div className="col-span-12 md:col-span-3 flex gap-2 justify-end">
                        <Link
                          href={`/protocol/${alloc.protocol}`}
                          className="w-10 h-10 border border-outline flex items-center justify-center hover:bg-on-surface hover:text-background transition-all"
                          title="AI Research"
                        >
                          <span className="material-symbols-outlined text-sm">psychology</span>
                        </Link>
                        <a
                          href={`https://defillama.com/yields/pool/${alloc.poolId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 md:flex-none h-10 px-4 bg-primary text-on-primary flex items-center justify-center gap-1 text-[10px] uppercase font-bold tracking-widest hover:bg-primary-dim transition-all"
                        >
                          Invest <span className="material-symbols-outlined text-sm">open_in_new</span>
                        </a>
                      </div>
                    </div>
                    <div className="mt-3">
                      <p className="text-[11px] text-on-surface-variant leading-relaxed">{alloc.reasoning}</p>
                    </div>
                    {alloc.redFlags && alloc.redFlags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {alloc.redFlags.map((flag, fi) => (
                          <span key={fi} className="text-[9px] text-red-400/80 bg-red-400/5 border border-red-400/20 px-2 py-0.5">
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
          <div className="bg-surface-low border-l-4 border-secondary p-8">
            <span className="text-[10px] uppercase tracking-widest font-bold text-secondary mb-3 block">Risk Assessment</span>
            <p className="text-on-surface-variant text-[12px] leading-relaxed">{result.strategy.riskAssessment}</p>
          </div>

          {/* Diversification */}
          <div className="bg-surface-low border-l-4 border-primary p-8">
            <span className="text-[10px] uppercase tracking-widest font-bold text-primary mb-3 block">Diversification</span>
            <p className="text-on-surface-variant text-[12px] leading-relaxed">{result.strategy.diversificationNotes}</p>
          </div>

          {/* Steps */}
          <div className="bg-surface-lowest p-8 border-l-4 border-primary">
            <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-on-surface-variant mb-6 block">
              Step-by-Step Instructions
            </span>
            <div className="space-y-4">
              {result.strategy.steps.map((step, i) => (
                <div key={i} className="flex gap-4 items-start">
                  <span className="w-8 h-8 bg-primary text-on-primary flex items-center justify-center text-[10px] font-bold shrink-0">
                    {i + 1}
                  </span>
                  <p className="text-on-surface-variant text-[12px] leading-relaxed pt-1.5">{step}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Warnings */}
          {result.strategy.warnings.length > 0 && (
            <div className="bg-surface-low border-l-4 border-error p-8">
              <span className="text-[10px] uppercase tracking-widest font-bold text-error mb-4 block">Warnings</span>
              <ul className="space-y-2">
                {result.strategy.warnings.map((w, i) => (
                  <li key={i} className="text-[12px] text-on-surface-variant flex items-start gap-2">
                    <span className="text-error mt-0.5">&#9888;</span>
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Actions + Disclaimer */}
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            <div className="bg-surface-container p-4 flex-1">
              <p className="text-[10px] text-on-surface-variant text-center">
                This strategy is AI-generated and for informational purposes only. Not financial advice.
                Always do your own research. Generated at {new Date(result.strategy.generatedAt).toLocaleString()}.
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => {
                  saveStrategy({ ...result.strategy, criteria: { budget, riskAppetite: risk } });
                  alert("Strategy saved! You can load it in Risk Lab or Portfolio Monitor.");
                }}
                className="bg-surface-highest text-on-surface px-4 py-3 text-[10px] uppercase font-bold tracking-widest hover:text-primary transition-all flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-sm">save</span>
                Save
              </button>
              <button
                onClick={() => generateStrategyPDF(result.strategy, { budget, riskAppetite: risk })}
                className="bg-surface-highest text-on-surface px-4 py-3 text-[10px] uppercase font-bold tracking-widest hover:text-primary transition-all flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-sm">picture_as_pdf</span>
                Export PDF
              </button>
              <button
                onClick={() => setResult(null)}
                className="bg-primary text-on-primary px-6 py-3 text-[10px] uppercase font-bold tracking-widest hover:bg-primary-dim transition-all flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-sm">refresh</span>
                New Strategy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

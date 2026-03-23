"use client";

import { useState, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ScatterChart, Scatter, Cell, LineChart, Line,
} from "recharts";
import { loadStrategies } from "@/lib/storage";
import { formatCurrency } from "@/lib/formatters";
import type { InvestmentStrategy } from "@/types/strategy";
import type { RiskAnalysisResult } from "@/types/risk-models";
import { CHART_COLORS, AXIS_STYLE, GRID_STYLE, TOOLTIP_STYLE, CHART_PALETTE, ChartContainer } from "@/components/ui/ChartTheme";

export default function RiskPage() {
  const [strategies, setStrategies] = useState<InvestmentStrategy[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number>(-1);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RiskAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const saved = loadStrategies();
    setStrategies(saved);
  }, []);

  const runAnalysis = async () => {
    if (selectedIdx < 0) return;
    const strategy = strategies[selectedIdx];

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/risk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          allocations: strategy.allocations.map((a) => ({
            poolId: a.poolId,
            symbol: a.symbol,
            protocol: a.protocol,
            allocationAmount: a.allocationAmount,
            allocationPercent: a.allocationPercent,
            stablecoin: a.stablecoin,
            chain: a.chain,
          })),
          portfolioValue: strategy.allocations.reduce((s, a) => s + a.allocationAmount, 0),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Risk analysis failed");
      }

      setResult(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run analysis");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-8 sm:py-12">
      {/* Hero */}
      <section className="mb-10">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-2 h-2 bg-danger" />
          <span className="text-[13px] font-semibold uppercase tracking-[0.2em] text-label/70">
            Quantitative Risk Analysis
          </span>
        </div>
        <h2 className="text-3xl sm:text-5xl font-black leading-none mb-5 tracking-[-0.05em] text-on-surface">
          Risk <br />
          <span className="italic text-accent">Laboratory.</span>
        </h2>
        <p className="text-muted max-w-xl text-sm leading-relaxed">
          Institutional-grade risk modeling. Value at Risk, correlation analysis, stress testing,
          Sharpe ratios, and maximum drawdown calculations on your investment strategies.
        </p>
      </section>

      {/* Strategy Selector */}
      {!result && (
        <div className="max-w-2xl space-y-8">
          <div className="bg-surface-low border border-outline p-4 sm:p-8">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-2 h-2 bg-accent" />
              <span className="text-[13px] font-semibold uppercase tracking-[0.2em] text-label/70">
                Select a Saved Strategy
              </span>
            </div>
            {strategies.length === 0 ? (
              <p className="text-muted text-sm">
                No saved strategies found. Generate a strategy on the AI Strategist page first.
              </p>
            ) : (
              <div className="space-y-2">
                {strategies.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedIdx(i)}
                    className={`w-full text-left p-5 transition-all duration-300 border ${
                      selectedIdx === i
                        ? "bg-surface-highest border-accent"
                        : "bg-surface-highest border-outline hover:border-accent"
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="text-on-surface text-sm font-semibold">
                          {s.allocations.length} allocations &middot; {s.projectedApy.toFixed(2)}% APY
                        </span>
                        <span className="text-[13px] text-muted block mt-1">
                          Generated {new Date(s.generatedAt).toLocaleDateString()}
                        </span>
                      </div>
                      <span className="text-accent font-black tracking-[-0.05em] text-xl">
                        {formatCurrency(s.projectedYearlyReturn)}/yr
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {error && (
            <div className="bg-danger/10 border border-danger/20 p-6">
              <p className="text-danger text-sm">{error}</p>
            </div>
          )}

          <button
            onClick={runAnalysis}
            disabled={loading || selectedIdx < 0}
            className={`w-full py-4 text-[13px] uppercase font-semibold tracking-[0.12em] flex items-center justify-center gap-2 transition-all duration-300 ${
              loading || selectedIdx < 0
                ? "bg-surface-low text-muted border border-outline"
                : "bg-cta text-white hover:bg-[#e55f0a]"
            }`}
          >
            {loading ? (
              <>
                <div className="w-2 h-2 bg-accent animate-pulse" />
                Fetching historical data and running calculations...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-sm">assessment</span>
                Run Risk Analysis
              </>
            )}
          </button>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-8 animate-fade-in">
          {/* VaR */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <div className="bg-surface-low border border-outline p-6 sm:p-10 text-center">
              <div className="flex items-center justify-center gap-3 mb-4">
                <div className="w-2 h-2 bg-danger" />
                <span className="text-[13px] font-semibold uppercase tracking-[0.2em] text-label/70">
                  VaR (95% Confidence)
                </span>
              </div>
              <span className="font-black tracking-[-0.05em] text-2xl sm:text-[42px] text-danger">{formatCurrency(result.var.value95)}</span>
              <span className="text-[13px] text-muted block mt-2">
                Max loss in {result.var.timeHorizon} days (95% likely)
              </span>
            </div>
            <div className="bg-surface-low border border-outline p-6 sm:p-10 text-center">
              <div className="flex items-center justify-center gap-3 mb-4">
                <div className="w-2 h-2 bg-danger" />
                <span className="text-[13px] font-semibold uppercase tracking-[0.2em] text-label/70">
                  VaR (99% Confidence)
                </span>
              </div>
              <span className="font-black tracking-[-0.05em] text-2xl sm:text-[42px] text-danger">{formatCurrency(result.var.value99)}</span>
              <span className="text-[13px] text-muted block mt-2">
                Worst case in {result.var.timeHorizon} days (99% likely)
              </span>
            </div>
            <div className="bg-surface-low border border-outline p-6 sm:p-10 text-center">
              <div className="flex items-center justify-center gap-3 mb-4">
                <div className="w-2 h-2 bg-accent" />
                <span className="text-[13px] font-semibold uppercase tracking-[0.2em] text-label/70">
                  Sharpe Ratio
                </span>
              </div>
              <span className={`font-black tracking-[-0.05em] text-2xl sm:text-[42px] ${
                result.sharpe.interpretation === "excellent" ? "text-accent"
                : result.sharpe.interpretation === "good" ? "text-accent"
                : result.sharpe.interpretation === "adequate" ? "text-cta"
                : "text-danger"
              }`}>
                {result.sharpe.ratio}
              </span>
              <span className="text-[13px] text-muted block mt-2 capitalize">
                {result.sharpe.interpretation} — Vol: {result.sharpe.volatility}%
              </span>
            </div>
          </div>

          {/* Stress Tests */}
          <ChartContainer title="Stress Test Scenarios" subtitle="Projected portfolio losses under historical crisis conditions">
            <div className="mt-4 overflow-x-auto">
              <div className="grid grid-cols-5 gap-4 text-xs uppercase tracking-[0.12em] text-muted font-semibold bg-surface-low px-4 sm:px-8 py-4 min-w-[600px]">
                <span>Scenario</span>
                <span>Description</span>
                <span className="text-right">Projected Loss</span>
                <span className="text-right">Loss %</span>
                <span className="text-right">Surviving Value</span>
              </div>
              {result.stressTests.map((test) => (
                <div key={test.name} className="grid grid-cols-5 gap-4 text-sm hover:bg-surface-low transition-all duration-300 px-4 sm:px-8 py-4 items-center border-t border-outline-variant min-w-[600px]">
                  <span className="text-on-surface font-semibold">{test.name}</span>
                  <span className="text-muted text-[13px]">{test.description}</span>
                  <span className="text-right text-danger font-semibold">-{formatCurrency(test.projectedLoss)}</span>
                  <span className="text-right text-danger">-{test.projectedLossPercent}%</span>
                  <span className="text-right text-on-surface">{formatCurrency(test.survivingValue)}</span>
                </div>
              ))}
            </div>
          </ChartContainer>

          {/* Stress Test Chart */}
          <ChartContainer title="Stress Test Impact" subtitle="Projected dollar loss per scenario">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={result.stressTests} layout="vertical">
                <CartesianGrid {...GRID_STYLE} />
                <XAxis type="number" {...AXIS_STYLE} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="name" {...AXIS_STYLE} width={150} />
                <Tooltip {...TOOLTIP_STYLE} formatter={(value: unknown) => [formatCurrency(value as number), "Loss"]} />
                <Bar dataKey="projectedLoss" fill={CHART_COLORS.error} fillOpacity={0.8} />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>

          {/* Correlations */}
          {result.correlations.length > 0 && (
            <ChartContainer title="APY Correlation Matrix" subtitle="How pool yields move together (-1 to +1). High correlation = less diversification benefit">
              <div className="mt-4 overflow-x-auto">
                <div className="grid grid-cols-3 gap-4 text-xs uppercase tracking-[0.12em] text-muted font-semibold bg-surface-low px-4 sm:px-8 py-4">
                  <span>Pool A</span>
                  <span>Pool B</span>
                  <span className="text-right">Correlation</span>
                </div>
                {result.correlations.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation)).map((c, i) => {
                  const color = Math.abs(c.correlation) > 0.7 ? "text-danger"
                    : Math.abs(c.correlation) > 0.4 ? "text-cta"
                    : "text-accent";
                  return (
                    <div key={i} className="grid grid-cols-3 gap-4 text-sm hover:bg-surface-low transition-all duration-300 px-4 sm:px-8 py-4 items-center border-t border-outline-variant">
                      <span className="text-on-surface">{c.symbolA}</span>
                      <span className="text-on-surface">{c.symbolB}</span>
                      <span className={`text-right font-semibold ${color}`}>{c.correlation.toFixed(3)}</span>
                    </div>
                  );
                })}
              </div>
            </ChartContainer>
          )}

          {/* Drawdowns */}
          <ChartContainer title="Maximum Drawdown per Pool" subtitle="Largest peak-to-trough APY decline in history">
            <div className="mt-4 overflow-x-auto">
              <div className="grid grid-cols-5 gap-4 text-xs uppercase tracking-[0.12em] text-muted font-semibold bg-surface-low px-4 sm:px-8 py-4 min-w-[600px]">
                <span>Pool</span>
                <span className="text-right">Max Drawdown</span>
                <span className="text-right">Peak APY</span>
                <span className="text-right">Trough APY</span>
                <span className="text-right">Period</span>
              </div>
              {result.drawdowns.map((d) => (
                <div key={d.poolId} className="grid grid-cols-5 gap-4 text-sm hover:bg-surface-low transition-all duration-300 px-4 sm:px-8 py-4 items-center border-t border-outline-variant min-w-[600px]">
                  <span className="text-on-surface font-semibold">{d.symbol}</span>
                  <span className="text-right text-danger font-semibold">-{d.drawdown.maxDrawdown}%</span>
                  <span className="text-right text-accent">{d.drawdown.peakApy}%</span>
                  <span className="text-right text-danger">{d.drawdown.troughApy}%</span>
                  <span className="text-right text-muted text-[13px]">
                    {d.drawdown.peakDate ? new Date(d.drawdown.peakDate).toLocaleDateString() : "N/A"} →{" "}
                    {d.drawdown.troughDate ? new Date(d.drawdown.troughDate).toLocaleDateString() : "N/A"}
                  </span>
                </div>
              ))}
            </div>
          </ChartContainer>

          {/* Back */}
          <button
            onClick={() => setResult(null)}
            className="bg-cta text-white px-8 py-4 text-[13px] uppercase font-semibold tracking-[0.12em] hover:bg-[#e55f0a] transition-all duration-300 flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-sm">arrow_back</span>
            New Analysis
          </button>
        </div>
      )}
    </div>
  );
}

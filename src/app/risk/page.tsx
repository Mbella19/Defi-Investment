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
    <div className="p-8">
      {/* Hero */}
      <section className="mb-8">
        <span className="font-label uppercase tracking-[0.3em] text-[10px] text-secondary-dim font-bold mb-4 block">
          Quantitative Risk Analysis
        </span>
        <h2 className="font-headline text-5xl md:text-7xl font-light leading-none mb-4 tracking-tighter text-on-surface">
          Risk <br />
          <span className="italic text-primary">Laboratory.</span>
        </h2>
        <p className="font-body text-on-surface-variant max-w-xl text-sm leading-relaxed">
          Institutional-grade risk modeling. Value at Risk, correlation analysis, stress testing,
          Sharpe ratios, and maximum drawdown calculations on your investment strategies.
        </p>
      </section>

      {/* Strategy Selector */}
      {!result && (
        <div className="max-w-2xl space-y-6">
          <div className="bg-surface-lowest border-l-4 border-primary p-6">
            <label className="text-[9px] uppercase tracking-widest text-on-surface-variant font-bold block mb-3">
              Select a Saved Strategy
            </label>
            {strategies.length === 0 ? (
              <p className="text-on-surface-variant text-sm">
                No saved strategies found. Generate a strategy on the AI Strategist page first.
              </p>
            ) : (
              <div className="space-y-[1px]">
                {strategies.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedIdx(i)}
                    className={`w-full text-left p-4 transition-all ${
                      selectedIdx === i
                        ? "bg-surface-high border-l-2 border-primary"
                        : "bg-surface-low hover:bg-surface-container border-l-2 border-transparent"
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="text-on-surface text-sm font-label">
                          {s.allocations.length} allocations &middot; {s.projectedApy.toFixed(2)}% APY
                        </span>
                        <span className="text-[10px] text-on-surface-variant block">
                          Generated {new Date(s.generatedAt).toLocaleDateString()}
                        </span>
                      </div>
                      <span className="text-primary font-headline text-lg">
                        {formatCurrency(s.projectedYearlyReturn)}/yr
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {error && (
            <div className="bg-error-container/20 border-l-2 border-error p-4">
              <p className="text-error text-sm">{error}</p>
            </div>
          )}

          <button
            onClick={runAnalysis}
            disabled={loading || selectedIdx < 0}
            className={`w-full py-4 text-sm uppercase font-bold tracking-widest flex items-center justify-center gap-2 transition-all ${
              loading || selectedIdx < 0 ? "bg-surface-high text-on-surface-variant" : "bg-primary text-on-primary hover:bg-primary-dim"
            }`}
          >
            {loading ? (
              <>
                <div className="w-2 h-2 bg-primary animate-pulse" />
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-[1px] bg-surface">
            <div className="bg-surface-low p-8 text-center">
              <span className="text-[9px] uppercase tracking-widest text-on-surface-variant font-bold block mb-2">
                VaR (95% Confidence)
              </span>
              <span className="font-headline text-4xl text-error">{formatCurrency(result.var.value95)}</span>
              <span className="text-[10px] text-on-surface-variant block mt-1">
                Max loss in {result.var.timeHorizon} days (95% likely)
              </span>
            </div>
            <div className="bg-surface-low p-8 text-center">
              <span className="text-[9px] uppercase tracking-widest text-on-surface-variant font-bold block mb-2">
                VaR (99% Confidence)
              </span>
              <span className="font-headline text-4xl text-error">{formatCurrency(result.var.value99)}</span>
              <span className="text-[10px] text-on-surface-variant block mt-1">
                Worst case in {result.var.timeHorizon} days (99% likely)
              </span>
            </div>
            <div className="bg-surface-low p-8 text-center">
              <span className="text-[9px] uppercase tracking-widest text-on-surface-variant font-bold block mb-2">
                Sharpe Ratio
              </span>
              <span className={`font-headline text-4xl ${
                result.sharpe.interpretation === "excellent" ? "text-green-400"
                : result.sharpe.interpretation === "good" ? "text-primary"
                : result.sharpe.interpretation === "adequate" ? "text-yellow-400"
                : "text-error"
              }`}>
                {result.sharpe.ratio}
              </span>
              <span className="text-[10px] text-on-surface-variant block mt-1 capitalize">
                {result.sharpe.interpretation} — Vol: {result.sharpe.volatility}%
              </span>
            </div>
          </div>

          {/* Stress Tests */}
          <ChartContainer title="Stress Test Scenarios" subtitle="Projected portfolio losses under historical crisis conditions">
            <div className="space-y-[1px] mt-4">
              <div className="grid grid-cols-5 gap-4 text-[9px] uppercase tracking-widest text-on-surface-variant font-bold bg-surface-high p-3">
                <span>Scenario</span>
                <span>Description</span>
                <span className="text-right">Projected Loss</span>
                <span className="text-right">Loss %</span>
                <span className="text-right">Surviving Value</span>
              </div>
              {result.stressTests.map((test) => (
                <div key={test.name} className="grid grid-cols-5 gap-4 text-[11px] bg-surface-low hover:bg-surface-high transition-all p-3 items-center">
                  <span className="text-on-surface font-label font-bold">{test.name}</span>
                  <span className="text-on-surface-variant text-[10px]">{test.description}</span>
                  <span className="text-right text-error font-bold">-{formatCurrency(test.projectedLoss)}</span>
                  <span className="text-right text-error">-{test.projectedLossPercent}%</span>
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
              <div className="space-y-[1px] mt-4">
                <div className="grid grid-cols-3 gap-4 text-[9px] uppercase tracking-widest text-on-surface-variant font-bold bg-surface-high p-3">
                  <span>Pool A</span>
                  <span>Pool B</span>
                  <span className="text-right">Correlation</span>
                </div>
                {result.correlations.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation)).map((c, i) => {
                  const color = Math.abs(c.correlation) > 0.7 ? "text-error"
                    : Math.abs(c.correlation) > 0.4 ? "text-yellow-400"
                    : "text-green-400";
                  return (
                    <div key={i} className="grid grid-cols-3 gap-4 text-[11px] bg-surface-low hover:bg-surface-high transition-all p-3 items-center">
                      <span className="text-on-surface font-label">{c.symbolA}</span>
                      <span className="text-on-surface font-label">{c.symbolB}</span>
                      <span className={`text-right font-bold ${color}`}>{c.correlation.toFixed(3)}</span>
                    </div>
                  );
                })}
              </div>
            </ChartContainer>
          )}

          {/* Drawdowns */}
          <ChartContainer title="Maximum Drawdown per Pool" subtitle="Largest peak-to-trough APY decline in history">
            <div className="space-y-[1px] mt-4">
              <div className="grid grid-cols-5 gap-4 text-[9px] uppercase tracking-widest text-on-surface-variant font-bold bg-surface-high p-3">
                <span>Pool</span>
                <span className="text-right">Max Drawdown</span>
                <span className="text-right">Peak APY</span>
                <span className="text-right">Trough APY</span>
                <span className="text-right">Period</span>
              </div>
              {result.drawdowns.map((d) => (
                <div key={d.poolId} className="grid grid-cols-5 gap-4 text-[11px] bg-surface-low hover:bg-surface-high transition-all p-3 items-center">
                  <span className="text-on-surface font-label font-bold">{d.symbol}</span>
                  <span className="text-right text-error font-bold">-{d.drawdown.maxDrawdown}%</span>
                  <span className="text-right text-green-400">{d.drawdown.peakApy}%</span>
                  <span className="text-right text-error">{d.drawdown.troughApy}%</span>
                  <span className="text-right text-on-surface-variant text-[10px]">
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
            className="bg-primary text-on-primary px-8 py-3 text-[10px] uppercase font-bold tracking-widest hover:bg-primary-dim transition-all flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-sm">arrow_back</span>
            New Analysis
          </button>
        </div>
      )}
    </div>
  );
}

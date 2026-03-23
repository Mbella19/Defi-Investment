"use client";

import { useState, useMemo } from "react";
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { calculateILRange, calculateILDetailed, calculateNetReturnTable } from "@/lib/impermanent-loss";
import { simulateYield, compareCompoundingFrequencies, type SimulationParams } from "@/lib/yield-simulator";
import { formatCurrency } from "@/lib/formatters";
import { CHART_COLORS, AXIS_STYLE, GRID_STYLE, TOOLTIP_STYLE, CHART_PALETTE, ChartContainer } from "@/components/ui/ChartTheme";

type Tab = "il" | "yield";

export default function SimulatorPage() {
  const [tab, setTab] = useState<Tab>("il");

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-8 sm:py-12">
      {/* Hero */}
      <section className="mb-10">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-2 h-2 bg-accent" />
          <span className="text-[13px] font-semibold uppercase tracking-[0.2em] text-label/70">
            Financial Instruments
          </span>
        </div>
        <h2 className="text-3xl sm:text-5xl font-black tracking-[-0.05em] leading-none mb-4 text-on-surface">
          Yield <br />
          <span className="italic text-accent">Simulator.</span>
        </h2>
        <p className="text-muted max-w-xl text-sm leading-relaxed">
          Model impermanent loss for LP positions and simulate compounding yield returns
          with gas cost optimization.
        </p>
      </section>

      {/* Tab Switcher */}
      <div className="flex gap-4 sm:gap-6 mb-10 border-b border-outline overflow-x-auto">
        <button
          onClick={() => setTab("il")}
          className={`pb-3 text-[13px] uppercase tracking-[0.12em] font-semibold transition-all duration-300 ${
            tab === "il"
              ? "text-accent border-b-2 border-accent"
              : "text-muted hover:text-on-surface"
          }`}
        >
          Impermanent Loss Calculator
        </button>
        <button
          onClick={() => setTab("yield")}
          className={`pb-3 text-[13px] uppercase tracking-[0.12em] font-semibold transition-all duration-300 ${
            tab === "yield"
              ? "text-accent border-b-2 border-accent"
              : "text-muted hover:text-on-surface"
          }`}
        >
          Yield Farming Simulator
        </button>
      </div>

      {tab === "il" ? <ILCalculatorSection /> : <YieldSimulatorSection />}
    </div>
  );
}

/* ==================== IL CALCULATOR ==================== */

function ILCalculatorSection() {
  const [investedAmount, setInvestedAmount] = useState(10000);
  const [priceChange, setPriceChange] = useState(50);
  const [poolApy, setPoolApy] = useState(20);

  const ilCurve = useMemo(() => calculateILRange(-90, 500, 120), []);
  const ilDetail = useMemo(() => calculateILDetailed(investedAmount, priceChange), [investedAmount, priceChange]);
  const netReturnTable = useMemo(() => calculateNetReturnTable(investedAmount, poolApy, priceChange), [investedAmount, poolApy, priceChange]);

  return (
    <div className="grid grid-cols-12 gap-4 sm:gap-8">
      {/* Controls */}
      <div className="col-span-12 lg:col-span-4 space-y-4 sm:space-y-8">
        <div className="bg-surface-low border border-outline p-4 sm:p-8 space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-2 h-2 bg-accent" />
            <span className="text-[13px] font-semibold uppercase tracking-[0.2em] text-label/70">Parameters</span>
          </div>

          <div>
            <label className="text-[13px] font-semibold uppercase tracking-[0.2em] text-label/70 block mb-2">
              Invested Amount
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted">$</span>
              <input
                type="number"
                value={investedAmount}
                onChange={(e) => setInvestedAmount(Number(e.target.value))}
                className="w-full bg-surface-highest border border-outline text-sm px-4 py-3 pl-8 focus:border-accent outline-none transition-colors text-on-surface"
              />
            </div>
          </div>

          <div>
            <label className="text-[13px] font-semibold uppercase tracking-[0.2em] text-label/70 block mb-2">
              Price Change: {priceChange > 0 ? "+" : ""}{priceChange}%
            </label>
            <input
              type="range"
              min={-90}
              max={500}
              value={priceChange}
              onChange={(e) => setPriceChange(Number(e.target.value))}
              className="w-full accent-[#00D4AA]"
            />
            <div className="flex justify-between text-[13px] text-muted mt-1">
              <span>-90%</span>
              <span>0%</span>
              <span>+500%</span>
            </div>
          </div>

          <div>
            <label className="text-[13px] font-semibold uppercase tracking-[0.2em] text-label/70 block mb-2">
              Pool APY (for net return)
            </label>
            <input
              type="number"
              value={poolApy}
              onChange={(e) => setPoolApy(Number(e.target.value))}
              className="w-full bg-surface-highest border border-outline text-sm px-4 py-3 focus:border-accent outline-none transition-colors text-on-surface"
            />
          </div>
        </div>

        {/* IL Results */}
        <div className="bg-surface-low border border-outline p-4 sm:p-8 space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-2 h-2 bg-danger" />
            <span className="text-[13px] font-semibold uppercase tracking-[0.2em] text-label/70">Results</span>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:gap-6">
            <div>
              <span className="text-[13px] text-muted block mb-1">IL %</span>
              <span className="text-2xl sm:text-[42px] font-black text-danger">{ilDetail.impermanentLossPercent}%</span>
            </div>
            <div>
              <span className="text-[13px] text-muted block mb-1">IL Loss</span>
              <span className="text-2xl sm:text-[42px] font-black text-danger">{formatCurrency(Math.abs(ilDetail.dollarLoss))}</span>
            </div>
            <div>
              <span className="text-[13px] text-muted block mb-1">HODL Value</span>
              <span className="text-2xl font-black text-on-surface">{formatCurrency(ilDetail.holdValue)}</span>
            </div>
            <div>
              <span className="text-[13px] text-muted block mb-1">LP Value</span>
              <span className="text-2xl font-black text-accent">{formatCurrency(ilDetail.lpValue)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="col-span-12 lg:col-span-8 space-y-4 sm:space-y-8">
        <ChartContainer title="Impermanent Loss Curve" subtitle="IL % vs Token Price Change">
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={ilCurve}>
              <CartesianGrid {...GRID_STYLE} />
              <XAxis dataKey="priceChange" {...AXIS_STYLE} tickFormatter={(v) => `${v}%`} />
              <YAxis {...AXIS_STYLE} tickFormatter={(v) => `${v}%`} />
              <Tooltip
                {...TOOLTIP_STYLE}
                formatter={(value: unknown) => [`${value}%`, "IL"]}
                labelFormatter={(label) => `Price Change: ${label}%`}
              />
              <Area type="monotone" dataKey="ilPercent" stroke={CHART_COLORS.error} fill={CHART_COLORS.error} fillOpacity={0.15} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartContainer>

        {/* Net Return Table */}
        <div className="bg-surface-low border border-outline p-4 sm:p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-2 h-2 bg-accent" />
            <span className="text-[13px] font-semibold uppercase tracking-[0.2em] text-label/70">
              Net Return: APY Yield vs Impermanent Loss
            </span>
          </div>
          <div className="bg-surface-highest border border-outline overflow-x-auto">
            <div className="grid grid-cols-5 gap-4 text-[13px] uppercase tracking-[0.12em] text-muted font-semibold p-4 bg-surface-low min-w-[500px]">
              <span>Period</span>
              <span className="text-right">Yield Earned</span>
              <span className="text-right">IL Loss</span>
              <span className="text-right">Net Return</span>
              <span className="text-right">Verdict</span>
            </div>
            {netReturnTable.map((row) => (
              <div key={row.label} className="grid grid-cols-5 gap-4 text-[13px] bg-surface-highest hover:bg-surface-low transition-all duration-300 p-4 items-center border-t border-outline-variant min-w-[500px]">
                <span className="text-on-surface font-medium">{row.label}</span>
                <span className="text-right text-accent">+{formatCurrency(row.yieldEarned)}</span>
                <span className="text-right text-danger">-{formatCurrency(row.ilLoss)}</span>
                <span className={`text-right font-bold ${row.netReturn >= 0 ? "text-accent" : "text-danger"}`}>
                  {row.netReturn >= 0 ? "+" : ""}{formatCurrency(row.netReturn)}
                </span>
                <span className={`text-right text-[13px] font-bold uppercase ${row.worthIt ? "text-accent" : "text-danger"}`}>
                  {row.worthIt ? "WORTH IT" : "NOT WORTH IT"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ==================== YIELD SIMULATOR ==================== */

function YieldSimulatorSection() {
  const [principal, setPrincipal] = useState(10000);
  const [apy, setApy] = useState(15);
  const [duration, setDuration] = useState(365);
  const [gasPerCompound, setGasPerCompound] = useState(2);

  const comparison = useMemo(
    () => compareCompoundingFrequencies(principal, apy, duration, gasPerCompound),
    [principal, apy, duration, gasPerCompound]
  );

  // Merge data points for multi-line chart
  const chartData = useMemo(() => {
    const dayMap = new Map<number, Record<string, number>>();
    comparison.forEach(({ frequency, result }) => {
      result.dataPoints.forEach((dp) => {
        const existing = dayMap.get(dp.day) || { day: dp.day };
        existing[frequency] = dp.value;
        dayMap.set(dp.day, existing);
      });
    });
    return Array.from(dayMap.values()).sort((a, b) => a.day - b.day);
  }, [comparison]);

  return (
    <div className="grid grid-cols-12 gap-4 sm:gap-8">
      {/* Controls */}
      <div className="col-span-12 lg:col-span-4 space-y-4 sm:space-y-8">
        <div className="bg-surface-low border border-outline p-4 sm:p-8 space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-2 h-2 bg-accent" />
            <span className="text-[13px] font-semibold uppercase tracking-[0.2em] text-label/70">Parameters</span>
          </div>

          <div>
            <label className="text-[13px] font-semibold uppercase tracking-[0.2em] text-label/70 block mb-2">
              Investment Amount
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted">$</span>
              <input
                type="number"
                value={principal}
                onChange={(e) => setPrincipal(Number(e.target.value))}
                className="w-full bg-surface-highest border border-outline text-sm px-4 py-3 pl-8 focus:border-accent outline-none transition-colors text-on-surface"
              />
            </div>
          </div>

          <div>
            <label className="text-[13px] font-semibold uppercase tracking-[0.2em] text-label/70 block mb-2">
              Pool APY: {apy}%
            </label>
            <input
              type="range"
              min={1}
              max={200}
              value={apy}
              onChange={(e) => setApy(Number(e.target.value))}
              className="w-full accent-[#00D4AA]"
            />
          </div>

          <div>
            <label className="text-[13px] font-semibold uppercase tracking-[0.2em] text-label/70 block mb-2">
              Duration: {duration} days ({(duration / 365).toFixed(1)} years)
            </label>
            <input
              type="range"
              min={30}
              max={1095}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="w-full accent-[#00D4AA]"
            />
          </div>

          <div>
            <label className="text-[13px] font-semibold uppercase tracking-[0.2em] text-label/70 block mb-2">
              Gas per Compound ($)
            </label>
            <input
              type="number"
              value={gasPerCompound}
              onChange={(e) => setGasPerCompound(Number(e.target.value))}
              step={0.5}
              min={0}
              className="w-full bg-surface-highest border border-outline text-sm px-4 py-3 focus:border-accent outline-none transition-colors text-on-surface"
            />
          </div>
        </div>
      </div>

      {/* Chart + Comparison */}
      <div className="col-span-12 lg:col-span-8 space-y-4 sm:space-y-8">
        <ChartContainer title="Portfolio Growth" subtitle="Comparing compounding frequencies">
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={chartData}>
              <CartesianGrid {...GRID_STYLE} />
              <XAxis dataKey="day" {...AXIS_STYLE} tickFormatter={(v) => `${v}d`} />
              <YAxis {...AXIS_STYLE} tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`} />
              <Tooltip
                {...TOOLTIP_STYLE}
                formatter={(value: unknown, name: unknown) => [formatCurrency(value as number), name as string]}
                labelFormatter={(label) => `Day ${label}`}
              />
              <Legend wrapperStyle={{ fontSize: 10, fontFamily: "Inter" }} />
              {comparison.map(({ frequency }, i) => (
                <Line
                  key={frequency}
                  type="monotone"
                  dataKey={frequency}
                  stroke={CHART_PALETTE[i]}
                  strokeWidth={2}
                  dot={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </ChartContainer>

        {/* Comparison Table */}
        <div className="bg-surface-low border border-outline p-4 sm:p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-2 h-2 bg-accent" />
            <span className="text-[13px] font-semibold uppercase tracking-[0.2em] text-label/70">
              Compounding Comparison
            </span>
          </div>
          <div className="bg-surface-highest border border-outline overflow-x-auto">
            <div className="grid grid-cols-6 gap-4 text-[13px] uppercase tracking-[0.12em] text-muted font-semibold p-4 bg-surface-low min-w-[600px]">
              <span>Frequency</span>
              <span className="text-right">Final Value</span>
              <span className="text-right">Gross Return</span>
              <span className="text-right">Gas Costs</span>
              <span className="text-right">Net Return</span>
              <span className="text-right">Effective APY</span>
            </div>
            {comparison.map(({ frequency, result }) => (
              <div key={frequency} className="grid grid-cols-6 gap-4 text-[13px] bg-surface-highest hover:bg-surface-low transition-all duration-300 p-4 items-center border-t border-outline-variant min-w-[600px]">
                <span className="text-on-surface font-semibold">{frequency}</span>
                <span className="text-right text-on-surface">{formatCurrency(result.finalValue)}</span>
                <span className="text-right text-accent">+{formatCurrency(result.grossReturn)}</span>
                <span className="text-right text-danger">{result.totalGasCost > 0 ? `-${formatCurrency(result.totalGasCost)}` : "$0"}</span>
                <span className={`text-right font-bold ${result.netReturn >= 0 ? "text-accent" : "text-danger"}`}>
                  {result.netReturn >= 0 ? "+" : ""}{formatCurrency(result.netReturn)}
                </span>
                <span className="text-right text-accent font-bold">{result.effectiveApy.toFixed(2)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

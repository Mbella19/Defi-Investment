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
    <div className="p-8">
      {/* Hero */}
      <section className="mb-8">
        <span className="font-label uppercase tracking-[0.3em] text-[10px] text-secondary-dim font-bold mb-4 block">
          Financial Instruments
        </span>
        <h2 className="font-headline text-5xl md:text-7xl font-light leading-none mb-4 tracking-tighter text-on-surface">
          Yield <br />
          <span className="italic text-primary">Simulator.</span>
        </h2>
        <p className="font-body text-on-surface-variant max-w-xl text-sm leading-relaxed">
          Model impermanent loss for LP positions and simulate compounding yield returns
          with gas cost optimization.
        </p>
      </section>

      {/* Tab Switcher */}
      <div className="flex gap-[1px] mb-8">
        <button
          onClick={() => setTab("il")}
          className={`px-6 py-3 text-[10px] uppercase tracking-widest font-bold transition-all ${
            tab === "il" ? "bg-primary text-on-primary" : "bg-surface-highest text-on-surface-variant hover:text-on-surface"
          }`}
        >
          Impermanent Loss Calculator
        </button>
        <button
          onClick={() => setTab("yield")}
          className={`px-6 py-3 text-[10px] uppercase tracking-widest font-bold transition-all ${
            tab === "yield" ? "bg-primary text-on-primary" : "bg-surface-highest text-on-surface-variant hover:text-on-surface"
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
    <div className="grid grid-cols-12 gap-8">
      {/* Controls */}
      <div className="col-span-12 lg:col-span-4 space-y-6">
        <div className="bg-surface-lowest border-l-4 border-primary p-6 space-y-6">
          <div>
            <label className="text-[9px] uppercase tracking-widest text-on-surface-variant font-bold block mb-2">
              Invested Amount
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant">$</span>
              <input
                type="number"
                value={investedAmount}
                onChange={(e) => setInvestedAmount(Number(e.target.value))}
                className="w-full bg-surface-low border-b border-outline-variant/30 text-lg font-label pl-8 pr-4 py-3 focus:border-primary transition-colors outline-none text-on-surface"
              />
            </div>
          </div>

          <div>
            <label className="text-[9px] uppercase tracking-widest text-on-surface-variant font-bold block mb-2">
              Price Change: {priceChange > 0 ? "+" : ""}{priceChange}%
            </label>
            <input
              type="range"
              min={-90}
              max={500}
              value={priceChange}
              onChange={(e) => setPriceChange(Number(e.target.value))}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-[9px] text-on-surface-variant mt-1">
              <span>-90%</span>
              <span>0%</span>
              <span>+500%</span>
            </div>
          </div>

          <div>
            <label className="text-[9px] uppercase tracking-widest text-on-surface-variant font-bold block mb-2">
              Pool APY (for net return)
            </label>
            <input
              type="number"
              value={poolApy}
              onChange={(e) => setPoolApy(Number(e.target.value))}
              className="w-full bg-surface-low border-b border-outline-variant/30 text-lg font-label px-4 py-3 focus:border-primary transition-colors outline-none text-on-surface"
            />
          </div>
        </div>

        {/* IL Results */}
        <div className="bg-surface-low p-6 space-y-4">
          <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-on-surface-variant block">
            Results
          </span>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-[9px] text-on-surface-variant block">IL %</span>
              <span className="font-headline text-2xl text-error">{ilDetail.impermanentLossPercent}%</span>
            </div>
            <div>
              <span className="text-[9px] text-on-surface-variant block">IL Loss</span>
              <span className="font-headline text-2xl text-error">{formatCurrency(Math.abs(ilDetail.dollarLoss))}</span>
            </div>
            <div>
              <span className="text-[9px] text-on-surface-variant block">HODL Value</span>
              <span className="font-headline text-xl text-on-surface">{formatCurrency(ilDetail.holdValue)}</span>
            </div>
            <div>
              <span className="text-[9px] text-on-surface-variant block">LP Value</span>
              <span className="font-headline text-xl text-primary">{formatCurrency(ilDetail.lpValue)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="col-span-12 lg:col-span-8 space-y-6">
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
        <div className="bg-surface-lowest border-l-4 border-primary p-6">
          <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-on-surface-variant block mb-4">
            Net Return: APY Yield vs Impermanent Loss
          </span>
          <div className="space-y-[1px]">
            <div className="grid grid-cols-5 gap-4 text-[9px] uppercase tracking-widest text-on-surface-variant font-bold bg-surface-high p-3">
              <span>Period</span>
              <span className="text-right">Yield Earned</span>
              <span className="text-right">IL Loss</span>
              <span className="text-right">Net Return</span>
              <span className="text-right">Verdict</span>
            </div>
            {netReturnTable.map((row) => (
              <div key={row.label} className="grid grid-cols-5 gap-4 text-[11px] bg-surface-low hover:bg-surface-high transition-all p-3 items-center">
                <span className="text-on-surface font-label">{row.label}</span>
                <span className="text-right text-green-400">+{formatCurrency(row.yieldEarned)}</span>
                <span className="text-right text-error">-{formatCurrency(row.ilLoss)}</span>
                <span className={`text-right font-bold ${row.netReturn >= 0 ? "text-green-400" : "text-error"}`}>
                  {row.netReturn >= 0 ? "+" : ""}{formatCurrency(row.netReturn)}
                </span>
                <span className={`text-right text-[9px] font-bold uppercase ${row.worthIt ? "text-green-400" : "text-error"}`}>
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
    <div className="grid grid-cols-12 gap-8">
      {/* Controls */}
      <div className="col-span-12 lg:col-span-4 space-y-6">
        <div className="bg-surface-lowest border-l-4 border-primary p-6 space-y-6">
          <div>
            <label className="text-[9px] uppercase tracking-widest text-on-surface-variant font-bold block mb-2">
              Investment Amount
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant">$</span>
              <input
                type="number"
                value={principal}
                onChange={(e) => setPrincipal(Number(e.target.value))}
                className="w-full bg-surface-low border-b border-outline-variant/30 text-lg font-label pl-8 pr-4 py-3 focus:border-primary transition-colors outline-none text-on-surface"
              />
            </div>
          </div>

          <div>
            <label className="text-[9px] uppercase tracking-widest text-on-surface-variant font-bold block mb-2">
              Pool APY: {apy}%
            </label>
            <input
              type="range"
              min={1}
              max={200}
              value={apy}
              onChange={(e) => setApy(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </div>

          <div>
            <label className="text-[9px] uppercase tracking-widest text-on-surface-variant font-bold block mb-2">
              Duration: {duration} days ({(duration / 365).toFixed(1)} years)
            </label>
            <input
              type="range"
              min={30}
              max={1095}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </div>

          <div>
            <label className="text-[9px] uppercase tracking-widest text-on-surface-variant font-bold block mb-2">
              Gas per Compound ($)
            </label>
            <input
              type="number"
              value={gasPerCompound}
              onChange={(e) => setGasPerCompound(Number(e.target.value))}
              step={0.5}
              min={0}
              className="w-full bg-surface-low border-b border-outline-variant/30 text-lg font-label px-4 py-3 focus:border-primary transition-colors outline-none text-on-surface"
            />
          </div>
        </div>
      </div>

      {/* Chart + Comparison */}
      <div className="col-span-12 lg:col-span-8 space-y-6">
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
        <div className="bg-surface-lowest border-l-4 border-primary p-6">
          <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-on-surface-variant block mb-4">
            Compounding Comparison
          </span>
          <div className="space-y-[1px]">
            <div className="grid grid-cols-6 gap-4 text-[9px] uppercase tracking-widest text-on-surface-variant font-bold bg-surface-high p-3">
              <span>Frequency</span>
              <span className="text-right">Final Value</span>
              <span className="text-right">Gross Return</span>
              <span className="text-right">Gas Costs</span>
              <span className="text-right">Net Return</span>
              <span className="text-right">Effective APY</span>
            </div>
            {comparison.map(({ frequency, result }) => (
              <div key={frequency} className="grid grid-cols-6 gap-4 text-[11px] bg-surface-low hover:bg-surface-high transition-all p-3 items-center">
                <span className="text-on-surface font-label font-bold">{frequency}</span>
                <span className="text-right text-on-surface">{formatCurrency(result.finalValue)}</span>
                <span className="text-right text-green-400">+{formatCurrency(result.grossReturn)}</span>
                <span className="text-right text-error">{result.totalGasCost > 0 ? `-${formatCurrency(result.totalGasCost)}` : "$0"}</span>
                <span className={`text-right font-bold ${result.netReturn >= 0 ? "text-green-400" : "text-error"}`}>
                  {result.netReturn >= 0 ? "+" : ""}{formatCurrency(result.netReturn)}
                </span>
                <span className="text-right text-primary font-bold">{result.effectiveApy.toFixed(2)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

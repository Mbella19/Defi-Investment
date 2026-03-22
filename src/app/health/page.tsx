"use client";

import { useState } from "react";
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { formatCurrency } from "@/lib/formatters";
import { CHART_COLORS, AXIS_STYLE, GRID_STYLE, TOOLTIP_STYLE, CHART_PALETTE, ChartContainer } from "@/components/ui/ChartTheme";

interface HealthData {
  protocol: { name: string; slug: string; category: string; chains: string[]; audits: string; description: string; url: string; twitter: string };
  tvlHistory: { date: string; tvl: number }[];
  poolHistories: { poolId: string; symbol: string; chain: string; data: { timestamp: string; apy: number; tvlUsd: number }[] }[];
  hacks: { date: string; amount: number; technique: string; name: string }[];
  metrics: { currentTvl: number; poolCount: number; avgApy: number; stablecoinPools: number; hackCount: number; totalHackLoss: number };
}

export default function HealthPage() {
  const [slug, setSlug] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<HealthData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = async () => {
    if (!slug.trim()) return;
    setLoading(true);
    setError(null);
    setData(null);

    try {
      const res = await fetch(`/api/health?slug=${encodeURIComponent(slug.trim())}`);
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to fetch");
      }
      setData(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch health data");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8">
      {/* Hero */}
      <section className="mb-8">
        <span className="font-label uppercase tracking-[0.3em] text-[10px] text-secondary-dim font-bold mb-4 block">
          Protocol Intelligence
        </span>
        <h2 className="font-headline text-5xl md:text-7xl font-light leading-none mb-4 tracking-tighter text-on-surface">
          Protocol <br />
          <span className="italic text-primary">Health.</span>
        </h2>
        <p className="font-body text-on-surface-variant max-w-xl text-sm leading-relaxed">
          Deep protocol health analysis with TVL history, APY trends, exploit timeline,
          and live metrics from DeFiLlama.
        </p>
      </section>

      {/* Search */}
      {!data && (
        <div className="max-w-xl space-y-4">
          <div className="bg-surface-lowest border-l-4 border-primary p-6">
            <label className="text-[9px] uppercase tracking-widest text-on-surface-variant font-bold block mb-2">
              Protocol Slug
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && fetchHealth()}
                placeholder="e.g. aave-v3, lido, curve-dex"
                className="flex-1 bg-surface-low border-b border-outline-variant/30 text-sm font-label px-4 py-3 focus:border-primary transition-colors outline-none text-on-surface placeholder:text-on-surface-variant"
              />
              <button
                onClick={fetchHealth}
                disabled={loading || !slug.trim()}
                className={`px-6 py-3 text-[10px] uppercase font-bold tracking-widest flex items-center gap-2 transition-all ${
                  loading ? "bg-surface-high text-on-surface-variant" : "bg-primary text-on-primary hover:bg-primary-dim"
                }`}
              >
                {loading ? (
                  <><div className="w-2 h-2 bg-primary animate-pulse" /> Loading...</>
                ) : (
                  <><span className="material-symbols-outlined text-sm">health_metrics</span> Analyze</>
                )}
              </button>
            </div>
          </div>
          {error && (
            <div className="bg-error-container/20 border-l-2 border-error p-4">
              <p className="text-error text-sm">{error}</p>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {["aave-v3", "lido", "curve-dex", "uniswap-v3", "compound-v3", "maker"].map((s) => (
              <button key={s} onClick={() => { setSlug(s); }} className="px-3 py-1.5 text-[10px] font-bold bg-surface-highest text-on-surface-variant hover:text-on-surface transition-all">
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {data && (
        <div className="space-y-8 animate-fade-in">
          {/* Protocol Header */}
          <div className="bg-surface-lowest border-l-4 border-primary p-8">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-headline text-3xl text-on-surface">{data.protocol.name}</h3>
                <p className="text-on-surface-variant text-[11px] mt-1">{data.protocol.category} &middot; {data.protocol.chains.join(", ")}</p>
                <p className="text-on-surface-variant text-[11px] mt-2 max-w-xl">{data.protocol.description?.slice(0, 200)}</p>
              </div>
              <div className="flex gap-2">
                <a href={data.protocol.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-white transition-all">
                  <span className="material-symbols-outlined">language</span>
                </a>
              </div>
            </div>
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-[1px] bg-surface">
            <div className="bg-surface-low p-6 text-center">
              <span className="text-[9px] uppercase tracking-widest text-on-surface-variant font-bold block mb-1">TVL</span>
              <span className="font-headline text-2xl text-primary">{formatCurrency(data.metrics.currentTvl)}</span>
            </div>
            <div className="bg-surface-low p-6 text-center">
              <span className="text-[9px] uppercase tracking-widest text-on-surface-variant font-bold block mb-1">Avg APY</span>
              <span className="font-headline text-2xl text-primary">{data.metrics.avgApy}%</span>
            </div>
            <div className="bg-surface-low p-6 text-center">
              <span className="text-[9px] uppercase tracking-widest text-on-surface-variant font-bold block mb-1">Pools</span>
              <span className="font-headline text-2xl text-on-surface">{data.metrics.poolCount}</span>
            </div>
            <div className="bg-surface-low p-6 text-center">
              <span className="text-[9px] uppercase tracking-widest text-on-surface-variant font-bold block mb-1">Audits</span>
              <span className="font-headline text-2xl text-on-surface">{data.protocol.audits}</span>
            </div>
            <div className="bg-surface-low p-6 text-center">
              <span className="text-[9px] uppercase tracking-widest text-on-surface-variant font-bold block mb-1">Exploits</span>
              <span className={`font-headline text-2xl ${data.metrics.hackCount > 0 ? "text-error" : "text-green-400"}`}>
                {data.metrics.hackCount}
              </span>
            </div>
          </div>

          {/* TVL History Chart */}
          {data.tvlHistory.length > 0 && (
            <ChartContainer title="TVL History" subtitle="Total Value Locked over time">
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={data.tvlHistory}>
                  <CartesianGrid {...GRID_STYLE} />
                  <XAxis dataKey="date" {...AXIS_STYLE} tickFormatter={(v) => v.slice(5)} />
                  <YAxis {...AXIS_STYLE} tickFormatter={(v) => `$${(v / 1e6).toFixed(0)}M`} />
                  <Tooltip {...TOOLTIP_STYLE} formatter={(value: unknown) => [formatCurrency(value as number), "TVL"]} />
                  <Area type="monotone" dataKey="tvl" stroke={CHART_COLORS.primary} fill={CHART_COLORS.primary} fillOpacity={0.1} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </ChartContainer>
          )}

          {/* APY History Chart */}
          {data.poolHistories.length > 0 && (
            <ChartContainer title="APY History" subtitle="Top pools APY over time">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart>
                  <CartesianGrid {...GRID_STYLE} />
                  <XAxis
                    dataKey="timestamp"
                    {...AXIS_STYLE}
                    tickFormatter={(v) => v ? new Date(v).toLocaleDateString("en", { month: "short", day: "numeric" }) : ""}
                    type="category"
                    allowDuplicatedCategory={false}
                  />
                  <YAxis {...AXIS_STYLE} tickFormatter={(v) => `${v}%`} />
                  <Tooltip {...TOOLTIP_STYLE} formatter={(value: unknown) => [`${(value as number).toFixed(2)}%`, "APY"]} />
                  <Legend wrapperStyle={{ fontSize: 10, fontFamily: "Inter" }} />
                  {data.poolHistories.map((ph, i) => (
                    <Line
                      key={ph.poolId}
                      data={ph.data.slice(-90)}
                      type="monotone"
                      dataKey="apy"
                      name={`${ph.symbol} (${ph.chain})`}
                      stroke={CHART_PALETTE[i]}
                      strokeWidth={2}
                      dot={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          )}

          {/* Hack Timeline */}
          {data.hacks.length > 0 && (
            <div className="bg-surface-low border-l-4 border-error p-8">
              <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-error mb-4 block">
                Exploit History ({data.hacks.length} incidents, {formatCurrency(data.metrics.totalHackLoss)} total)
              </span>
              <div className="space-y-4">
                {data.hacks.map((h, i) => (
                  <div key={i} className="flex gap-4 items-start">
                    <div className="w-3 h-3 bg-error shrink-0 mt-1" />
                    <div>
                      <span className="text-error text-sm font-label font-bold">{formatCurrency(h.amount)}</span>
                      <span className="text-on-surface-variant text-[11px] ml-2">via {h.technique}</span>
                      <span className="text-on-surface-variant text-[10px] block">
                        {new Date(h.date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.hacks.length === 0 && (
            <div className="bg-surface-low border-l-4 border-green-400/50 p-6">
              <span className="text-green-400 text-sm font-label font-bold flex items-center gap-2">
                <span className="material-symbols-outlined text-sm">verified</span>
                No recorded security exploits
              </span>
            </div>
          )}

          {/* Back */}
          <button
            onClick={() => { setData(null); setSlug(""); }}
            className="bg-primary text-on-primary px-8 py-3 text-[10px] uppercase font-bold tracking-widest hover:bg-primary-dim transition-all flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-sm">arrow_back</span>
            Analyze Another Protocol
          </button>
        </div>
      )}
    </div>
  );
}

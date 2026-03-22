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
    <div className="px-6 lg:px-10 py-12">
      {/* Hero */}
      <section className="mb-10">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-2 h-2 bg-[#00D4AA]" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#45515d]/70">
            Protocol Intelligence
          </span>
        </div>
        <h2 className="text-5xl font-black tracking-[-0.05em] leading-none mb-4 text-[#203241]">
          Protocol <br />
          <span className="italic text-[#00D4AA]">Health.</span>
        </h2>
        <p className="text-[#6b7781] max-w-xl text-sm leading-relaxed">
          Deep protocol health analysis with TVL history, APY trends, exploit timeline,
          and live metrics from DeFiLlama.
        </p>
      </section>

      {/* Search */}
      {!data && (
        <div className="max-w-xl space-y-6">
          <div className="bg-[#f2f3f5] border border-[#d7dade] p-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-2 h-2 bg-[#00D4AA]" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#45515d]/70">Search</span>
            </div>
            <label className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#45515d]/70 block mb-2">
              Protocol Slug
            </label>
            <div className="flex gap-3">
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && fetchHealth()}
                placeholder="e.g. aave-v3, lido, curve-dex"
                className="flex-1 bg-white border border-[#d7dade] text-sm px-4 py-3 focus:border-[#00D4AA] outline-none transition-colors text-[#203241] placeholder:text-[#6b7781]"
              />
              <button
                onClick={fetchHealth}
                disabled={loading || !slug.trim()}
                className={`group px-8 py-3 text-[11px] uppercase font-semibold tracking-[0.15em] flex items-center gap-2 transition-all duration-300 ${
                  loading ? "bg-[#ebedf0] text-[#6b7781]" : "bg-[#ff6c12] text-white hover:bg-[#e86210]"
                }`}
              >
                {loading ? (
                  <><div className="w-2 h-2 bg-[#00D4AA] animate-pulse" /> Loading...</>
                ) : (
                  <><span className="material-symbols-outlined text-sm">health_metrics</span> Analyze</>
                )}
              </button>
            </div>
          </div>
          {error && (
            <div className="bg-[#ff4d4d]/5 border border-[#ff4d4d]/20 p-4">
              <p className="text-[#ff4d4d] text-sm">{error}</p>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {["aave-v3", "lido", "curve-dex", "uniswap-v3", "compound-v3", "maker"].map((s) => (
              <button key={s} onClick={() => { setSlug(s); }} className="bg-[#ebedf0] text-[#43515d] hover:text-[#203241] px-3 py-1.5 text-[11px] transition-all duration-300">
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {data && (
        <div className="space-y-10 animate-fade-in">
          {/* Protocol Header */}
          <div className="bg-[#f2f3f5] border border-[#d7dade] p-10">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-4xl font-black tracking-[-0.05em] text-[#203241]">{data.protocol.name}</h3>
                <p className="text-[#6b7781] text-[13px] mt-2">{data.protocol.category} &middot; {data.protocol.chains.join(", ")}</p>
                <p className="text-[#6b7781] text-[13px] mt-3 max-w-xl leading-relaxed">{data.protocol.description?.slice(0, 200)}</p>
              </div>
              <div className="flex gap-2">
                <a href={data.protocol.url} target="_blank" rel="noopener noreferrer" className="text-[#00D4AA] hover:text-[#203241] transition-all duration-300">
                  <span className="material-symbols-outlined">language</span>
                </a>
              </div>
            </div>
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-white border border-[#d7dade] p-8 text-center">
              <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#45515d]/70 block mb-2">TVL</span>
              <span className="text-[42px] font-black text-[#00D4AA]">{formatCurrency(data.metrics.currentTvl)}</span>
            </div>
            <div className="bg-white border border-[#d7dade] p-8 text-center">
              <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#45515d]/70 block mb-2">Avg APY</span>
              <span className="text-[42px] font-black text-[#00D4AA]">{data.metrics.avgApy}%</span>
            </div>
            <div className="bg-white border border-[#d7dade] p-8 text-center">
              <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#45515d]/70 block mb-2">Pools</span>
              <span className="text-[42px] font-black text-[#203241]">{data.metrics.poolCount}</span>
            </div>
            <div className="bg-white border border-[#d7dade] p-8 text-center">
              <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#45515d]/70 block mb-2">Audits</span>
              <span className="text-[42px] font-black text-[#203241]">{data.protocol.audits}</span>
            </div>
            <div className="bg-white border border-[#d7dade] p-8 text-center">
              <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#45515d]/70 block mb-2">Exploits</span>
              <span className={`text-[42px] font-black ${data.metrics.hackCount > 0 ? "text-[#ff4d4d]" : "text-[#00D4AA]"}`}>
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
            <div className="border border-[#ff4d4d]/20 bg-[#ff4d4d]/5 p-10">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-2 h-2 bg-[#ff4d4d]" />
                <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#ff4d4d]">
                  Exploit History ({data.hacks.length} incidents, {formatCurrency(data.metrics.totalHackLoss)} total)
                </span>
              </div>
              <div className="space-y-5">
                {data.hacks.map((h, i) => (
                  <div key={i} className="flex gap-4 items-start border-t border-[#ff4d4d]/10 pt-5 first:border-0 first:pt-0">
                    <div className="w-2 h-2 bg-[#ff4d4d] shrink-0 mt-1.5" />
                    <div>
                      <span className="text-[#ff4d4d] text-sm font-bold">{formatCurrency(h.amount)}</span>
                      <span className="text-[#6b7781] text-[13px] ml-2">via {h.technique}</span>
                      <span className="text-[#6b7781] text-[11px] block mt-1">
                        {new Date(h.date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.hacks.length === 0 && (
            <div className="border border-[#00D4AA]/20 bg-[#00D4AA]/5 p-8">
              <span className="text-[#00D4AA] text-sm font-semibold flex items-center gap-3">
                <span className="material-symbols-outlined text-sm">verified</span>
                No recorded security exploits
              </span>
            </div>
          )}

          {/* Back */}
          <button
            onClick={() => { setData(null); setSlug(""); }}
            className="group bg-[#ff6c12] text-white px-8 py-4 text-[11px] uppercase font-semibold tracking-[0.15em] hover:bg-[#e86210] transition-all duration-300 flex items-center gap-3"
          >
            <span className="material-symbols-outlined text-sm">arrow_back</span>
            Analyze Another Protocol
            <span className="inline-block transition-transform duration-300 group-hover:translate-x-1">&rarr;</span>
          </button>
        </div>
      )}
    </div>
  );
}

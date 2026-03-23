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
  // Enrichment data (optional)
  tokenMarketData?: { geckoId: string; priceUsd: number; marketCap: number; volume24h: number; priceChange24h: number | null; priceChange7d: number | null; priceChange30d: number | null; developerActivity: number | null } | null;
  priceHistory?: { timestamp: number; price: number }[];
  securityData?: { securityScore: number; riskLevel: string; flags: string[]; isOpenSource: boolean | null; isHoneypot: boolean | null; isMintable: boolean | null; isProxy: boolean | null; holderCount: number | null; buyTax: number | null; sellTax: number | null } | null;
  beefyVaults?: { id: string; apy: number | null; tvlUsd: number | null }[];
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
    <div className="px-4 sm:px-6 lg:px-10 py-8 sm:py-12">
      {/* Hero */}
      <section className="mb-10">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-2 h-2 bg-accent" />
          <span className="text-[13px] font-semibold uppercase tracking-[0.2em] text-label/70">
            Protocol Intelligence
          </span>
        </div>
        <h2 className="text-5xl font-black tracking-[-0.05em] leading-none mb-4 text-on-surface">
          Protocol <br />
          <span className="italic text-accent">Health.</span>
        </h2>
        <p className="text-muted max-w-xl text-sm leading-relaxed">
          Deep protocol health analysis with TVL history, APY trends, exploit timeline,
          and live metrics. Powered by DeFiLlama, CoinGecko, GoPlus Security, and Beefy Finance.
        </p>
      </section>

      {/* Search */}
      {!data && (
        <div className="max-w-xl space-y-6">
          <div className="bg-surface-low border border-outline p-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-2 h-2 bg-accent" />
              <span className="text-[13px] font-semibold uppercase tracking-[0.2em] text-label/70">Search</span>
            </div>
            <label className="text-[13px] font-semibold uppercase tracking-[0.2em] text-label/70 block mb-2">
              Protocol Slug
            </label>
            <div className="flex gap-3">
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && fetchHealth()}
                placeholder="e.g. aave-v3, lido, curve-dex"
                className="flex-1 bg-surface-highest border border-outline text-sm px-4 py-3 focus:border-accent outline-none transition-colors text-on-surface placeholder:text-muted"
              />
              <button
                onClick={fetchHealth}
                disabled={loading || !slug.trim()}
                className={`group px-8 py-3 text-[13px] uppercase font-semibold tracking-[0.12em] flex items-center gap-2 transition-all duration-300 ${
                  loading ? "bg-surface-container text-muted" : "bg-cta text-white hover:bg-[#e86210]"
                }`}
              >
                {loading ? (
                  <><div className="w-2 h-2 bg-accent animate-pulse" /> Loading...</>
                ) : (
                  <><span className="material-symbols-outlined text-sm">health_metrics</span> Analyze</>
                )}
              </button>
            </div>
          </div>
          {error && (
            <div className="bg-danger/5 border border-danger/20 p-4">
              <p className="text-danger text-sm">{error}</p>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {["aave-v3", "lido", "curve-dex", "uniswap-v3", "compound-v3", "maker"].map((s) => (
              <button key={s} onClick={() => { setSlug(s); }} className="bg-surface-container text-on-surface-variant hover:text-on-surface px-3 py-1.5 text-[13px] transition-all duration-300">
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
          <div className="bg-surface-low border border-outline p-10">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-4xl font-black tracking-[-0.05em] text-on-surface">{data.protocol.name}</h3>
                <p className="text-muted text-[13px] mt-2">{data.protocol.category} &middot; {data.protocol.chains.join(", ")}</p>
                <p className="text-muted text-[13px] mt-3 max-w-xl leading-relaxed">{data.protocol.description?.slice(0, 200)}</p>
              </div>
              <div className="flex gap-2">
                <a href={data.protocol.url} target="_blank" rel="noopener noreferrer" className="text-accent hover:text-on-surface transition-all duration-300">
                  <span className="material-symbols-outlined">language</span>
                </a>
              </div>
            </div>
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4">
            <div className="bg-surface-highest border border-outline p-4 sm:p-8 text-center">
              <span className="text-[13px] font-semibold uppercase tracking-[0.2em] text-label/70 block mb-2">TVL</span>
              <span className="text-2xl sm:text-[42px] font-black text-accent">{formatCurrency(data.metrics.currentTvl)}</span>
            </div>
            <div className="bg-surface-highest border border-outline p-8 text-center">
              <span className="text-[13px] font-semibold uppercase tracking-[0.2em] text-label/70 block mb-2">Avg APY</span>
              <span className="text-[42px] font-black text-accent">{data.metrics.avgApy}%</span>
            </div>
            <div className="bg-surface-highest border border-outline p-8 text-center">
              <span className="text-[13px] font-semibold uppercase tracking-[0.2em] text-label/70 block mb-2">Pools</span>
              <span className="text-[42px] font-black text-on-surface">{data.metrics.poolCount}</span>
            </div>
            <div className="bg-surface-highest border border-outline p-8 text-center">
              <span className="text-[13px] font-semibold uppercase tracking-[0.2em] text-label/70 block mb-2">Audits</span>
              <span className="text-[42px] font-black text-on-surface">{data.protocol.audits}</span>
            </div>
            <div className="bg-surface-highest border border-outline p-8 text-center">
              <span className="text-[13px] font-semibold uppercase tracking-[0.2em] text-label/70 block mb-2">Exploits</span>
              <span className={`text-[42px] font-black ${data.metrics.hackCount > 0 ? "text-danger" : "text-accent"}`}>
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
            <div className="border border-danger/20 bg-danger/5 p-10">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-2 h-2 bg-danger" />
                <span className="text-[13px] font-semibold uppercase tracking-[0.2em] text-danger">
                  Exploit History ({data.hacks.length} incidents, {formatCurrency(data.metrics.totalHackLoss)} total)
                </span>
              </div>
              <div className="space-y-5">
                {data.hacks.map((h, i) => (
                  <div key={i} className="flex gap-4 items-start border-t border-danger/10 pt-5 first:border-0 first:pt-0">
                    <div className="w-2 h-2 bg-danger shrink-0 mt-1.5" />
                    <div>
                      <span className="text-danger text-sm font-bold">{formatCurrency(h.amount)}</span>
                      <span className="text-muted text-[13px] ml-2">via {h.technique}</span>
                      <span className="text-muted text-[13px] block mt-1">
                        {new Date(h.date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.hacks.length === 0 && (
            <div className="border border-accent/20 bg-accent/5 p-8">
              <span className="text-accent text-sm font-semibold flex items-center gap-3">
                <span className="material-symbols-outlined text-sm">verified</span>
                No recorded security exploits
              </span>
            </div>
          )}

          {/* Token Market Data (CoinGecko) */}
          {data.tokenMarketData && (
            <div className="bg-surface-low border border-outline p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-2 h-2 bg-accent" />
                <span className="text-[13px] font-semibold uppercase tracking-[0.2em] text-label/70">
                  Token Market Data
                </span>
                <span className="text-xs text-muted ml-auto">via CoinGecko</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <span className="text-[13px] text-label/70 block mb-1">Price</span>
                  <span className="text-xl font-black text-on-surface">${data.tokenMarketData.priceUsd.toFixed(4)}</span>
                </div>
                <div>
                  <span className="text-[13px] text-label/70 block mb-1">Market Cap</span>
                  <span className="text-xl font-black text-on-surface">{formatCurrency(data.tokenMarketData.marketCap)}</span>
                </div>
                <div>
                  <span className="text-[13px] text-label/70 block mb-1">24h Volume</span>
                  <span className="text-xl font-black text-on-surface">{formatCurrency(data.tokenMarketData.volume24h)}</span>
                </div>
                <div>
                  <span className="text-[13px] text-label/70 block mb-1">24h Change</span>
                  <span className={`text-xl font-black ${(data.tokenMarketData.priceChange24h ?? 0) >= 0 ? "text-accent" : "text-danger"}`}>
                    {(data.tokenMarketData.priceChange24h ?? 0) > 0 ? "+" : ""}{(data.tokenMarketData.priceChange24h ?? 0).toFixed(2)}%
                  </span>
                </div>
              </div>
              {(data.tokenMarketData.priceChange7d !== null || data.tokenMarketData.priceChange30d !== null || data.tokenMarketData.developerActivity !== null) && (
                <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-outline">
                  {data.tokenMarketData.priceChange7d !== null && (
                    <div>
                      <span className="text-[13px] text-label/70 block mb-1">7d Change</span>
                      <span className={`text-sm font-bold ${data.tokenMarketData.priceChange7d >= 0 ? "text-accent" : "text-danger"}`}>
                        {data.tokenMarketData.priceChange7d > 0 ? "+" : ""}{data.tokenMarketData.priceChange7d.toFixed(2)}%
                      </span>
                    </div>
                  )}
                  {data.tokenMarketData.priceChange30d !== null && (
                    <div>
                      <span className="text-[13px] text-label/70 block mb-1">30d Change</span>
                      <span className={`text-sm font-bold ${data.tokenMarketData.priceChange30d >= 0 ? "text-accent" : "text-danger"}`}>
                        {data.tokenMarketData.priceChange30d > 0 ? "+" : ""}{data.tokenMarketData.priceChange30d.toFixed(2)}%
                      </span>
                    </div>
                  )}
                  {data.tokenMarketData.developerActivity !== null && (
                    <div>
                      <span className="text-[13px] text-label/70 block mb-1">Dev Activity</span>
                      <span className="text-sm font-bold text-on-surface">{data.tokenMarketData.developerActivity} commits/4w</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Token Price Chart (CoinGecko) */}
          {data.priceHistory && data.priceHistory.length > 0 && (
            <ChartContainer title="Token Price (30d)" subtitle="Historical price via CoinGecko">
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={data.priceHistory}>
                  <CartesianGrid {...GRID_STYLE} />
                  <XAxis dataKey="timestamp" {...AXIS_STYLE} tickFormatter={(v) => new Date(v).toLocaleDateString("en", { month: "short", day: "numeric" })} />
                  <YAxis {...AXIS_STYLE} tickFormatter={(v) => `$${v.toFixed(2)}`} domain={["auto", "auto"]} />
                  <Tooltip {...TOOLTIP_STYLE} labelFormatter={(v) => new Date(v as number).toLocaleDateString()} formatter={(value: unknown) => [`$${(value as number).toFixed(4)}`, "Price"]} />
                  <Area type="monotone" dataKey="price" stroke={CHART_PALETTE[1]} fill={CHART_PALETTE[1]} fillOpacity={0.1} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </ChartContainer>
          )}

          {/* Contract Security (GoPlus) */}
          {data.securityData && (
            <div className="bg-surface-low border border-outline p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-2 h-2 bg-accent" />
                <span className="text-[13px] font-semibold uppercase tracking-[0.2em] text-label/70">
                  Contract Security
                </span>
                <span className="text-xs text-muted ml-auto">via GoPlus</span>
              </div>
              <div className="flex items-center gap-6 mb-6">
                <div className="text-center">
                  <span className={`text-[42px] font-black ${
                    data.securityData.securityScore >= 70 ? "text-accent" : data.securityData.securityScore >= 40 ? "text-cta" : "text-danger"
                  }`}>
                    {data.securityData.securityScore}
                  </span>
                  <span className="block text-[13px] font-semibold uppercase tracking-[0.2em] text-label/70 mt-1">/100</span>
                </div>
                <span className={`px-4 py-2 text-[13px] font-semibold uppercase tracking-[0.12em] ${
                  data.securityData.riskLevel === "safe" ? "bg-accent/10 text-accent"
                  : data.securityData.riskLevel === "warning" ? "bg-cta/10 text-cta"
                  : "bg-danger/10 text-danger"
                }`}>
                  {data.securityData.riskLevel}
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "Open Source", value: data.securityData.isOpenSource, good: true },
                  { label: "Honeypot", value: data.securityData.isHoneypot, good: false },
                  { label: "Mintable", value: data.securityData.isMintable, good: false },
                  { label: "Proxy", value: data.securityData.isProxy, good: false },
                ].map((item) => (
                  <div key={item.label} className="border border-outline p-3">
                    <span className="text-xs text-label/70 block mb-1">{item.label}</span>
                    <span className={`text-sm font-bold ${
                      item.value === null ? "text-muted" :
                      (item.good ? item.value : !item.value) ? "text-accent" : "text-danger"
                    }`}>
                      {item.value === null ? "N/A" : item.value ? "Yes" : "No"}
                    </span>
                  </div>
                ))}
              </div>
              {data.securityData.flags.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {data.securityData.flags.map((flag, i) => (
                    <span key={i} className="text-xs text-danger bg-danger/10 border border-danger/20 px-3 py-1">
                      {flag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Beefy Vaults */}
          {data.beefyVaults && data.beefyVaults.length > 0 && (
            <div className="bg-surface-low border border-outline p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-2 h-2 bg-accent" />
                <span className="text-[13px] font-semibold uppercase tracking-[0.2em] text-label/70">
                  Beefy Auto-Compound Vaults
                </span>
                <span className="text-xs text-muted ml-auto">via Beefy Finance</span>
              </div>
              <div className="space-y-2">
                {data.beefyVaults.map((v) => (
                  <div key={v.id} className="flex flex-col sm:flex-row sm:items-center justify-between border border-outline p-4 gap-2 hover:border-accent/30 transition-all duration-300">
                    <div className="flex items-center flex-wrap gap-2">
                      <span className="text-sm font-bold text-on-surface break-all">{v.id}</span>
                      <span className="text-xs text-accent bg-accent/10 px-2 py-0.5">AUTO-COMPOUND</span>
                    </div>
                    <div className="flex items-center gap-4 sm:gap-6">
                      {v.tvlUsd !== null && (
                        <span className="text-[13px] text-muted">TVL: {formatCurrency(v.tvlUsd)}</span>
                      )}
                      {v.apy !== null && (
                        <span className="text-sm font-black text-accent">{v.apy.toFixed(2)}%</span>
                      )}
                      <a
                        href={`https://app.beefy.com/vault/${v.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs uppercase font-semibold tracking-[0.12em] text-cta hover:text-cta/80 transition-colors"
                      >
                        Open &rarr;
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Back */}
          <button
            onClick={() => { setData(null); setSlug(""); }}
            className="group bg-cta text-white px-8 py-4 text-[13px] uppercase font-semibold tracking-[0.12em] hover:bg-[#e86210] transition-all duration-300 flex items-center gap-3"
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

"use client";

import { useMemo, useState } from "react";
import { Filter, Search, SlidersHorizontal, Sparkles } from "lucide-react";
import {
  ChainBadge,
  CommandStrip,
  MarketRow,
  MetricTile,
  RiskPill,
} from "@/components/site/ui";
import {
  chainIdFromName,
  chainMeta,
  chainOrder,
  formatPct,
  formatUsd,
  riskBandFor,
  safetyScore,
  type ChainId,
  type MarketCategory,
  type RiskBand,
} from "@/lib/design-utils";
import { useLiveYields, formatRefreshAge } from "@/hooks/useLiveYields";
import type { LivePool } from "@/app/api/yields/live/route";

const CATEGORIES: Array<MarketCategory | "All"> = ["All", "Lending", "LST", "LP", "Yield", "Synth"];
const RISKS: Array<RiskBand | "All"> = ["All", "Conservative", "Balanced", "Asymmetric"];

interface MarketView {
  id: string;
  symbol: string;
  protocol: string;
  chain: ChainId;
  category: MarketCategory;
  tvl: number;
  apy: number;
  apy7d: number | null;
  safety: number;
  capacity: number;
  poolId: string;
  rawCategory: string;
}

function toMarketView(pool: LivePool): MarketView {
  const safety = safetyScore({
    tvlUsd: pool.tvlUsd,
    apy: pool.apy,
    apyPct30D: pool.apyPct30D,
    stablecoin: pool.stablecoin,
    category: pool.category,
  });
  // Simple capacity proxy: bigger pools have more headroom for fresh capital.
  const capacity = Math.min(
    98,
    Math.max(18, Math.round(Math.log10(Math.max(1e6, pool.tvlUsd)) * 14)),
  );
  return {
    id: pool.poolId,
    symbol: pool.symbol,
    protocol: pool.protocol,
    chain: chainIdFromName(pool.chain),
    category: (CATEGORIES.includes(pool.category as MarketCategory) ? pool.category : "Yield") as MarketCategory,
    tvl: pool.tvlUsd,
    apy: pool.apy,
    apy7d: pool.apyPct7D,
    safety,
    capacity,
    poolId: pool.poolId,
    rawCategory: pool.category,
  };
}

export default function DiscoverPage() {
  const { data, loading, error, fetchedAt } = useLiveYields();
  const [query, setQuery] = useState("");
  const [chain, setChain] = useState<ChainId | "All">("All");
  const [category, setCategory] = useState<MarketCategory | "All">("All");
  const [risk, setRisk] = useState<RiskBand | "All">("All");

  const allViews = useMemo(() => (data?.pools ?? []).map(toMarketView), [data?.pools]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allViews.filter((m) => {
      const matchesQuery =
        !q ||
        m.symbol.toLowerCase().includes(q) ||
        m.protocol.toLowerCase().includes(q) ||
        m.category.toLowerCase().includes(q);
      return (
        matchesQuery &&
        (chain === "All" || m.chain === chain) &&
        (category === "All" || m.category === category) &&
        (risk === "All" || riskBandFor({ safety: m.safety, apy: m.apy }) === risk)
      );
    });
  }, [allViews, query, chain, category, risk]);

  const totalTvl = filtered.reduce((sum, m) => sum + m.tvl, 0);
  const avgApy = filtered.length > 0 ? filtered.reduce((sum, m) => sum + m.apy, 0) / filtered.length : 0;
  const avgSafety = filtered.length > 0
    ? filtered.reduce((sum, m) => sum + m.safety, 0) / filtered.length
    : 0;

  const visibleChains = chainOrder.filter((id) => allViews.some((m) => m.chain === id));

  return (
    <div className="page">
      <div className="page-title">
        <div>
          <p className="eyebrow">Markets</p>
          <h1>The DeFi market, curated.</h1>
          <p>
            Thousands of yield opportunities, filtered down to the ones worth your time.
            Sortable by chain, asset class, depth, and stability — every line carries a
            risk band so you know what you&apos;re looking at before you click in.
          </p>
        </div>
      </div>

      <CommandStrip
        file="file/02.markets"
        items={[
          {
            label: "scanner",
            value: error ? "stale" : loading && !data ? "syncing" : "live",
            tone: error ? "danger" : loading && !data ? "warn" : "ok",
          },
          {
            label: "pools",
            value: data ? data.poolCount.toLocaleString() : "…",
            tone: "info",
          },
          {
            label: "refreshed",
            value: fetchedAt ? formatRefreshAge(fetchedAt) : loading ? "fetching" : "—",
            tone: "warn",
          },
        ]}
      />

      <div className="metric-grid" style={{ marginBottom: 18 }}>
        <MetricTile label="Visible markets" value={String(filtered.length)} icon={Filter} tone="#60a5fa" />
        <MetricTile label="Screened TVL" value={formatUsd(totalTvl)} icon={Sparkles} tone="#6ee7b7" />
        <MetricTile label="Average APY" value={formatPct(avgApy)} icon={SlidersHorizontal} tone="#fbbf24" />
        <MetricTile label="Safety mean" value={avgSafety > 0 ? avgSafety.toFixed(0) : "—"} icon={Search} tone="#fb7185" />
      </div>

      <div className="page-tools">
        <input
          className="search-input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search market, protocol, or type"
          aria-label="Search markets"
        />
        <div className="filter-row">
          <select
            className="select-input"
            value={chain}
            onChange={(event) => setChain(event.target.value as ChainId | "All")}
          >
            <option value="All">All chains</option>
            {visibleChains.map((id) => (
              <option key={id} value={id}>
                {chainMeta[id].name}
              </option>
            ))}
          </select>
          <select
            className="select-input"
            value={category}
            onChange={(event) => setCategory(event.target.value as MarketCategory | "All")}
          >
            {CATEGORIES.map((item) => (
              <option key={item} value={item}>
                {item === "All" ? "All categories" : item}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="filter-row" style={{ marginBottom: 18 }}>
        {RISKS.map((item) => (
          <button
            key={item}
            type="button"
            className={`chip-button ${risk === item ? "active" : ""}`}
            onClick={() => setRisk(item)}
          >
            {item}
          </button>
        ))}
      </div>

      {error && filtered.length === 0 ? (
        <div className="empty-state">
          <Filter size={28} aria-hidden="true" />
          <strong>Live feed unavailable</strong>
          <span>{error}. Cached results will reappear once the upstream is reachable.</span>
        </div>
      ) : filtered.length === 0 && loading ? (
        <div className="empty-state">
          <Sparkles size={28} aria-hidden="true" />
          <strong>Pulling live pools…</strong>
          <span>Market scanner is syncing — should take a few seconds.</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <SlidersHorizontal size={28} aria-hidden="true" />
          <strong>No markets match these filters</strong>
          <span>Broaden the chain, category, or risk band to widen the shelf.</span>
        </div>
      ) : (
        <div className="markets-table">
          {filtered.slice(0, 80).map((market) => (
            <MarketRow
              key={market.id}
              market={{
                symbol: market.symbol,
                protocol: market.protocol,
                chain: market.chain,
                category: market.category,
                tvl: market.tvl,
                apy: market.apy,
                apy7d: market.apy7d,
                safety: market.safety,
                href: `https://defillama.com/yields/pool/${market.poolId}`,
              }}
            />
          ))}
        </div>
      )}

      {filtered.length > 0 ? (
        <section className="section-band" style={{ width: "100%", marginTop: 34 }}>
          <div className="module-grid">
            {filtered.slice(0, 4).map((market) => (
              <div className="allocation-card" key={`spotlight-${market.id}`}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <ChainBadge chain={market.chain} />
                  <RiskPill risk={riskBandFor({ safety: market.safety, apy: market.apy })} />
                </div>
                <h3>{market.protocol}</h3>
                <p>
                  {market.symbol} offers {formatPct(market.apy)} with {formatUsd(market.tvl)} in
                  screened liquidity.
                </p>
                <div
                  style={{ marginTop: 18 }}
                  className="capacity-track"
                  aria-label={`${market.capacity}% capacity`}
                >
                  <i style={{ width: `${market.capacity}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

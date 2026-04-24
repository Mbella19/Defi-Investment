"use client";

import { useMemo, useState } from "react";
import { Eyebrow, Icons, fmt } from "@/components/sovereign";

interface HealthData {
  protocol: {
    name: string;
    slug: string;
    category: string;
    chains: string[];
    audits: string;
    description: string;
    url: string;
    twitter: string;
  };
  tvlHistory: { date: string; tvl: number }[];
  poolHistories: {
    poolId: string;
    symbol: string;
    chain: string;
    data: { timestamp: string; apy: number; tvlUsd: number }[];
  }[];
  hacks: { date: string; amount: number; technique: string; name: string }[];
  metrics: {
    currentTvl: number;
    poolCount: number;
    avgApy: number;
    stablecoinPools: number;
    hackCount: number;
    totalHackLoss: number;
  };
  tokenMarketData?: {
    geckoId: string;
    priceUsd: number;
    marketCap: number;
    volume24h: number;
    priceChange24h: number | null;
    priceChange7d: number | null;
    priceChange30d: number | null;
    developerActivity: number | null;
  } | null;
  priceHistory?: { timestamp: number; price: number }[];
  securityData?: {
    securityScore: number;
    riskLevel: string;
    flags: string[];
    isOpenSource: boolean | null;
    isHoneypot: boolean | null;
    isMintable: boolean | null;
    isProxy: boolean | null;
    holderCount: number | null;
    buyTax: number | null;
    sellTax: number | null;
  } | null;
  beefyVaults?: { id: string; apy: number | null; tvlUsd: number | null }[];
}

const PRESETS = ["aave-v3", "lido", "curve-dex", "uniswap-v3", "compound-v3", "maker"];

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
    <div style={{ padding: "48px 32px", maxWidth: 1280, margin: "0 auto" }}>
      <Hero />

      {!data && (
        <SearchPanel
          slug={slug}
          setSlug={setSlug}
          loading={loading}
          error={error}
          onSubmit={fetchHealth}
        />
      )}

      {data && <HealthReport data={data} onReset={() => { setData(null); setSlug(""); }} />}
    </div>
  );
}

function Hero() {
  return (
    <section style={{ marginBottom: 48 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 48, alignItems: "end" }}>
        <div>
          <Eyebrow>Protocol Intelligence</Eyebrow>
          <h1
            className="serif"
            style={{
              fontSize: "clamp(48px, 7vw, 96px)",
              lineHeight: 0.92,
              letterSpacing: "-0.04em",
              marginTop: 20,
              marginBottom: 20,
            }}
          >
            Protocol
            <br />
            <span style={{ fontStyle: "italic", color: "var(--accent)" }}>health.</span>
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-dim)", maxWidth: 560, lineHeight: 1.6 }}>
            Deep protocol vitals across TVL, APY, exploit history, and live token signals. Merged from DeFiLlama,
            CoinGecko, GoPlus Security, and Beefy Finance.
          </p>
        </div>
        <div
          className="brackets"
          style={{
            border: "1px solid var(--line)",
            background: "var(--surface)",
            padding: 20,
            minWidth: 240,
          }}
        >
          <Eyebrow>Data Sources</Eyebrow>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 1,
              marginTop: 12,
              background: "var(--line)",
              border: "1px solid var(--line)",
            }}
          >
            {[
              ["DEFILLAMA", "TVL / APY"],
              ["COINGECKO", "MARKET"],
              ["GOPLUS", "SECURITY"],
              ["BEEFY", "VAULTS"],
            ].map(([src, tag]) => (
              <div key={src} style={{ background: "var(--surface)", padding: "10px 12px" }}>
                <div
                  className="mono"
                  style={{
                    fontSize: 9,
                    letterSpacing: "0.18em",
                    color: "var(--accent)",
                    textTransform: "uppercase",
                  }}
                >
                  {src}
                </div>
                <div
                  className="mono"
                  style={{
                    fontSize: 10,
                    color: "var(--text-dim)",
                    marginTop: 4,
                    letterSpacing: "0.1em",
                  }}
                >
                  {tag}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function SearchPanel({
  slug,
  setSlug,
  loading,
  error,
  onSubmit,
}: {
  slug: string;
  setSlug: (s: string) => void;
  loading: boolean;
  error: string | null;
  onSubmit: () => void;
}) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 720 }}>
      <div
        className="brackets"
        style={{ border: "1px solid var(--line)", background: "var(--surface)", padding: 28 }}
      >
        <Eyebrow>Query</Eyebrow>
        <label
          className="mono"
          style={{
            fontSize: 10,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "var(--text-dim)",
            marginTop: 16,
            marginBottom: 8,
            display: "block",
          }}
        >
          Protocol Slug
        </label>
        <div style={{ display: "flex", gap: 12 }}>
          <input
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onSubmit()}
            placeholder="aave-v3, lido, curve-dex…"
            className="mono"
            style={{
              flex: 1,
              background: "var(--surface-2)",
              border: "1px solid var(--line)",
              padding: "14px 16px",
              fontSize: 13,
              color: "var(--text)",
              outline: "none",
              letterSpacing: "0.02em",
            }}
          />
          <button
            onClick={onSubmit}
            disabled={loading || !slug.trim()}
            className="mono"
            style={{
              padding: "14px 28px",
              background: loading || !slug.trim() ? "var(--surface-2)" : "var(--accent)",
              color: loading || !slug.trim() ? "var(--text-dim)" : "var(--bg)",
              border: `1px solid ${loading || !slug.trim() ? "var(--line)" : "var(--accent)"}`,
              fontSize: 10,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              fontWeight: 600,
              cursor: loading || !slug.trim() ? "not-allowed" : "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            {loading ? (
              <>
                <span
                  style={{
                    width: 6,
                    height: 6,
                    background: "var(--text-dim)",
                    animation: "blink 1s ease-in-out infinite",
                  }}
                />
                Analyzing
              </>
            ) : (
              <>
                <Icons.search />
                Analyze
              </>
            )}
          </button>
        </div>
        <div style={{ marginTop: 20 }}>
          <Eyebrow>Presets</Eyebrow>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
            {PRESETS.map((p) => (
              <button
                key={p}
                onClick={() => setSlug(p)}
                className="mono"
                style={{
                  padding: "8px 12px",
                  background: slug === p ? "var(--accent)" : "var(--surface-2)",
                  color: slug === p ? "var(--bg)" : "var(--text-dim)",
                  border: `1px solid ${slug === p ? "var(--accent)" : "var(--line)"}`,
                  fontSize: 10,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  cursor: "pointer",
                }}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div
          style={{
            border: "1px solid var(--danger)",
            background: "color-mix(in oklab, var(--danger) 10%, transparent)",
            padding: 14,
            color: "var(--danger)",
            fontSize: 12,
          }}
        >
          {error}
        </div>
      )}
    </section>
  );
}

function HealthReport({ data, onReset }: { data: HealthData; onReset: () => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      <ProtocolHeader protocol={data.protocol} onReset={onReset} />
      <MetricsGrid metrics={data.metrics} audits={data.protocol.audits} />
      {data.tvlHistory.length > 0 && <TvlChart history={data.tvlHistory} />}
      {data.poolHistories.length > 0 && <ApyChart pools={data.poolHistories} />}
      <ExploitPanel hacks={data.hacks} totalLoss={data.metrics.totalHackLoss} />
      {data.tokenMarketData && <TokenMarket tm={data.tokenMarketData} />}
      {data.priceHistory && data.priceHistory.length > 0 && <PriceChart prices={data.priceHistory} />}
      {data.securityData && <SecurityPanel sec={data.securityData} />}
      {data.beefyVaults && data.beefyVaults.length > 0 && <BeefyVaults vaults={data.beefyVaults} />}
    </div>
  );
}

function ProtocolHeader({
  protocol,
  onReset,
}: {
  protocol: HealthData["protocol"];
  onReset: () => void;
}) {
  return (
    <div
      className="brackets"
      style={{ border: "1px solid var(--line)", background: "var(--surface)", padding: 32 }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <Eyebrow>Protocol</Eyebrow>
          <h2
            className="serif"
            style={{
              fontSize: "clamp(36px, 5vw, 56px)",
              lineHeight: 0.95,
              letterSpacing: "-0.03em",
              marginTop: 12,
            }}
          >
            {protocol.name}
          </h2>
          <div
            className="mono"
            style={{
              fontSize: 11,
              color: "var(--text-dim)",
              marginTop: 10,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}
          >
            {protocol.category} · {protocol.chains.slice(0, 4).join(" / ")}
            {protocol.chains.length > 4 ? ` +${protocol.chains.length - 4}` : ""}
          </div>
          {protocol.description && (
            <p
              style={{
                fontSize: 13,
                color: "var(--text-dim)",
                maxWidth: 560,
                marginTop: 16,
                lineHeight: 1.6,
              }}
            >
              {protocol.description.slice(0, 220)}
              {protocol.description.length > 220 ? "…" : ""}
            </p>
          )}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {protocol.url && (
            <a
              href={protocol.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mono"
              style={{
                padding: "10px 16px",
                background: "var(--surface-2)",
                border: "1px solid var(--line)",
                color: "var(--accent)",
                fontSize: 10,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                textDecoration: "none",
              }}
            >
              Website ↗
            </a>
          )}
          <button
            onClick={onReset}
            className="mono"
            style={{
              padding: "10px 16px",
              background: "var(--surface-2)",
              border: "1px solid var(--line)",
              color: "var(--text-dim)",
              fontSize: 10,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Icons.refresh />
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}

function MetricsGrid({
  metrics,
  audits,
}: {
  metrics: HealthData["metrics"];
  audits: string;
}) {
  const cells = [
    { label: "TVL", value: fmt.money(metrics.currentTvl), tone: "accent" },
    { label: "Avg APY", value: fmt.apy(metrics.avgApy), tone: "accent" },
    { label: "Pools", value: String(metrics.poolCount), tone: "text" },
    { label: "Audits", value: audits || "—", tone: "text" },
    {
      label: "Exploits",
      value: String(metrics.hackCount),
      tone: metrics.hackCount > 0 ? "danger" : "good",
    },
  ];
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(5, 1fr)",
        gap: 1,
        background: "var(--line)",
        border: "1px solid var(--line)",
      }}
    >
      {cells.map((c) => (
        <div
          key={c.label}
          style={{
            background: "var(--surface)",
            padding: "28px 24px",
          }}
        >
          <Eyebrow>{c.label}</Eyebrow>
          <div
            className="serif tabular"
            style={{
              fontSize: 36,
              marginTop: 12,
              letterSpacing: "-0.02em",
              color:
                c.tone === "accent"
                  ? "var(--accent)"
                  : c.tone === "danger"
                  ? "var(--danger)"
                  : c.tone === "good"
                  ? "var(--good)"
                  : "var(--text)",
            }}
          >
            {c.value}
          </div>
        </div>
      ))}
    </div>
  );
}

function AreaSvg({
  points,
  height = 220,
  color = "var(--accent)",
}: {
  points: { x: number; y: number }[];
  height?: number;
  color?: string;
}) {
  const width = 1200;
  if (points.length < 2) return null;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);
  const yRange = yMax - yMin || 1;
  const pad = 20;
  const mapX = (x: number) => pad + ((x - xMin) / (xMax - xMin || 1)) * (width - pad * 2);
  const mapY = (y: number) => pad + ((yMax - y) / yRange) * (height - pad * 2);

  const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${mapX(p.x)} ${mapY(p.y)}`).join(" ");
  const area = `${path} L ${mapX(points[points.length - 1].x)} ${height - pad} L ${mapX(points[0].x)} ${
    height - pad
  } Z`;
  const gradId = `grad-${Math.random().toString(36).slice(2)}`;

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((t) => (
        <line
          key={t}
          x1={pad}
          y1={pad + t * (height - pad * 2)}
          x2={width - pad}
          y2={pad + t * (height - pad * 2)}
          stroke="var(--line)"
          strokeDasharray="2 4"
        />
      ))}
      <path d={area} fill={`url(#${gradId})`} />
      <path d={path} stroke={color} strokeWidth={1.5} fill="none" />
    </svg>
  );
}

function TvlChart({ history }: { history: { date: string; tvl: number }[] }) {
  const points = useMemo(
    () => history.map((h, i) => ({ x: i, y: h.tvl })),
    [history]
  );
  const latest = history[history.length - 1]?.tvl ?? 0;
  const first = history[0]?.tvl ?? 0;
  const change = first > 0 ? ((latest - first) / first) * 100 : 0;
  return (
    <div
      className="brackets"
      style={{ border: "1px solid var(--line)", background: "var(--surface)", padding: 28 }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          marginBottom: 24,
        }}
      >
        <div>
          <Eyebrow>TVL History</Eyebrow>
          <div
            className="serif"
            style={{ fontSize: 32, marginTop: 10, letterSpacing: "-0.02em" }}
          >
            {fmt.money(latest)}
          </div>
        </div>
        <div
          className="mono tabular"
          style={{
            fontSize: 13,
            color: change >= 0 ? "var(--good)" : "var(--danger)",
          }}
        >
          {fmt.pct(change)} · {history.length}d
        </div>
      </div>
      <AreaSvg points={points} />
    </div>
  );
}

function ApyChart({ pools }: { pools: HealthData["poolHistories"] }) {
  const palette = ["var(--accent)", "var(--good)", "var(--warn)", "#8A6CFF", "#FF7A93"];
  return (
    <div
      className="brackets"
      style={{ border: "1px solid var(--line)", background: "var(--surface)", padding: 28 }}
    >
      <div style={{ marginBottom: 20 }}>
        <Eyebrow>APY History</Eyebrow>
        <div
          className="serif"
          style={{ fontSize: 24, marginTop: 8, letterSpacing: "-0.02em" }}
        >
          Top pools, last <span style={{ fontStyle: "italic", color: "var(--accent)" }}>90d</span>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {pools.slice(0, 5).map((ph, i) => {
          const series = ph.data.slice(-90);
          const points = series.map((d, idx) => ({ x: idx, y: d.apy }));
          const latest = series[series.length - 1]?.apy ?? 0;
          return (
            <div key={ph.poolId} style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ minWidth: 160 }}>
                <div
                  className="mono"
                  style={{
                    fontSize: 11,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "var(--text)",
                  }}
                >
                  {ph.symbol}
                </div>
                <div
                  className="mono"
                  style={{
                    fontSize: 9,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: "var(--text-dim)",
                    marginTop: 4,
                  }}
                >
                  {ph.chain}
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <AreaSvg points={points} height={80} color={palette[i % palette.length]} />
              </div>
              <div
                className="mono tabular"
                style={{
                  minWidth: 72,
                  textAlign: "right",
                  color: palette[i % palette.length],
                  fontSize: 14,
                }}
              >
                {fmt.apy(latest)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ExploitPanel({
  hacks,
  totalLoss,
}: {
  hacks: HealthData["hacks"];
  totalLoss: number;
}) {
  if (hacks.length === 0) {
    return (
      <div
        style={{
          border: "1px solid var(--good)",
          background: "color-mix(in oklab, var(--good) 10%, transparent)",
          padding: 20,
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            background: "var(--good)",
            boxShadow: "0 0 10px var(--good)",
          }}
        />
        <span
          className="mono"
          style={{
            fontSize: 11,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "var(--good)",
          }}
        >
          No recorded exploits in public history
        </span>
      </div>
    );
  }
  return (
    <div
      className="brackets"
      style={{
        border: "1px solid var(--danger)",
        background: "color-mix(in oklab, var(--danger) 6%, var(--surface))",
        padding: 28,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          marginBottom: 24,
        }}
      >
        <div>
          <Eyebrow>Exploit Timeline</Eyebrow>
          <div
            className="serif"
            style={{ fontSize: 28, marginTop: 10, letterSpacing: "-0.02em", color: "var(--danger)" }}
          >
            {hacks.length} incident{hacks.length === 1 ? "" : "s"} ·{" "}
            <span style={{ fontStyle: "italic" }}>{fmt.money(totalLoss)}</span> lost
          </div>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 1, background: "var(--line)" }}>
        {hacks.map((h, i) => (
          <div
            key={i}
            style={{
              display: "grid",
              gridTemplateColumns: "140px 1fr 140px",
              gap: 16,
              alignItems: "center",
              padding: "14px 16px",
              background: "var(--surface)",
            }}
          >
            <div
              className="mono tabular"
              style={{
                fontSize: 11,
                letterSpacing: "0.08em",
                color: "var(--text-dim)",
                textTransform: "uppercase",
              }}
            >
              {new Date(h.date).toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "2-digit",
              })}
            </div>
            <div style={{ fontSize: 13, color: "var(--text)" }}>
              {h.name && <span style={{ fontWeight: 500 }}>{h.name} · </span>}
              <span style={{ color: "var(--text-dim)" }}>{h.technique}</span>
            </div>
            <div
              className="mono tabular"
              style={{
                fontSize: 14,
                color: "var(--danger)",
                textAlign: "right",
              }}
            >
              {fmt.money(h.amount)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TokenMarket({ tm }: { tm: NonNullable<HealthData["tokenMarketData"]> }) {
  const cells = [
    { label: "Price", value: `$${tm.priceUsd.toFixed(4)}`, tone: "text" as const },
    { label: "Market Cap", value: fmt.money(tm.marketCap), tone: "text" as const },
    { label: "24h Volume", value: fmt.money(tm.volume24h), tone: "text" as const },
    {
      label: "24h Change",
      value: tm.priceChange24h === null ? "—" : fmt.pct(tm.priceChange24h),
      tone: (tm.priceChange24h ?? 0) >= 0 ? ("good" as const) : ("danger" as const),
    },
  ];
  return (
    <div
      className="brackets"
      style={{ border: "1px solid var(--line)", background: "var(--surface)", padding: 28 }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          marginBottom: 24,
        }}
      >
        <Eyebrow>Token Market</Eyebrow>
        <div
          className="mono"
          style={{
            fontSize: 9,
            letterSpacing: "0.18em",
            color: "var(--text-dim)",
            textTransform: "uppercase",
          }}
        >
          via CoinGecko
        </div>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 1,
          background: "var(--line)",
          border: "1px solid var(--line)",
        }}
      >
        {cells.map((c) => (
          <div key={c.label} style={{ background: "var(--surface)", padding: 20 }}>
            <Eyebrow>{c.label}</Eyebrow>
            <div
              className="serif tabular"
              style={{
                fontSize: 24,
                marginTop: 10,
                letterSpacing: "-0.02em",
                color:
                  c.tone === "good"
                    ? "var(--good)"
                    : c.tone === "danger"
                    ? "var(--danger)"
                    : "var(--text)",
              }}
            >
              {c.value}
            </div>
          </div>
        ))}
      </div>
      {(tm.priceChange7d !== null || tm.priceChange30d !== null || tm.developerActivity !== null) && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 16,
            marginTop: 20,
            paddingTop: 20,
            borderTop: "1px solid var(--line)",
          }}
        >
          {tm.priceChange7d !== null && (
            <InlineStat
              label="7D"
              value={fmt.pct(tm.priceChange7d)}
              tone={tm.priceChange7d >= 0 ? "good" : "danger"}
            />
          )}
          {tm.priceChange30d !== null && (
            <InlineStat
              label="30D"
              value={fmt.pct(tm.priceChange30d)}
              tone={tm.priceChange30d >= 0 ? "good" : "danger"}
            />
          )}
          {tm.developerActivity !== null && (
            <InlineStat label="Dev Activity" value={`${tm.developerActivity} commits / 4w`} />
          )}
        </div>
      )}
    </div>
  );
}

function InlineStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "good" | "danger";
}) {
  return (
    <div>
      <Eyebrow>{label}</Eyebrow>
      <div
        className="mono tabular"
        style={{
          fontSize: 14,
          marginTop: 6,
          color:
            tone === "good"
              ? "var(--good)"
              : tone === "danger"
              ? "var(--danger)"
              : "var(--text)",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function PriceChart({ prices }: { prices: { timestamp: number; price: number }[] }) {
  const points = useMemo(() => prices.map((p, i) => ({ x: i, y: p.price })), [prices]);
  const latest = prices[prices.length - 1]?.price ?? 0;
  const first = prices[0]?.price ?? 0;
  const change = first > 0 ? ((latest - first) / first) * 100 : 0;
  return (
    <div
      className="brackets"
      style={{ border: "1px solid var(--line)", background: "var(--surface)", padding: 28 }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          marginBottom: 20,
        }}
      >
        <div>
          <Eyebrow>Token Price · 30d</Eyebrow>
          <div
            className="serif tabular"
            style={{ fontSize: 28, marginTop: 10, letterSpacing: "-0.02em" }}
          >
            ${latest.toFixed(4)}
          </div>
        </div>
        <div
          className="mono tabular"
          style={{
            fontSize: 13,
            color: change >= 0 ? "var(--good)" : "var(--danger)",
          }}
        >
          {fmt.pct(change)}
        </div>
      </div>
      <AreaSvg points={points} color={change >= 0 ? "var(--good)" : "var(--danger)"} />
    </div>
  );
}

function SecurityPanel({ sec }: { sec: NonNullable<HealthData["securityData"]> }) {
  const scoreTone =
    sec.securityScore >= 70 ? "good" : sec.securityScore >= 40 ? "warn" : "danger";
  const flags = [
    { label: "Open Source", value: sec.isOpenSource, good: true },
    { label: "Honeypot", value: sec.isHoneypot, good: false },
    { label: "Mintable", value: sec.isMintable, good: false },
    { label: "Proxy", value: sec.isProxy, good: false },
  ];
  return (
    <div
      className="brackets"
      style={{ border: "1px solid var(--line)", background: "var(--surface)", padding: 28 }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          marginBottom: 24,
        }}
      >
        <Eyebrow>Contract Security</Eyebrow>
        <div
          className="mono"
          style={{
            fontSize: 9,
            letterSpacing: "0.18em",
            color: "var(--text-dim)",
            textTransform: "uppercase",
          }}
        >
          via GoPlus
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 28, marginBottom: 28 }}>
        <div>
          <div
            className="serif tabular"
            style={{
              fontSize: 72,
              lineHeight: 1,
              letterSpacing: "-0.04em",
              color: `var(--${scoreTone})`,
            }}
          >
            {sec.securityScore}
            <span
              className="mono"
              style={{
                fontSize: 14,
                color: "var(--text-dim)",
                marginLeft: 8,
                letterSpacing: "0.1em",
              }}
            >
              / 100
            </span>
          </div>
        </div>
        <div
          className="mono"
          style={{
            padding: "8px 14px",
            background: `color-mix(in oklab, var(--${scoreTone}) 15%, transparent)`,
            border: `1px solid var(--${scoreTone})`,
            color: `var(--${scoreTone})`,
            fontSize: 10,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
          }}
        >
          {sec.riskLevel}
        </div>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 1,
          background: "var(--line)",
          border: "1px solid var(--line)",
        }}
      >
        {flags.map((f) => {
          const tone =
            f.value === null
              ? "dim"
              : (f.good ? f.value : !f.value)
              ? "good"
              : "danger";
          return (
            <div key={f.label} style={{ background: "var(--surface)", padding: 16 }}>
              <Eyebrow>{f.label}</Eyebrow>
              <div
                className="mono"
                style={{
                  fontSize: 14,
                  marginTop: 8,
                  color:
                    tone === "good"
                      ? "var(--good)"
                      : tone === "danger"
                      ? "var(--danger)"
                      : "var(--text-dim)",
                }}
              >
                {f.value === null ? "N/A" : f.value ? "Yes" : "No"}
              </div>
            </div>
          );
        })}
      </div>
      {sec.flags.length > 0 && (
        <div style={{ marginTop: 20, display: "flex", flexWrap: "wrap", gap: 8 }}>
          {sec.flags.map((flag, i) => (
            <span
              key={i}
              className="mono"
              style={{
                fontSize: 10,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "var(--danger)",
                background: "color-mix(in oklab, var(--danger) 12%, transparent)",
                border: "1px solid var(--danger)",
                padding: "6px 10px",
              }}
            >
              {flag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function BeefyVaults({ vaults }: { vaults: NonNullable<HealthData["beefyVaults"]> }) {
  return (
    <div
      className="brackets"
      style={{ border: "1px solid var(--line)", background: "var(--surface)", padding: 28 }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          marginBottom: 20,
        }}
      >
        <Eyebrow>Auto-Compound Vaults</Eyebrow>
        <div
          className="mono"
          style={{
            fontSize: 9,
            letterSpacing: "0.18em",
            color: "var(--text-dim)",
            textTransform: "uppercase",
          }}
        >
          via Beefy
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 1, background: "var(--line)" }}>
        {vaults.map((v) => (
          <div
            key={v.id}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 140px 100px 80px",
              gap: 16,
              alignItems: "center",
              padding: "14px 16px",
              background: "var(--surface)",
            }}
          >
            <div
              className="mono"
              style={{
                fontSize: 12,
                color: "var(--text)",
                letterSpacing: "0.04em",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {v.id}
            </div>
            <div
              className="mono tabular"
              style={{ fontSize: 12, color: "var(--text-dim)", textAlign: "right" }}
            >
              {v.tvlUsd !== null ? fmt.money(v.tvlUsd) : "—"}
            </div>
            <div
              className="mono tabular"
              style={{ fontSize: 13, color: "var(--accent)", textAlign: "right" }}
            >
              {v.apy !== null ? fmt.apy(v.apy) : "—"}
            </div>
            <a
              href={`https://app.beefy.com/vault/${v.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mono"
              style={{
                fontSize: 10,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "var(--accent)",
                textDecoration: "none",
                textAlign: "right",
              }}
            >
              Open ↗
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}

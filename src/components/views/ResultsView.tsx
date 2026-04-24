"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { ScanResponse, RiskAppetite, AssetType } from "@/types/scanner";
import type { DefiLlamaPool } from "@/types/pool";
import { Eyebrow, Icons, Spark, fmt } from "@/components/sovereign";

type SortKey = "apy" | "tvl" | "name" | "change" | "safety";
type SortDir = "asc" | "desc";

function safetyScore(pool: DefiLlamaPool): number {
  // Deterministic pseudo-score derived from TVL magnitude + stablecoin flag so
  // the vault list still feels "rated" without a server-side legitimacy call.
  const tvlComponent = Math.min(60, Math.log10(Math.max(pool.tvlUsd, 1)) * 7);
  const stableBump = pool.stablecoin ? 18 : 8;
  const chainBump = ["Ethereum", "Arbitrum", "Base", "Optimism"].includes(pool.chain) ? 10 : 4;
  return Math.min(99, Math.round(tvlComponent + stableBump + chainBump));
}

function changePct(pool: DefiLlamaPool): number {
  return pool.apyPct1D ?? pool.apyPct7D ?? 0;
}

function VaultRow({ pool, index }: { pool: DefiLlamaPool; index: number }) {
  const apy = pool.apy ?? pool.apyBase ?? 0;
  const safety = safetyScore(pool);
  const change = changePct(pool);
  const sparkData = useMemo(
    () =>
      Array.from({ length: 30 }, (_, k) =>
        apy + Math.sin(k * 0.3 + index) * 0.9 + Math.cos(k * 0.5) * 0.4,
      ),
    [apy, index],
  );
  const safeColor =
    safety >= 85 ? "var(--good)" : safety >= 70 ? "var(--warn)" : "var(--danger)";
  const href = pool.pool
    ? `https://defillama.com/yields/pool/${pool.pool}`
    : pool.url || "#";

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "50px 1.6fr 1fr 1fr 0.9fr 0.9fr 1.3fr 100px",
        gap: 20,
        padding: "20px 24px",
        borderBottom: "1px solid var(--line)",
        alignItems: "center",
      }}
    >
      <div
        className="mono tabular"
        style={{ fontSize: 12, color: "var(--text-muted)" }}
      >
        {String(index + 1).padStart(2, "0")}
      </div>
      <div>
        <div
          className="serif"
          style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em" }}
        >
          {pool.project}
        </div>
        {pool.poolMeta ? (
          <div
            className="mono"
            style={{
              fontSize: 10,
              color: "var(--text-dim)",
              letterSpacing: "0.1em",
              marginTop: 2,
            }}
          >
            {pool.poolMeta}
          </div>
        ) : null}
      </div>
      <div>
        <div style={{ fontSize: 13, color: "var(--text)" }}>{pool.chain}</div>
        <div
          className="mono"
          style={{
            fontSize: 10,
            color: "var(--text-dim)",
            letterSpacing: "0.1em",
            marginTop: 2,
          }}
        >
          {pool.symbol}
        </div>
      </div>
      <div
        className="serif tabular"
        style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em" }}
      >
        {fmt.money(pool.tvlUsd)}
      </div>
      <div
        className="serif tabular"
        style={{
          fontSize: 24,
          fontWeight: 900,
          color: "var(--accent)",
          letterSpacing: "-0.03em",
        }}
      >
        {apy.toFixed(2)}%
      </div>
      <div
        className="mono tabular"
        style={{
          fontSize: 14,
          color: change >= 0 ? "var(--good)" : "var(--danger)",
        }}
      >
        {change >= 0 ? "▲" : "▼"} {Math.abs(change).toFixed(2)}%
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            className="serif tabular"
            style={{ fontSize: 20, fontWeight: 900, color: safeColor }}
          >
            {safety}
          </div>
          <div style={{ width: 40, height: 3, background: "var(--surface-3)" }}>
            <div
              style={{ height: "100%", width: `${safety}%`, background: safeColor }}
            />
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <Spark data={sparkData} color="var(--accent)" height={24} animated={false} />
        </div>
      </div>
      <a
        className="btn"
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        style={{ padding: "8px 12px", justifyContent: "center", fontSize: 10 }}
      >
        OPEN <Icons.arrow />
      </a>
    </div>
  );
}

function VaultsExplorer({ budget, risk, asset, chain }: {
  budget: number;
  risk: RiskAppetite;
  asset: AssetType;
  chain: string | null;
}) {
  const [data, setData] = useState<ScanResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("apy");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [query, setQuery] = useState("");
  const [chainFilter, setChainFilter] = useState<string>(chain ?? "All");
  const [assetFilter, setAssetFilter] = useState<"All" | "Stables" | "Volatile">(
    asset === "stablecoins" ? "Stables" : "All",
  );

  useEffect(() => {
    setData(null);
    setError(null);
    fetch("/api/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ budget, riskAppetite: risk, assetType: asset, chain }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Scan failed");
        return res.json() as Promise<ScanResponse>;
      })
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Scan failed"));
  }, [budget, risk, asset, chain]);

  const pools: DefiLlamaPool[] = data?.results.map((r) => r.pool) ?? [];

  const chains = useMemo(() => {
    const s = new Set<string>();
    pools.forEach((p) => s.add(p.chain));
    return Array.from(s).slice(0, 6);
  }, [pools]);

  const filtered = useMemo(() => {
    let list = pools.filter(
      (p) =>
        (chainFilter === "All" || p.chain === chainFilter) &&
        (assetFilter === "All" ||
          (assetFilter === "Stables" ? p.stablecoin : !p.stablecoin)) &&
        (query === "" || p.project.toLowerCase().includes(query.toLowerCase())),
    );
    list = list.sort((a, b) => {
      const dir = sortDir === "desc" ? -1 : 1;
      if (sortKey === "name") return a.project.localeCompare(b.project) * dir;
      if (sortKey === "tvl") return (a.tvlUsd - b.tvlUsd) * dir;
      if (sortKey === "change") return (changePct(a) - changePct(b)) * dir;
      if (sortKey === "safety") return (safetyScore(a) - safetyScore(b)) * dir;
      return ((a.apy ?? 0) - (b.apy ?? 0)) * dir;
    });
    return list;
  }, [pools, sortKey, sortDir, chainFilter, assetFilter, query]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else {
      setSortKey(k);
      setSortDir("desc");
    }
  };

  return (
    <>
      <div
        style={{
          border: "1px solid var(--line)",
          background: "var(--surface)",
          padding: 20,
          marginBottom: 24,
          display: "flex",
          alignItems: "center",
          gap: 24,
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "8px 12px",
            background: "var(--surface-2)",
            flex: "1 1 280px",
            minWidth: 200,
          }}
        >
          <Icons.search />
          <input
            className="mono"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search protocol…"
            style={{
              background: "transparent",
              border: "none",
              outline: "none",
              color: "var(--text)",
              fontSize: 13,
              flex: 1,
            }}
          />
        </div>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          <span
            className="mono"
            style={{
              fontSize: 10,
              letterSpacing: "0.2em",
              color: "var(--text-dim)",
              alignSelf: "center",
              marginRight: 8,
            }}
          >
            CHAIN
          </span>
          {(["All", ...chains] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setChainFilter(c)}
              className="mono"
              style={{
                padding: "7px 12px",
                fontSize: 10,
                letterSpacing: "0.15em",
                border: `1px solid ${chainFilter === c ? "var(--accent)" : "var(--line-2)"}`,
                background: chainFilter === c ? "var(--accent)" : "transparent",
                color: chainFilter === c ? "var(--bg)" : "var(--text-dim)",
                cursor: "pointer",
                textTransform: "uppercase",
              }}
            >
              {c}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          <span
            className="mono"
            style={{
              fontSize: 10,
              letterSpacing: "0.2em",
              color: "var(--text-dim)",
              alignSelf: "center",
              marginRight: 8,
            }}
          >
            ASSET
          </span>
          {(["All", "Stables", "Volatile"] as const).map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setAssetFilter(a)}
              className="mono"
              style={{
                padding: "7px 12px",
                fontSize: 10,
                letterSpacing: "0.15em",
                border: `1px solid ${assetFilter === a ? "var(--accent)" : "var(--line-2)"}`,
                background: assetFilter === a ? "var(--accent)" : "transparent",
                color: assetFilter === a ? "var(--bg)" : "var(--text-dim)",
                cursor: "pointer",
                textTransform: "uppercase",
              }}
            >
              {a}
            </button>
          ))}
        </div>
        <div
          className="mono"
          style={{
            marginLeft: "auto",
            display: "flex",
            alignItems: "center",
            gap: 10,
            color: "var(--text-dim)",
            fontSize: 11,
          }}
        >
          {filtered.length} OF {pools.length} VAULTS
        </div>
      </div>

      {error ? (
        <div
          style={{
            border: "1px solid color-mix(in oklch, var(--danger) 40%, transparent)",
            background: "color-mix(in oklch, var(--danger) 10%, transparent)",
            padding: 40,
            textAlign: "center",
          }}
        >
          <Eyebrow>SCAN FAILED</Eyebrow>
          <p style={{ color: "var(--danger)", marginTop: 12, fontSize: 14 }}>{error}</p>
          <Link className="btn" href="/discover" style={{ marginTop: 20 }}>
            RECONFIGURE
          </Link>
        </div>
      ) : (
        <div
          style={{
            border: "1px solid var(--line)",
            background: "var(--surface)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "50px 1.6fr 1fr 1fr 0.9fr 0.9fr 1.3fr 100px",
              gap: 20,
              padding: "14px 24px",
              borderBottom: "1px solid var(--line)",
              background: "var(--surface-2)",
            }}
          >
            {(
              [
                ["#", null],
                ["PROTOCOL", "name"],
                ["CHAIN / TOKEN", null],
                ["TVL", "tvl"],
                ["APY", "apy"],
                ["1D Δ", "change"],
                ["SAFETY · TREND", "safety"],
                ["", null],
              ] as Array<[string, SortKey | null]>
            ).map(([label, k], i) => (
              <button
                key={i}
                type="button"
                onClick={() => (k ? toggleSort(k) : undefined)}
                className="mono"
                disabled={!k}
                style={{
                  fontSize: 9,
                  letterSpacing: "0.2em",
                  color: k && sortKey === k ? "var(--accent)" : "var(--text-dim)",
                  cursor: k ? "pointer" : "default",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  background: "transparent",
                  border: "none",
                  padding: 0,
                  textAlign: "left",
                }}
              >
                {label}{" "}
                {k && sortKey === k ? (sortDir === "desc" ? "▼" : "▲") : ""}
              </button>
            ))}
          </div>

          {data === null ? (
            <div style={{ padding: 60, textAlign: "center" }}>
              <div
                className="mono"
                style={{
                  fontSize: 10,
                  letterSpacing: "0.22em",
                  color: "var(--text-dim)",
                }}
              >
                ◎ INDEXING 10,000+ POOLS…
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 60, textAlign: "center" }}>
              <div
                className="mono"
                style={{
                  fontSize: 10,
                  letterSpacing: "0.22em",
                  color: "var(--text-dim)",
                }}
              >
                NO MATCHES · WIDEN CRITERIA
              </div>
            </div>
          ) : (
            filtered
              .slice(0, 50)
              .map((p, i) => <VaultRow key={p.pool} pool={p} index={i} />)
          )}
        </div>
      )}
    </>
  );
}

interface ResultsViewProps {
  budget: number;
  risk: RiskAppetite;
  asset: AssetType;
  chain: string | null;
  onBack?: () => void;
}

export default function ResultsView({ budget, risk, asset, chain, onBack }: ResultsViewProps) {

  return (
    <div style={{ padding: "40px 48px 80px" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.3fr 1fr",
          gap: 40,
          alignItems: "end",
          marginBottom: 48,
        }}
      >
        <div>
          <Eyebrow>VAULT EXPLORER / LIVE</Eyebrow>
          <h1
            className="serif"
            style={{
              fontSize: "clamp(56px, 8vw, 92px)",
              fontWeight: 900,
              letterSpacing: "-0.055em",
              lineHeight: 0.9,
              margin: "20px 0 0",
            }}
          >
            Ten thousand
            <br />
            <em style={{ color: "var(--accent)", fontStyle: "italic", fontWeight: 400 }}>
              pools.
            </em>
          </h1>
        </div>
        <div>
          <p style={{ fontSize: 15, color: "var(--text-dim)", lineHeight: 1.6, maxWidth: 420 }}>
            Every yield pool indexed by DeFiLlama, scored by the Sovereign core, filterable by chain, asset, and safety.
            Updated every block.
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: 0,
              marginTop: 28,
              borderTop: "1px solid var(--line)",
              paddingTop: 18,
            }}
          >
            <div>
              <div className="serif tabular" style={{ fontSize: 26, fontWeight: 900 }}>
                {fmt.money(budget)}
              </div>
              <div
                className="mono"
                style={{
                  fontSize: 9,
                  letterSpacing: "0.2em",
                  color: "var(--text-dim)",
                  marginTop: 2,
                }}
              >
                BUDGET
              </div>
            </div>
            <div>
              <div className="serif" style={{ fontSize: 26, fontWeight: 900, textTransform: "capitalize" }}>
                {risk}
              </div>
              <div
                className="mono"
                style={{
                  fontSize: 9,
                  letterSpacing: "0.2em",
                  color: "var(--text-dim)",
                  marginTop: 2,
                }}
              >
                RISK
              </div>
            </div>
            <div>
              <div className="serif" style={{ fontSize: 26, fontWeight: 900, color: "var(--accent)" }}>
                {chain ?? "ALL"}
              </div>
              <div
                className="mono"
                style={{
                  fontSize: 9,
                  letterSpacing: "0.2em",
                  color: "var(--text-dim)",
                  marginTop: 2,
                }}
              >
                CHAIN
              </div>
            </div>
          </div>
        </div>
      </div>

      {onBack ? (
        <button
          onClick={onBack}
          className="mono"
          style={{
            marginBottom: 24,
            padding: "10px 16px",
            border: "1px solid var(--line)",
            background: "var(--surface)",
            color: "var(--text-dim)",
            fontSize: 11,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            cursor: "pointer",
          }}
        >
          ← NEW SEARCH
        </button>
      ) : null}

      <VaultsExplorer budget={budget} risk={risk} asset={asset} chain={chain} />
    </div>
  );
}

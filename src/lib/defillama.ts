import type { DefiLlamaPool, DefiLlamaProtocol } from "@/types/pool";
import { fetchWithTimeout } from "./fetch-utils";
import { cachedUpstreamJson } from "./upstream-cache";

const YIELDS_BASE = "https://yields.llama.fi";
const API_BASE = "https://api.llama.fi";

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function text(value: unknown, maxLength: number, fallback = ""): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : fallback;
}

function nullableText(value: unknown, maxLength: number): string | null {
  const normalized = text(value, maxLength);
  return normalized || null;
}

function finite(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function nullableFinite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringList(value: unknown, maxItems: number, maxLength: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().slice(0, maxLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

function normalizePool(value: unknown): DefiLlamaPool | null {
  const raw = record(value);
  if (!raw) return null;
  const pool = text(raw.pool, 200);
  const chain = text(raw.chain, 100);
  const project = text(raw.project, 160);
  const symbol = text(raw.symbol, 200);
  const tvlUsd = finite(raw.tvlUsd, Number.NaN);
  if (!pool || !chain || !project || !symbol || !Number.isFinite(tvlUsd) || tvlUsd < 0) {
    return null;
  }
  const rewardTokens = stringList(raw.rewardTokens, 50, 200);
  const underlyingTokens = stringList(raw.underlyingTokens, 50, 200);
  return {
    pool,
    chain,
    project,
    symbol,
    tvlUsd,
    apy: nullableFinite(raw.apy),
    apyBase: nullableFinite(raw.apyBase),
    apyReward: nullableFinite(raw.apyReward),
    rewardTokens: rewardTokens.length > 0 ? rewardTokens : null,
    underlyingTokens: underlyingTokens.length > 0 ? underlyingTokens : null,
    poolMeta: nullableText(raw.poolMeta, 500),
    url: text(raw.url, 2_000),
    exposure: nullableText(raw.exposure, 100),
    stablecoin: raw.stablecoin === true,
    ilRisk: nullableText(raw.ilRisk, 100),
    apyPct1D: nullableFinite(raw.apyPct1D),
    apyPct7D: nullableFinite(raw.apyPct7D),
    apyPct30D: nullableFinite(raw.apyPct30D),
    apyMean30d: nullableFinite(raw.apyMean30d),
    volumeUsd1d: nullableFinite(raw.volumeUsd1d),
    volumeUsd7d: nullableFinite(raw.volumeUsd7d),
    source: "defillama",
  };
}

function normalizeProtocol(value: unknown): DefiLlamaProtocol | null {
  const raw = record(value);
  if (!raw) return null;
  const name = text(raw.name, 300);
  const slug = text(raw.slug, 200);
  if (!name || !slug) return null;
  const chains = stringList(raw.chains, 100, 100);
  const chain = text(raw.chain, 100) || chains[0] || "Unknown";
  const audits =
    typeof raw.audits === "number" && Number.isFinite(raw.audits)
      ? String(raw.audits)
      : text(raw.audits, 30, "0");
  return {
    id: text(raw.id, 200, slug),
    name,
    address: nullableText(raw.address, 500),
    symbol: text(raw.symbol, 100),
    url: text(raw.url, 2_000),
    description: text(raw.description, 4_000),
    chain,
    logo: text(raw.logo, 2_000),
    audits,
    audit_links: stringList(raw.audit_links, 100, 2_000),
    category: text(raw.category, 160, "Unknown"),
    chains: chains.length > 0 ? chains : chain !== "Unknown" ? [chain] : [],
    twitter: text(raw.twitter, 200),
    tvl: Math.max(0, finite(raw.tvl)),
    change_1h: nullableFinite(raw.change_1h),
    change_1d: nullableFinite(raw.change_1d),
    change_7d: nullableFinite(raw.change_7d),
    listedAt: finite(raw.listedAt),
    slug,
    mcap: nullableFinite(raw.mcap),
    gecko_id: nullableText(raw.gecko_id, 200),
  };
}

export async function fetchAllPools(): Promise<DefiLlamaPool[]> {
  return cachedUpstreamJson({
    key: "defillama:pools:v1",
    source: "defillama/pools",
    schemaVersion: 2,
    freshMs: 5 * 60 * 1000,
    staleMs: 24 * 60 * 60 * 1000,
    validate: (value): value is DefiLlamaPool[] =>
      Array.isArray(value) && value.length > 0 &&
      value.every(
        (pool) =>
          Boolean(pool) &&
          typeof pool === "object" &&
          typeof (pool as DefiLlamaPool).pool === "string" &&
          typeof (pool as DefiLlamaPool).chain === "string" &&
          typeof (pool as DefiLlamaPool).project === "string" &&
          typeof (pool as DefiLlamaPool).tvlUsd === "number",
      ),
    fetcher: async () => {
      const res = await fetchWithTimeout(`${YIELDS_BASE}/pools`, { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed to fetch pools: ${res.status}`);
      const json = (await res.json()) as { data?: unknown };
      if (!Array.isArray(json.data)) throw new Error("Pool feed did not contain data[]");
      const pools = json.data.flatMap((entry) => {
        const normalized = normalizePool(entry);
        return normalized ? [normalized] : [];
      });
      if (pools.length === 0) throw new Error("Pool feed contained no valid rows");
      return pools;
    },
  });
}

export async function fetchProtocols(): Promise<DefiLlamaProtocol[]> {
  return cachedUpstreamJson({
    key: "defillama:protocols:v1",
    source: "defillama/protocols",
    schemaVersion: 2,
    freshMs: 10 * 60 * 1000,
    staleMs: 24 * 60 * 60 * 1000,
    validate: (value): value is DefiLlamaProtocol[] =>
      Array.isArray(value) && value.length > 0 &&
      value.every(
        (protocol) =>
          Boolean(protocol) &&
          typeof protocol === "object" &&
          typeof (protocol as DefiLlamaProtocol).name === "string" &&
          typeof (protocol as DefiLlamaProtocol).slug === "string" &&
          Array.isArray((protocol as DefiLlamaProtocol).chains),
      ),
    fetcher: async () => {
      const res = await fetchWithTimeout(`${API_BASE}/protocols`, { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed to fetch protocols: ${res.status}`);
      const json = await res.json();
      if (!Array.isArray(json)) throw new Error("Protocol feed was not an array");
      const protocols = json.flatMap((entry) => {
        const normalized = normalizeProtocol(entry);
        return normalized ? [normalized] : [];
      });
      if (protocols.length === 0) throw new Error("Protocol feed contained no valid rows");
      return protocols;
    },
  });
}

export async function fetchPoolHistory(poolId: string) {
  const res = await fetchWithTimeout(`${YIELDS_BASE}/chart/${encodeURIComponent(poolId)}`, {
    next: { revalidate: 1800 },
  });
  if (!res.ok) throw new Error(`Failed to fetch pool history: ${res.status}`);
  const json = await res.json();
  if (!json || typeof json !== "object" || !Array.isArray((json as { data?: unknown }).data)) {
    throw new Error("Pool history feed did not contain data[]");
  }
  return (json as { data: unknown[] }).data;
}

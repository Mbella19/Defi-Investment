import type { DefiLlamaPool, DefiLlamaChain, DefiLlamaProtocol, ChainOption } from "@/types/pool";
import { fetchWithTimeout } from "./fetch-utils";

const YIELDS_BASE = "https://yields.llama.fi";
const API_BASE = "https://api.llama.fi";

export async function fetchAllPools(): Promise<DefiLlamaPool[]> {
  const res = await fetchWithTimeout(`${YIELDS_BASE}/pools`, {
    next: { revalidate: 300 },
  });
  if (!res.ok) throw new Error(`Failed to fetch pools: ${res.status}`);
  const json = await res.json();
  return json.data;
}

export async function fetchChains(): Promise<DefiLlamaChain[]> {
  const res = await fetchWithTimeout(`${API_BASE}/v2/chains`, {
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`Failed to fetch chains: ${res.status}`);
  return res.json();
}

export async function fetchChainOptions(): Promise<ChainOption[]> {
  const chains = await fetchChains();
  return chains
    .filter((c) => c.tvl > 1_000_000)
    .sort((a, b) => b.tvl - a.tvl)
    .map((c) => ({ name: c.name, tvl: c.tvl, tokenSymbol: c.tokenSymbol }));
}

export async function fetchProtocols(): Promise<DefiLlamaProtocol[]> {
  const res = await fetchWithTimeout(`${API_BASE}/protocols`, {
    next: { revalidate: 600 },
  });
  if (!res.ok) throw new Error(`Failed to fetch protocols: ${res.status}`);
  return res.json();
}

export async function fetchProtocol(slug: string): Promise<DefiLlamaProtocol | null> {
  const protocols = await fetchProtocols();
  return protocols.find((p) => p.slug === slug) || null;
}

export async function fetchPoolHistory(poolId: string) {
  const res = await fetchWithTimeout(`${YIELDS_BASE}/chart/${encodeURIComponent(poolId)}`, {
    next: { revalidate: 1800 },
  });
  if (!res.ok) throw new Error(`Failed to fetch pool history: ${res.status}`);
  const json = await res.json();
  return json.data;
}

export async function fetchProtocolDetail(slug: string): Promise<ProtocolDetail> {
  const res = await fetchWithTimeout(`${API_BASE}/protocol/${encodeURIComponent(slug)}`, {
    next: { revalidate: 600 },
  });
  if (!res.ok) throw new Error(`Failed to fetch protocol detail: ${res.status}`);
  return res.json();
}

export interface ProtocolDetail {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  gecko_id: string | null;
  chain: string | null;
  tvl: { date: number; totalLiquidityUSD: number }[];
  chainTvls: Record<string, { tvl: { date: number; totalLiquidityUSD: number }[] }>;
  currentChainTvls: Record<string, number>;
  category: string;
  chains: string[];
  audits: string;
  audit_links?: string[];
  description: string;
  url: string;
  twitter: string;
}

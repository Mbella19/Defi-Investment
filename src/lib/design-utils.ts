// Shared formatting + chain metadata for the redesigned UI. The prototype
// kept these inside its `lib/data.ts` mock; here we strip the mock data and
// only keep the deterministic helpers + chain colour map.

export type ChainId = "eth" | "arb" | "op" | "base" | "poly" | "bsc" | "avax" | "sol" | "other";
export type RiskBand = "Conservative" | "Balanced" | "Asymmetric";
export type MarketCategory = "Lending" | "LST" | "LP" | "Yield" | "Synth";

export const chainMeta: Record<ChainId, { label: string; name: string; color: string }> = {
  eth: { label: "ETH", name: "Ethereum", color: "#7b8cff" },
  arb: { label: "ARB", name: "Arbitrum", color: "#38bdf8" },
  op: { label: "OP", name: "Optimism", color: "#ff6b62" },
  base: { label: "BASE", name: "Base", color: "#3f7cff" },
  poly: { label: "POLY", name: "Polygon", color: "#a675ff" },
  bsc: { label: "BSC", name: "BNB Chain", color: "#f3ba2f" },
  avax: { label: "AVAX", name: "Avalanche", color: "#ff4f68" },
  sol: { label: "SOL", name: "Solana", color: "#14f195" },
  other: { label: "EVM", name: "Other", color: "#8e8e93" },
};

export const chainOrder: ChainId[] = ["eth", "arb", "op", "base", "poly", "bsc", "avax", "sol"];

export function chainIdFromName(name: string | null | undefined): ChainId {
  if (!name) return "other";
  const n = name.toLowerCase();
  if (n === "ethereum" || n === "eth") return "eth";
  if (n.startsWith("arbitrum") || n === "arb") return "arb";
  if (n === "optimism" || n === "op") return "op";
  if (n === "base") return "base";
  if (n.startsWith("polygon") || n === "poly" || n === "matic") return "poly";
  if (n === "bsc" || n.includes("binance") || n.includes("bnb")) return "bsc";
  if (n === "avalanche" || n === "avax") return "avax";
  if (n === "solana" || n === "sol") return "sol";
  return "other";
}

export function chainIdFromEvmId(id: number): ChainId {
  switch (id) {
    case 1:
      return "eth";
    case 42161:
      return "arb";
    case 10:
      return "op";
    case 8453:
      return "base";
    case 137:
      return "poly";
    case 56:
      return "bsc";
    case 43114:
      return "avax";
    default:
      return "other";
  }
}

export function formatUsd(value: number): string {
  if (!Number.isFinite(value)) return "$0";
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000_000) return `$${(value / 1_000_000_000_000).toFixed(2)}T`;
  if (abs >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

export function formatMoney(value: number): string {
  if (!Number.isFinite(value)) return "$0";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: Math.abs(value) >= 1000 ? 0 : 2,
  }).format(value);
}

export function formatPct(value: number, signed = false): string {
  if (!Number.isFinite(value)) return "—";
  const sign = signed && value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export function formatBalance(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "0";
  if (n < 0.0001) return n.toExponential(2);
  if (n < 1) return n.toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
  if (n < 1000) return n.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

/**
 * Map an arbitrary "safety + APY" pair onto the prototype's three risk bands.
 * Conservative covers the deep-blue stable lending shelves, Balanced covers
 * mid-yield credit / LSTs, Asymmetric covers everything riskier.
 */
export function riskBandFor({ safety, apy }: { safety: number; apy: number }): RiskBand {
  if (safety >= 80 && apy <= 10) return "Conservative";
  if (safety >= 60 && apy <= 25) return "Balanced";
  return "Asymmetric";
}

/**
 * Quick proxy for "how safe is this pool?" used by the Discover view. Same
 * shape as the existing safetyScore in the legacy DiscoverPage so behaviour
 * is unchanged when we feed real DefiLlama pools through it.
 */
export function safetyScore(pool: {
  tvlUsd: number;
  apy: number;
  apyPct30D: number | null;
  stablecoin: boolean;
  category: string;
}): number {
  let score = 50;
  if (pool.tvlUsd > 1e9) score += 25;
  else if (pool.tvlUsd > 1e8) score += 18;
  else if (pool.tvlUsd > 1e7) score += 10;
  else if (pool.tvlUsd < 1e6) score -= 15;
  if (pool.stablecoin) score += 10;
  if (pool.category === "LST") score += 8;
  if (pool.apy > 50) score -= 25;
  else if (pool.apy > 25) score -= 12;
  if (pool.apyPct30D !== null && pool.apyPct30D < -50) score -= 10;
  return Math.max(0, Math.min(100, score));
}

export function categorizeFromCategory(category: string): MarketCategory {
  if (category === "Lending" || category === "LST" || category === "LP" || category === "Yield" || category === "Synth") {
    return category;
  }
  return "Yield";
}

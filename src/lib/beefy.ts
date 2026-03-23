import type { BeefyVault, BeefyVaultWithYield } from "@/types/beefy";
import type { DefiLlamaPool } from "@/types/pool";

const BASE = "https://api.beefy.finance";

/** Map Beefy chain names (lowercase) to DeFiLlama chain names (capitalized). */
export const BEEFY_CHAIN_MAP: Record<string, string> = {
  ethereum: "Ethereum",
  bsc: "BSC",
  polygon: "Polygon",
  arbitrum: "Arbitrum",
  optimism: "Optimism",
  avalanche: "Avalanche",
  fantom: "Fantom",
  base: "Base",
  moonbeam: "Moonbeam",
  celo: "Celo",
  gnosis: "Gnosis",
  zksync: "zkSync Era",
  linea: "Linea",
  mantle: "Mantle",
  scroll: "Scroll",
  metis: "Metis",
  kava: "Kava",
  cronos: "Cronos",
  aurora: "Aurora",
};

const STABLECOIN_SYMBOLS = new Set([
  "USDC", "USDT", "DAI", "FRAX", "LUSD", "BUSD", "TUSD", "USDD",
  "GUSD", "USDP", "sUSD", "MIM", "crvUSD", "GHO", "PYUSD", "USDe",
]);

function isStablecoin(vault: BeefyVault): boolean {
  if (vault.assets.some((a) => STABLECOIN_SYMBOLS.has(a.toUpperCase()))) return true;
  if (/stable|usd/i.test(vault.id) || /stable|usd/i.test(vault.name)) return true;
  return false;
}

/**
 * Fetch all vaults from Beefy.
 */
export async function fetchBeefyVaults(): Promise<BeefyVault[]> {
  try {
    const res = await fetch(`${BASE}/vaults`, { next: { revalidate: 600 } });
    if (!res.ok) return [];
    const data = await res.json();
    return (data as BeefyVault[]).filter((v) => v.status === "active");
  } catch {
    return [];
  }
}

/**
 * Fetch APYs for all vaults. Returns { vaultId: apyDecimal }.
 */
export async function fetchBeefyApys(): Promise<Record<string, number>> {
  try {
    const res = await fetch(`${BASE}/apy`, { next: { revalidate: 300 } });
    if (!res.ok) return {};
    return await res.json();
  } catch {
    return {};
  }
}

/**
 * Fetch TVLs for all vaults. Returns { vaultId: tvlUsd }.
 */
export async function fetchBeefyTvls(): Promise<Record<string, number>> {
  try {
    const res = await fetch(`${BASE}/tvl`, { next: { revalidate: 300 } });
    if (!res.ok) return {};
    // Beefy returns { chainName: { vaultId: tvl } } — flatten it
    const data = await res.json();
    const flat: Record<string, number> = {};
    for (const chain of Object.values(data)) {
      for (const [id, tvl] of Object.entries(chain as Record<string, number>)) {
        flat[id] = tvl;
      }
    }
    return flat;
  } catch {
    return {};
  }
}

/**
 * Fetch vaults enriched with APY and TVL.
 */
export async function fetchBeefyVaultsEnriched(): Promise<BeefyVaultWithYield[]> {
  const [vaults, apys, tvls] = await Promise.all([
    fetchBeefyVaults(),
    fetchBeefyApys(),
    fetchBeefyTvls(),
  ]);

  return vaults.map((v) => ({
    ...v,
    apy: apys[v.id] != null ? apys[v.id] * 100 : null, // Convert decimal to percentage
    tvlUsd: tvls[v.id] ?? tvls[v.earnContractAddress?.toLowerCase()] ?? null,
  }));
}

/**
 * Convert a Beefy vault to a DefiLlamaPool shape for unified scanner consumption.
 */
export function beefyToDefiLlamaPool(vault: BeefyVaultWithYield): DefiLlamaPool {
  const chain = BEEFY_CHAIN_MAP[vault.chain] || vault.chain;

  return {
    pool: `beefy-${vault.id}`,
    chain,
    project: vault.platformId,
    symbol: vault.assets.join("-") || vault.token,
    tvlUsd: vault.tvlUsd || 0,
    apy: vault.apy,
    apyBase: vault.apy,
    apyReward: null,
    rewardTokens: null,
    underlyingTokens: null,
    poolMeta: vault.strategyTypeId,
    url: vault.buyTokenUrl || `https://app.beefy.com/vault/${vault.id}`,
    exposure: null,
    stablecoin: isStablecoin(vault),
    ilRisk: vault.strategyTypeId === "lp" ? "yes" : "no",
    apyPct1D: null,
    apyPct7D: null,
    apyPct30D: null,
    volumeUsd1d: null,
    volumeUsd7d: null,
    source: "beefy",
    beefyVaultId: vault.id,
    autoCompound: true,
  };
}

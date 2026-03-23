import type { DefiLlamaPool } from "@/types/pool";
import { fetchAllPools } from "./defillama";
import { fetchBeefyVaultsEnriched, beefyToDefiLlamaPool, BEEFY_CHAIN_MAP } from "./beefy";

/**
 * Fetch pools from both DeFiLlama and Beefy, merge and deduplicate.
 * If Beefy is unavailable, falls back to DeFiLlama-only.
 */
export async function fetchAllEnrichedPools(): Promise<DefiLlamaPool[]> {
  const [llamaPools, beefyVaults] = await Promise.all([
    fetchAllPools(),
    fetchBeefyVaultsEnriched(),
  ]);

  // Tag DeFiLlama pools with source
  for (const pool of llamaPools) {
    if (!pool.source) pool.source = "defillama";
  }

  if (beefyVaults.length === 0) return llamaPools;

  // Convert Beefy vaults to pool format
  const beefyPools = beefyVaults
    .filter((v) => v.apy !== null && v.tvlUsd !== null && v.tvlUsd > 0)
    .map(beefyToDefiLlamaPool);

  // Deduplicate: match Beefy vaults to DeFiLlama pools
  const matched = new Set<string>();

  for (const bp of beefyPools) {
    const match = llamaPools.find((lp) => {
      if (lp.chain !== bp.chain) return false;
      // Match by project (beefy platformId) and overlapping symbols
      if (lp.project.toLowerCase() !== bp.project.toLowerCase()) return false;
      const lpSymbols = new Set(lp.symbol.split("-").map((s) => s.toUpperCase()));
      const bpSymbols = new Set(bp.symbol.split("-").map((s) => s.toUpperCase()));
      let overlap = 0;
      for (const s of bpSymbols) {
        if (lpSymbols.has(s)) overlap++;
      }
      return overlap > 0 && overlap >= Math.min(lpSymbols.size, bpSymbols.size);
    });

    if (match) {
      // Annotate existing DeFiLlama pool with Beefy data
      match.beefyVaultId = bp.beefyVaultId;
      match.autoCompound = true;
      matched.add(bp.pool);
    }
  }

  // Add unmatched Beefy vaults as new entries
  const newPools = beefyPools.filter((bp) => !matched.has(bp.pool));

  return [...llamaPools, ...newPools];
}

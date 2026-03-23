import type { GoPlusTokenSecurity } from "@/types/goplus";

const BASE = "https://api.gopluslabs.io/api/v1";

/** Map DeFiLlama chain names to GoPlus chain IDs. */
export const CHAIN_ID_MAP: Record<string, number> = {
  Ethereum: 1,
  BSC: 56,
  Binance: 56,
  Polygon: 137,
  Arbitrum: 42161,
  Optimism: 10,
  Avalanche: 43114,
  Fantom: 250,
  Base: 8453,
};

/** Resolve a DeFiLlama chain name to a GoPlus chain ID, or null if unsupported. */
export function resolveChainId(chainName: string): number | null {
  return CHAIN_ID_MAP[chainName] ?? null;
}

function toBool(val: string | undefined | null): boolean | null {
  if (val === "1") return true;
  if (val === "0") return false;
  return null;
}

function toNum(val: string | undefined | null): number | null {
  if (val == null || val === "") return null;
  const n = parseFloat(val);
  return isNaN(n) ? null : n;
}

/** Calculate a 0-100 security score from GoPlus raw flags. */
export function calculateSecurityScore(raw: Record<string, string | undefined>): {
  score: number;
  riskLevel: "safe" | "warning" | "danger";
  flags: string[];
} {
  let score = 100;
  const flags: string[] = [];

  if (toBool(raw.is_honeypot)) {
    score = 0;
    flags.push("Honeypot detected");
    return { score, riskLevel: "danger", flags };
  }

  if (!toBool(raw.is_open_source)) {
    score -= 25;
    flags.push("Not open source");
  }

  if (toBool(raw.is_mintable)) {
    if (!toBool(raw.is_open_source)) {
      score -= 25;
      flags.push("Mintable + closed source");
    } else {
      score -= 15;
      flags.push("Mintable");
    }
  }

  if (toBool(raw.can_take_back_ownership)) {
    score -= 20;
    flags.push("Owner can reclaim ownership");
  }

  if (toBool(raw.owner_change_balance)) {
    score -= 20;
    flags.push("Owner can change balances");
  }

  if (toBool(raw.transfer_pausable)) {
    score -= 10;
    flags.push("Transfers can be paused");
  }

  if (toBool(raw.cannot_sell_all)) {
    score -= 15;
    flags.push("Cannot sell all tokens");
  }

  if (toBool(raw.external_call)) {
    score -= 5;
    flags.push("Has external calls");
  }

  if (toBool(raw.is_proxy)) {
    score -= 5;
    flags.push("Proxy contract");
  }

  const buyTax = toNum(raw.buy_tax);
  if (buyTax !== null && buyTax > 0.05) {
    score -= 15;
    flags.push(`Buy tax: ${(buyTax * 100).toFixed(1)}%`);
  }

  const sellTax = toNum(raw.sell_tax);
  if (sellTax !== null && sellTax > 0.05) {
    score -= 20;
    flags.push(`Sell tax: ${(sellTax * 100).toFixed(1)}%`);
  }

  const holders = toNum(raw.holder_count);
  if (holders !== null && holders < 100) {
    score -= 10;
    flags.push(`Low holder count: ${holders}`);
  }

  score = Math.max(0, Math.min(100, score));
  const riskLevel = score >= 70 ? "safe" : score >= 40 ? "warning" : "danger";
  return { score, riskLevel, flags };
}

/**
 * Fetch token security for a contract address on a specific chain.
 */
export async function fetchTokenSecurity(
  chainId: number,
  contractAddress: string
): Promise<GoPlusTokenSecurity | null> {
  try {
    const addr = contractAddress.toLowerCase();
    const res = await fetch(
      `${BASE}/token_security/${chainId}?contract_addresses=${addr}`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return null;

    const data = await res.json();
    if (data.code !== 1 || !data.result) return null;

    const result = data.result[addr];
    if (!result) return null;

    const chainName = Object.entries(CHAIN_ID_MAP).find(([, id]) => id === chainId)?.[0] || "Unknown";
    const { score, riskLevel, flags } = calculateSecurityScore(result);

    return {
      contractAddress: addr,
      chainId,
      chainName,
      isOpenSource: toBool(result.is_open_source),
      isProxy: toBool(result.is_proxy),
      isMintable: toBool(result.is_mintable),
      canTakeBackOwnership: toBool(result.can_take_back_ownership),
      ownerChangeBalance: toBool(result.owner_change_balance),
      isHoneypot: toBool(result.is_honeypot),
      hasExternalCall: toBool(result.external_call),
      transferPausable: toBool(result.transfer_pausable),
      cannotSellAll: toBool(result.cannot_sell_all),
      buyTax: toNum(result.buy_tax),
      sellTax: toNum(result.sell_tax),
      holderCount: toNum(result.holder_count),
      totalSupply: result.total_supply || null,
      securityScore: score,
      riskLevel,
      flags,
    };
  } catch {
    return null;
  }
}

/**
 * Batch-fetch security for multiple contracts on the same chain.
 */
export async function fetchTokenSecurityBatch(
  chainId: number,
  addresses: string[]
): Promise<Map<string, GoPlusTokenSecurity>> {
  const map = new Map<string, GoPlusTokenSecurity>();
  if (addresses.length === 0) return map;

  try {
    const addrs = addresses.map((a) => a.toLowerCase()).join(",");
    const res = await fetch(
      `${BASE}/token_security/${chainId}?contract_addresses=${addrs}`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return map;

    const data = await res.json();
    if (data.code !== 1 || !data.result) return map;

    const chainName = Object.entries(CHAIN_ID_MAP).find(([, id]) => id === chainId)?.[0] || "Unknown";

    for (const [addr, result] of Object.entries(data.result)) {
      const raw = result as Record<string, string | undefined>;
      const { score, riskLevel, flags } = calculateSecurityScore(raw);

      map.set(addr, {
        contractAddress: addr,
        chainId,
        chainName,
        isOpenSource: toBool(raw.is_open_source),
        isProxy: toBool(raw.is_proxy),
        isMintable: toBool(raw.is_mintable),
        canTakeBackOwnership: toBool(raw.can_take_back_ownership),
        ownerChangeBalance: toBool(raw.owner_change_balance),
        isHoneypot: toBool(raw.is_honeypot),
        hasExternalCall: toBool(raw.external_call),
        transferPausable: toBool(raw.transfer_pausable),
        cannotSellAll: toBool(raw.cannot_sell_all),
        buyTax: toNum(raw.buy_tax),
        sellTax: toNum(raw.sell_tax),
        holderCount: toNum(raw.holder_count),
        totalSupply: raw.total_supply || null,
        securityScore: score,
        riskLevel,
        flags,
      });
    }
  } catch {
    // Graceful degradation
  }
  return map;
}

/**
 * Format security data for AI prompts.
 */
export function formatSecurityForPrompt(security: GoPlusTokenSecurity): string {
  const parts = [
    `Score: ${security.securityScore}/100`,
    `Open Source: ${security.isOpenSource === true ? "Yes" : security.isOpenSource === false ? "No" : "Unknown"}`,
    `Honeypot: ${security.isHoneypot === true ? "YES" : security.isHoneypot === false ? "No" : "Unknown"}`,
    `Mintable: ${security.isMintable === true ? "Yes" : security.isMintable === false ? "No" : "Unknown"}`,
  ];

  if (security.buyTax !== null) parts.push(`Buy Tax: ${(security.buyTax * 100).toFixed(1)}%`);
  if (security.sellTax !== null) parts.push(`Sell Tax: ${(security.sellTax * 100).toFixed(1)}%`);
  if (security.holderCount !== null) parts.push(`Holders: ${security.holderCount}`);
  if (security.flags.length > 0) parts.push(`Flags: ${security.flags.join("; ")}`);

  return parts.join(" | ");
}

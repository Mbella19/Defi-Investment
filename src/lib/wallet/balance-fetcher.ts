import { createPublicClient, http, formatUnits } from "viem";
import { mainnet, arbitrum, optimism, polygon, base, bsc, avalanche } from "viem/chains";
import { CHAIN_TOKEN_LISTS } from "./token-lists";
import { getRpcUrl } from "@/lib/rpc";
import type { WalletTokenBalance } from "@/types/wallet";

const chains = [mainnet, arbitrum, optimism, polygon, base, bsc, avalanche];

// ERC-20 balanceOf ABI fragment
const balanceOfAbi = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "balance", type: "uint256" }],
  },
] as const;

// Create one public client per chain. RPC URL comes from getRpcUrl which
// reads ALCHEMY_API_KEY / INFURA_API_KEY / per-chain RPC_URL_* env vars.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const clients: Record<number, any> = {};
for (const chain of chains) {
  clients[chain.id] = createPublicClient({
    chain,
    transport: http(getRpcUrl(chain.id)),
  });
}

async function fetchChainBalances(
  chainId: number,
  address: `0x${string}`
): Promise<WalletTokenBalance[]> {
  const client = clients[chainId];
  const chainConfig = CHAIN_TOKEN_LISTS.find((c) => c.chainId === chainId);
  if (!client || !chainConfig) return [];

  const results: WalletTokenBalance[] = [];

  // Fetch native balance + all ERC-20 balances in parallel
  const [nativeBalance, ...tokenResults] = await Promise.all([
    client.getBalance({ address }),
    ...(chainConfig.tokens.length > 0
      ? [
          client.multicall({
            contracts: chainConfig.tokens.map((token) => ({
              address: token.address,
              abi: balanceOfAbi,
              functionName: "balanceOf",
              args: [address],
            })),
            allowFailure: true,
          }),
        ]
      : []),
  ]);

  // Add native token
  if (nativeBalance > BigInt(0)) {
    results.push({
      chainId,
      chainName: chainConfig.chainName,
      symbol: chainConfig.nativeToken.symbol,
      name: chainConfig.nativeToken.name,
      balance: nativeBalance.toString(),
      decimals: chainConfig.nativeToken.decimals,
      geckoId: chainConfig.nativeToken.geckoId,
      isNative: true,
    });
  }

  // Add ERC-20 tokens with non-zero balances
  const multicallResults = tokenResults[0] as
    | { status: "success" | "failure"; result?: bigint }[]
    | undefined;

  if (multicallResults) {
    for (let i = 0; i < chainConfig.tokens.length; i++) {
      const res = multicallResults[i];
      if (res?.status === "success" && res.result && res.result > BigInt(0)) {
        results.push({
          chainId,
          chainName: chainConfig.chainName,
          symbol: chainConfig.tokens[i].symbol,
          name: chainConfig.tokens[i].name,
          balance: res.result.toString(),
          decimals: chainConfig.tokens[i].decimals,
          geckoId: chainConfig.tokens[i].geckoId,
          isNative: false,
        });
      }
    }
  }

  return results;
}

export async function fetchAllBalances(
  address: `0x${string}`
): Promise<{ balances: WalletTokenBalance[]; errors: string[] }> {
  const errors: string[] = [];

  const chainResults = await Promise.allSettled(
    chains.map((chain) => fetchChainBalances(chain.id, address))
  );

  const allBalances: WalletTokenBalance[] = [];

  for (let i = 0; i < chainResults.length; i++) {
    const result = chainResults[i];
    if (result.status === "fulfilled") {
      allBalances.push(...result.value);
    } else {
      errors.push(`${chains[i].name}: ${result.reason?.message || "Failed"}`);
    }
  }

  return { balances: allBalances, errors };
}

export { formatUnits };

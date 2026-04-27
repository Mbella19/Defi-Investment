export const ETHERSCAN_V2_BASE = "https://api.etherscan.io/v2/api";

export const CHAIN_ID_TO_NAME: Record<number, string> = {
  1: "Ethereum",
  10: "Optimism",
  56: "BSC",
  137: "Polygon",
  8453: "Base",
  42161: "Arbitrum",
  43114: "Avalanche",
  250: "Fantom",
};

export const CHAIN_NAME_TO_ID: Record<string, number> = Object.fromEntries(
  Object.entries(CHAIN_ID_TO_NAME).map(([id, name]) => [name, Number(id)])
);

// Known high-risk / label addresses — lowercased.
export const KNOWN_ADDRESSES: Record<string, { label: string; risk: "tornado" | "cex" | "mixer" | "bridge" }> = {
  "0x722122df12d4e14e13ac3b6895a86e84145b6967": { label: "Tornado Cash: Router", risk: "tornado" },
  "0x910cbd523d972eb0a6f4cae4618ad62622b39dbf": { label: "Tornado Cash: 10 ETH", risk: "tornado" },
  "0xa160cdab225685da1d56aa342ad8841c3b53f291": { label: "Tornado Cash: 100 ETH", risk: "tornado" },
  "0xd90e2f925da726b50c4ed8d0fb90ad053324f31b": { label: "Tornado Cash: 1 ETH", risk: "tornado" },
  "0x12d66f87a04a9e220743712ce6d9bb1b5616b8fc": { label: "Tornado Cash: 0.1 ETH", risk: "tornado" },
  "0x8589427373d6d84e98730d7795d8f6f8731fda16": { label: "Tornado Cash Router", risk: "tornado" },
  "0x28c6c06298d514db089934071355e5743bf21d60": { label: "Binance: Hot Wallet 14", risk: "cex" },
  "0x21a31ee1afc51d94c2efccaa2092ad1028285549": { label: "Binance: Hot Wallet 15", risk: "cex" },
  "0xdfd5293d8e347dfe59e90efd55b2956a1343963d": { label: "Binance: Hot Wallet 16", risk: "cex" },
  "0x56eddb7aa87536c09ccc2793473599fd21a8b17f": { label: "Binance: Hot Wallet 17", risk: "cex" },
  "0xf977814e90da44bfa03b6295a0616a897441acec": { label: "Binance: Hot Wallet 20", risk: "cex" },
  "0x5a52e96bacdabb82fd05763e25335261b270efcb": { label: "Binance: Hot Wallet 22", risk: "cex" },
  "0xa910f92acdaf488fa6ef02174fb86208ad7722ba": { label: "Binance: Hot Wallet 21", risk: "cex" },
  "0x46340b20830761efd32832a74d7169b29feb9758": { label: "Crypto.com: Hot Wallet", risk: "cex" },
  "0xa7efae728d2936e78bda97dc267687568dd593f3": { label: "OKX Hot Wallet", risk: "cex" },
  "0x3cd751e6b0078be393132286c442345e5dc49699": { label: "Coinbase: Hot Wallet", risk: "cex" },
  "0xb5d85cbf7cb3ee0d56b3bb207d5fc4b82f43f511": { label: "Coinbase: Hot Wallet 2", risk: "cex" },
  "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48": { label: "USDC Contract", risk: "bridge" },
};

function resolveApiKey(): string {
  const key = process.env.ETHERSCAN_API_KEY;
  if (!key) {
    throw new Error(
      "ETHERSCAN_API_KEY is not set. Add it to .env.local — get a free key at https://etherscan.io/apis"
    );
  }
  return key;
}

type EtherscanResponse<T> = {
  status: string;
  message: string;
  result: T;
};

/** Strip `apikey=...` from any string before logging it. Etherscan has no
 *  header-based auth, so the key has to live in the query — but it must
 *  never reach console output, error reporters, or thrown error messages. */
function scrubApiKey(text: string): string {
  return text.replace(/([?&])apikey=[^&\s]*/gi, "$1apikey=REDACTED");
}

async function call<T>(params: Record<string, string>, revalidateSeconds = 3600): Promise<T> {
  const apikey = resolveApiKey();
  const search = new URLSearchParams({ ...params, apikey });
  const url = `${ETHERSCAN_V2_BASE}?${search.toString()}`;

  const res = await fetch(url, { next: { revalidate: revalidateSeconds } }).catch((err) => {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(scrubApiKey(`Block explorer fetch failed: ${msg}`));
  });
  if (!res.ok) throw new Error(`Block explorer HTTP ${res.status}`);
  const json = (await res.json()) as EtherscanResponse<T>;

  if (json.status === "0" && typeof json.result === "string") {
    const msg = json.result as string;
    if (msg === "Contract source code not verified") {
      throw new Error("SOURCE_UNVERIFIED");
    }
    if (msg.toLowerCase().includes("rate limit")) {
      throw new Error("Block explorer rate limit exceeded");
    }
    if (msg.toLowerCase().includes("invalid api key")) {
      throw new Error("Invalid block explorer API key");
    }
  }

  return json.result;
}

export interface ContractCreation {
  contractAddress: string;
  contractCreator: string;
  txHash: string;
}

export async function getContractCreation(
  chainId: number,
  address: string
): Promise<ContractCreation | null> {
  try {
    const result = await call<ContractCreation[]>({
      chainid: String(chainId),
      module: "contract",
      action: "getcontractcreation",
      contractaddresses: address.toLowerCase(),
    });
    return Array.isArray(result) && result.length > 0 ? result[0] : null;
  } catch (err) {
    if (err instanceof Error && /ETHERSCAN_API_KEY|rate limit|Invalid Etherscan API key/i.test(err.message)) {
      throw err;
    }
    return null;
  }
}

export interface ContractSource {
  SourceCode: string;
  ABI: string;
  ContractName: string;
  CompilerVersion: string;
  OptimizationUsed: string;
  Runs: string;
  ConstructorArguments: string;
  EVMVersion: string;
  Library: string;
  LicenseType: string;
  Proxy: string;
  Implementation: string;
  SwarmSource: string;
}

export async function getContractSource(
  chainId: number,
  address: string
): Promise<ContractSource | null> {
  try {
    const result = await call<ContractSource[]>(
      {
        chainid: String(chainId),
        module: "contract",
        action: "getsourcecode",
        address: address.toLowerCase(),
      },
      86400
    );
    if (!Array.isArray(result) || result.length === 0) return null;
    const entry = result[0];
    if (!entry.SourceCode || entry.SourceCode.trim() === "") return null;
    return entry;
  } catch (err) {
    if (err instanceof Error && /ETHERSCAN_API_KEY|rate limit|Invalid Etherscan API key/i.test(err.message)) {
      throw err;
    }
    return null;
  }
}

export interface EtherscanTx {
  blockNumber: string;
  timeStamp: string;
  hash: string;
  nonce: string;
  from: string;
  to: string;
  value: string;
  gas: string;
  gasPrice: string;
  isError: string;
  contractAddress: string;
  functionName?: string;
}

export async function getNormalTxs(
  chainId: number,
  address: string,
  opts: { startblock?: number; endblock?: number; page?: number; offset?: number; sort?: "asc" | "desc" } = {}
): Promise<EtherscanTx[]> {
  try {
    const result = await call<EtherscanTx[]>(
      {
        chainid: String(chainId),
        module: "account",
        action: "txlist",
        address: address.toLowerCase(),
        startblock: String(opts.startblock ?? 0),
        endblock: String(opts.endblock ?? 99999999),
        page: String(opts.page ?? 1),
        offset: String(opts.offset ?? 100),
        sort: opts.sort ?? "asc",
      },
      1800
    );
    return Array.isArray(result) ? result : [];
  } catch {
    return [];
  }
}

export interface EtherscanTokenTx {
  blockNumber: string;
  timeStamp: string;
  hash: string;
  from: string;
  to: string;
  value: string;
  tokenName: string;
  tokenSymbol: string;
  tokenDecimal: string;
  contractAddress: string;
}

/**
 * ERC-20 token transfers for an address. Used by the drain-detection heuristic
 * since real DeFi exploits move tokens (USDC/USDT/wBTC/etc.), not native ETH —
 * `getNormalTxs` only sees `tx.value` which is zero for token-only transfers.
 */
export async function getTokenTxs(
  chainId: number,
  address: string,
  opts: { startblock?: number; endblock?: number; page?: number; offset?: number; sort?: "asc" | "desc" } = {}
): Promise<EtherscanTokenTx[]> {
  try {
    const result = await call<EtherscanTokenTx[]>(
      {
        chainid: String(chainId),
        module: "account",
        action: "tokentx",
        address: address.toLowerCase(),
        startblock: String(opts.startblock ?? 0),
        endblock: String(opts.endblock ?? 99999999),
        page: String(opts.page ?? 1),
        offset: String(opts.offset ?? 1000),
        sort: opts.sort ?? "desc",
      },
      900
    );
    return Array.isArray(result) ? result : [];
  } catch {
    return [];
  }
}

/**
 * Normalize a multi-file Solidity SourceCode string (Etherscan returns either
 * raw source, JSON standard input, or `{{...}}` wrapped JSON) into a single
 * concatenated source.
 */
export function normalizeSourceCode(source: string): { combined: string; files: Record<string, string> } {
  const trimmed = source.trim();

  // Double-brace wrapped JSON standard input
  if (trimmed.startsWith("{{") && trimmed.endsWith("}}")) {
    try {
      const json = JSON.parse(trimmed.slice(1, -1));
      const sources = (json.sources || {}) as Record<string, { content: string }>;
      const files: Record<string, string> = {};
      const parts: string[] = [];
      for (const [path, { content }] of Object.entries(sources)) {
        files[path] = content;
        parts.push(`// === FILE: ${path} ===\n${content}`);
      }
      return { combined: parts.join("\n\n"), files };
    } catch {
      /* fallthrough */
    }
  }

  // Single-brace JSON
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      const json = JSON.parse(trimmed);
      if (json.sources) {
        const sources = json.sources as Record<string, { content: string }>;
        const files: Record<string, string> = {};
        const parts: string[] = [];
        for (const [path, { content }] of Object.entries(sources)) {
          files[path] = content;
          parts.push(`// === FILE: ${path} ===\n${content}`);
        }
        return { combined: parts.join("\n\n"), files };
      }
    } catch {
      /* fallthrough */
    }
  }

  // Raw single-file source
  return { combined: trimmed, files: { "main.sol": trimmed } };
}

import { fetchWithTimeout } from "@/lib/fetch-utils";

export const ETHERSCAN_V2_BASE = "https://api.etherscan.io/v2/api";

// Stable error codes for config-level failures. Callers match on these
// EXACT strings to decide throw-vs-null — previously the thrown text and the
// matcher regex drifted apart and invalid-key errors were silently swallowed
// into null results.
export const ETHERSCAN_ERR_NO_KEY = "ETHERSCAN_API_KEY_MISSING";
export const ETHERSCAN_ERR_INVALID_KEY = "ETHERSCAN_API_KEY_INVALID";
export const ETHERSCAN_ERR_RATE_LIMIT = "ETHERSCAN_RATE_LIMIT";

const CONFIG_ERROR_RE = new RegExp(
  `${ETHERSCAN_ERR_NO_KEY}|${ETHERSCAN_ERR_INVALID_KEY}|${ETHERSCAN_ERR_RATE_LIMIT}`,
);

/** True for errors that indicate operator misconfiguration or quota — these
 *  must surface to the caller instead of degrading to a null result. */
export function isEtherscanConfigError(err: unknown): boolean {
  return err instanceof Error && CONFIG_ERROR_RE.test(err.message);
}

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

function resolveApiKey(): string {
  const key = process.env.ETHERSCAN_API_KEY;
  if (!key) {
    throw new Error(
      `${ETHERSCAN_ERR_NO_KEY}: ETHERSCAN_API_KEY is not set. Add it to .env.local — get a free key at https://etherscan.io/apis`
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

async function call<T>(params: Record<string, string>): Promise<T> {
  const apikey = resolveApiKey();
  const search = new URLSearchParams({ ...params, apikey });
  const url = `${ETHERSCAN_V2_BASE}?${search.toString()}`;

  // fetchWithTimeout (10s) per repo convention — a hung explorer connection
  // otherwise blocks the contract-review workflow until Next's maxDuration.
  // Do not put credential-bearing request URLs into Next's persistent fetch
  // cache metadata. Higher-level audit storage retains safe derived results.
  const res = await fetchWithTimeout(url, { cache: "no-store" }).catch(
    (err) => {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(scrubApiKey(`Block explorer fetch failed: ${msg}`));
    },
  );
  if (!res.ok) throw new Error(`Block explorer HTTP ${res.status}`);
  const json = (await res.json()) as EtherscanResponse<T>;

  if (json.status === "0" && typeof json.result === "string") {
    const msg = json.result as string;
    if (msg === "Contract source code not verified") {
      throw new Error("SOURCE_UNVERIFIED");
    }
    if (msg.toLowerCase().includes("rate limit")) {
      throw new Error(`${ETHERSCAN_ERR_RATE_LIMIT}: block explorer rate limit exceeded`);
    }
    if (msg.toLowerCase().includes("invalid api key")) {
      throw new Error(`${ETHERSCAN_ERR_INVALID_KEY}: invalid block explorer API key`);
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
    if (isEtherscanConfigError(err)) {
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
    const result = await call<ContractSource[]>({
      chainid: String(chainId),
      module: "contract",
      action: "getsourcecode",
      address: address.toLowerCase(),
    });
    if (!Array.isArray(result) || result.length === 0) return null;
    const entry = result[0];
    if (!entry.SourceCode || entry.SourceCode.trim() === "") return null;
    return entry;
  } catch (err) {
    if (isEtherscanConfigError(err)) {
      throw err;
    }
    return null;
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
 * since real DeFi exploits commonly move ERC-20 assets rather than native ETH.
 */
export async function getTokenTxs(
  chainId: number,
  address: string,
  opts: { startblock?: number; endblock?: number; page?: number; offset?: number; sort?: "asc" | "desc" } = {}
): Promise<EtherscanTokenTx[]> {
  const result = await call<EtherscanTokenTx[]>({
    chainid: String(chainId),
    module: "account",
    action: "tokentx",
    address: address.toLowerCase(),
    startblock: String(opts.startblock ?? 0),
    endblock: String(opts.endblock ?? 99999999),
    page: String(opts.page ?? 1),
    offset: String(opts.offset ?? 1000),
    sort: opts.sort ?? "desc",
  });
  return Array.isArray(result) ? result : [];
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

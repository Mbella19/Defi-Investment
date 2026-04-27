import { createHash } from "crypto";
import {
  createPublicClient,
  http,
  type PublicClient,
  type Address,
  type Hex,
  isAddress,
  getAddress,
} from "viem";
import {
  mainnet,
  arbitrum,
  optimism,
  polygon,
  base,
  bsc,
  avalanche,
  fantom,
} from "viem/chains";
import type {
  AdminInfo,
  ContractMeta,
  OnChainInterrogation,
  ProxyInfo,
  ToolFinding,
} from "@/types/audit";
import { CHAIN_ID_TO_NAME, getContractCreation, getContractSource } from "../etherscan";
import { getRpcUrl } from "@/lib/rpc";

/* ==================== CHAIN CLIENTS ==================== */

const CHAINS = {
  1: mainnet,
  10: optimism,
  56: bsc,
  137: polygon,
  250: fantom,
  8453: base,
  42161: arbitrum,
  43114: avalanche,
} as const;

type SupportedChainId = keyof typeof CHAINS;

const clientCache = new Map<number, PublicClient>();

function getClient(chainId: number): PublicClient | null {
  const chain = CHAINS[chainId as SupportedChainId];
  if (!chain) return null;
  const cached = clientCache.get(chainId);
  if (cached) return cached;
  const client = createPublicClient({
    chain,
    transport: http(getRpcUrl(chainId)),
  }) as PublicClient;
  clientCache.set(chainId, client);
  return client;
}

/* ==================== EIP-1967 STORAGE SLOTS ==================== */

// keccak256("eip1967.proxy.implementation") - 1
const SLOT_IMPL = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc" as const;
// keccak256("eip1967.proxy.admin") - 1
const SLOT_ADMIN = "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103" as const;
// keccak256("eip1967.proxy.beacon") - 1
const SLOT_BEACON = "0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50" as const;
// OpenZeppelin pre-1967 admin slot (legacy transparent proxy)
const SLOT_OZ_LEGACY_ADMIN = "0x10d6a54a4754c8869d6886b5f5d7fbfa5b4522237ea5c60d11bc4e7a1ff9390b" as const;

const ZERO_ADDR = "0x0000000000000000000000000000000000000000";

function slotToAddress(slotValue: Hex | undefined): string | undefined {
  if (!slotValue || slotValue === "0x") return undefined;
  // Storage slots are 32 bytes; addresses are the last 20 bytes (40 hex chars).
  const stripped = slotValue.replace(/^0x/, "").padStart(64, "0");
  const tail = stripped.slice(24);
  if (/^0+$/.test(tail)) return undefined;
  try {
    return getAddress(`0x${tail}`);
  } catch {
    return undefined;
  }
}

/* ==================== ABIS ==================== */

const OWNER_ABI = [
  { name: "owner", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
] as const;

const ADMIN_ABI = [
  { name: "admin", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
] as const;

const SAFE_ABI = [
  { name: "getThreshold", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { name: "getOwners", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "address[]" }] },
] as const;

const OZ_TIMELOCK_ABI = [
  { name: "getMinDelay", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
] as const;

const COMPOUND_TIMELOCK_ABI = [
  { name: "delay", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
] as const;

/* ==================== INTERROGATOR ENTRY POINT ==================== */

export interface InterrogateOpts {
  /** If known from elsewhere (e.g. deployer-forensics cache), pass to skip Etherscan. */
  deployerAddress?: string;
  deployedAt?: number;
  /** Verified contract name + compiler if known — saves an Etherscan call. */
  contractName?: string;
  compilerVersion?: string;
  isVerified?: boolean;
}

export async function interrogateContract(
  address: string,
  chainId: number,
  opts: InterrogateOpts = {}
): Promise<OnChainInterrogation> {
  const errors: string[] = [];
  const findings: ToolFinding[] = [];

  if (!isAddress(address)) {
    return emptyResult(address, chainId, [`invalid address: ${address}`]);
  }
  const checksummed = getAddress(address) as Address;

  const client = getClient(chainId);
  if (!client) {
    return emptyResult(address, chainId, [`chain ${chainId} not supported by interrogator`]);
  }

  // Step 1: bytecode + contract age in parallel
  const [code, creationInfo] = await Promise.all([
    safeCall(() => client.getBytecode({ address: checksummed }), errors, "getBytecode"),
    opts.deployerAddress && opts.deployedAt
      ? Promise.resolve({
          contractCreator: opts.deployerAddress,
          deployedAt: opts.deployedAt,
        })
      : fetchCreationFromEtherscan(chainId, checksummed),
  ]);

  const bytecodeSize = code ? Math.floor((code.length - 2) / 2) : 0;
  const hasCode = bytecodeSize > 0;

  // Step 2: optional contract metadata (skip if caller already has it)
  let verifiedMeta: { name?: string; compiler?: string; isVerified: boolean } = {
    name: opts.contractName,
    compiler: opts.compilerVersion,
    isVerified: opts.isVerified ?? false,
  };
  if (!opts.contractName || opts.isVerified === undefined) {
    try {
      const src = await getContractSource(chainId, checksummed);
      if (src) {
        verifiedMeta = {
          name: src.ContractName || opts.contractName,
          compiler: src.CompilerVersion || opts.compilerVersion,
          isVerified: true,
        };
      } else if (opts.isVerified === undefined) {
        verifiedMeta.isVerified = false;
      }
    } catch {
      /* etherscan may rate-limit; treat as unknown */
    }
  }

  const meta: ContractMeta = {
    address: checksummed,
    chainId,
    chainName: CHAIN_ID_TO_NAME[chainId] ?? `chain-${chainId}`,
    bytecodeSize,
    hasCode,
    contractName: verifiedMeta.name,
    compilerVersion: verifiedMeta.compiler,
    isVerified: verifiedMeta.isVerified,
    deployedAt: creationInfo?.deployedAt,
    ageDays: creationInfo?.deployedAt
      ? Math.max(0, Math.floor((Date.now() / 1000 - creationInfo.deployedAt) / 86400))
      : undefined,
    deployerAddress: creationInfo?.contractCreator,
  };

  if (!hasCode) {
    findings.push(makeFinding({
      address: checksummed,
      chainId,
      detector: "no_bytecode",
      severity: "critical",
      category: "other",
      title: "Address has no bytecode",
      description: "The target address contains no code. It is either an EOA, a self-destructed contract, or a not-yet-deployed address. No on-chain analysis is possible.",
    }));
    return {
      meta,
      proxy: { isProxy: false, pattern: "none", detected: true },
      admin: {},
      findings,
      errors,
    };
  }

  // Step 3: proxy detection (parallel slot reads + minimal proxy bytecode check)
  const proxy = await detectProxy(client, checksummed, code as Hex, errors);

  // Step 4: admin/owner discovery — query the implementation if we have one,
  // otherwise the contract itself. (UUPS keeps `owner()` on impl; transparent
  // can have an admin contract.)
  const adminTarget = (proxy.implementationAddress as Address | undefined) ?? checksummed;
  const admin = await discoverAdmin(client, adminTarget, errors);

  // Step 5: derive findings from on-chain state
  findings.push(...deriveFindings(checksummed, chainId, meta, proxy, admin));

  return {
    meta,
    proxy,
    admin,
    findings,
    errors,
  };
}

/* ==================== HELPERS ==================== */

async function fetchCreationFromEtherscan(
  chainId: number,
  address: string
): Promise<{ contractCreator: string; deployedAt?: number } | null> {
  try {
    const creation = await getContractCreation(chainId, address);
    if (!creation) return null;
    return { contractCreator: creation.contractCreator };
  } catch {
    return null;
  }
}

async function safeCall<T>(
  fn: () => Promise<T>,
  errors: string[],
  label: string
): Promise<T | undefined> {
  try {
    return await fn();
  } catch (err) {
    errors.push(`${label}: ${err instanceof Error ? err.message : String(err)}`);
    return undefined;
  }
}

/* ---------- proxy detection ---------- */

async function detectProxy(
  client: PublicClient,
  address: Address,
  code: Hex,
  errors: string[]
): Promise<ProxyInfo> {
  // EIP-1167 minimal proxy: deterministic 45-byte runtime starting with `0x363d3d373d3d3d363d73`.
  const codeLower = code.toLowerCase();
  if (codeLower.startsWith("0x363d3d373d3d3d363d73") && codeLower.length >= 90) {
    const target = `0x${codeLower.slice(22, 62)}`;
    let impl: string | undefined;
    try {
      impl = getAddress(target);
    } catch {
      /* malformed */
    }
    return {
      isProxy: true,
      pattern: "minimal",
      implementationAddress: impl,
      detected: true,
    };
  }

  const [implRaw, adminRaw, beaconRaw, ozLegacyAdminRaw] = await Promise.all([
    safeCall(() => client.getStorageAt({ address, slot: SLOT_IMPL }), errors, "slot:impl"),
    safeCall(() => client.getStorageAt({ address, slot: SLOT_ADMIN }), errors, "slot:admin"),
    safeCall(() => client.getStorageAt({ address, slot: SLOT_BEACON }), errors, "slot:beacon"),
    safeCall(() => client.getStorageAt({ address, slot: SLOT_OZ_LEGACY_ADMIN }), errors, "slot:legacy_admin"),
  ]);

  const impl = slotToAddress(implRaw);
  const adminFromSlot = slotToAddress(adminRaw) ?? slotToAddress(ozLegacyAdminRaw);
  const beacon = slotToAddress(beaconRaw);

  if (beacon) {
    // Beacon proxy — beacon contract holds the implementation
    let beaconImpl: string | undefined;
    try {
      const result = await client.readContract({
        address: beacon as Address,
        abi: [
          {
            name: "implementation",
            type: "function",
            stateMutability: "view",
            inputs: [],
            outputs: [{ type: "address" }],
          },
        ] as const,
        functionName: "implementation",
      });
      beaconImpl = result as string;
    } catch (err) {
      errors.push(`beacon.implementation(): ${err instanceof Error ? err.message : String(err)}`);
    }
    return {
      isProxy: true,
      pattern: "beacon",
      implementationAddress: beaconImpl,
      adminAddress: adminFromSlot,
      beaconAddress: beacon,
      detected: true,
    };
  }

  if (impl) {
    // UUPS keeps logic on impl with no separate admin slot;
    // Transparent puts the admin in slot.
    const pattern = adminFromSlot ? "transparent" : "uups";
    return {
      isProxy: true,
      pattern,
      implementationAddress: impl,
      adminAddress: adminFromSlot,
      detected: true,
    };
  }

  return {
    isProxy: false,
    pattern: "none",
    detected: true,
  };
}

/* ---------- admin / owner discovery ---------- */

async function discoverAdmin(
  client: PublicClient,
  target: Address,
  errors: string[]
): Promise<AdminInfo> {
  const info: AdminInfo = {};

  // Read owner() — most ERC-173 / Ownable contracts expose it.
  let ownerAddr: string | undefined;
  try {
    const owner = await client.readContract({
      address: target,
      abi: OWNER_ABI,
      functionName: "owner",
    });
    if (owner && typeof owner === "string") ownerAddr = owner;
  } catch {
    // Try admin() as a fallback (some governance contracts expose it instead).
    try {
      const admin = await client.readContract({
        address: target,
        abi: ADMIN_ABI,
        functionName: "admin",
      });
      if (admin && typeof admin === "string") ownerAddr = admin;
    } catch {
      /* neither owner() nor admin() — bail */
    }
  }

  if (!ownerAddr) return info;
  info.ownerAddress = ownerAddr;

  if (ownerAddr.toLowerCase() === ZERO_ADDR) {
    info.renounced = true;
    return info;
  }

  // Is the owner a contract? (multisig / timelock check requires this)
  const ownerCode = await safeCall(
    () => client.getBytecode({ address: ownerAddr as Address }),
    errors,
    "owner:getBytecode"
  );
  info.ownerIsContract = !!(ownerCode && ownerCode.length > 2);

  if (!info.ownerIsContract) return info;

  // Try Gnosis Safe interface
  const [threshold, owners] = await Promise.all([
    safeReadContract(client, ownerAddr as Address, SAFE_ABI, "getThreshold"),
    safeReadContract(client, ownerAddr as Address, SAFE_ABI, "getOwners"),
  ]);
  if (typeof threshold === "bigint" && Array.isArray(owners)) {
    info.multisigThreshold = Number(threshold);
    info.multisigOwners = owners.length;
  }

  // Try OZ TimelockController
  const ozDelay = await safeReadContract(client, ownerAddr as Address, OZ_TIMELOCK_ABI, "getMinDelay");
  if (typeof ozDelay === "bigint") {
    info.timelockDelaySeconds = Number(ozDelay);
  } else {
    // Try Compound-style Timelock
    const cmpDelay = await safeReadContract(client, ownerAddr as Address, COMPOUND_TIMELOCK_ABI, "delay");
    if (typeof cmpDelay === "bigint") info.timelockDelaySeconds = Number(cmpDelay);
  }

  return info;
}

async function safeReadContract<T = unknown>(
  client: PublicClient,
  address: Address,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  abi: any,
  fn: string
): Promise<T | undefined> {
  try {
    const out = await client.readContract({
      address,
      abi,
      functionName: fn,
    });
    return out as T;
  } catch {
    return undefined;
  }
}

/* ---------- derive findings from on-chain state ---------- */

function deriveFindings(
  address: string,
  chainId: number,
  meta: ContractMeta,
  proxy: ProxyInfo,
  admin: AdminInfo
): ToolFinding[] {
  const out: ToolFinding[] = [];

  // 1) Centralization: owner exists, EOA, no timelock, no multisig
  if (admin.ownerAddress && !admin.renounced) {
    const isMultisig = (admin.multisigOwners ?? 0) > 1 && (admin.multisigThreshold ?? 0) > 1;
    const hasTimelock = (admin.timelockDelaySeconds ?? 0) >= 3600; // ≥1h

    if (admin.ownerIsContract === false) {
      out.push(makeFinding({
        address, chainId,
        detector: "owner_is_eoa",
        severity: "high",
        category: "centralization",
        title: "Owner is an externally-owned account (EOA)",
        description: `The contract is owned by ${admin.ownerAddress}, an EOA (no bytecode). A single private-key compromise gives an attacker full owner privileges — there is no multisig or timelock guard. Most production protocols delegate ownership to a Gnosis Safe multisig and a TimelockController.`,
        confidence: "confirmed",
      }));
    } else if (!isMultisig && !hasTimelock) {
      out.push(makeFinding({
        address, chainId,
        detector: "owner_unknown_contract",
        severity: "medium",
        category: "centralization",
        title: "Owner is a contract but neither multisig nor timelock",
        description: `Owner ${admin.ownerAddress} is a contract, but standard Gnosis Safe (getThreshold/getOwners) and Timelock (getMinDelay/delay) interfaces did not respond. The owner contract may be a custom controller — review its source separately. Without a recognizable multisig threshold or execution delay, owner privileges are still effectively controlled by whoever holds the keys to that contract.`,
        confidence: "medium",
      }));
    } else if (isMultisig && (admin.multisigThreshold ?? 0) === 1) {
      out.push(makeFinding({
        address, chainId,
        detector: "multisig_threshold_one",
        severity: "high",
        category: "centralization",
        title: "Multisig threshold is 1",
        description: `Owner is a multisig with ${admin.multisigOwners} signers but threshold is 1. Any single signer can execute — no quorum is required. This defeats the purpose of a multisig.`,
        confidence: "confirmed",
      }));
    }

    if (isMultisig && !hasTimelock) {
      out.push(makeFinding({
        address, chainId,
        detector: "missing_timelock",
        severity: "medium",
        category: "centralization",
        title: "Owner multisig has no timelock",
        description: `Owner is a ${admin.multisigThreshold}/${admin.multisigOwners} multisig but no execution delay (TimelockController / Compound Timelock) was detected. Privileged actions take effect immediately, leaving users no time to exit if a malicious upgrade or parameter change is queued.`,
        confidence: "high",
      }));
    } else if (hasTimelock && (admin.timelockDelaySeconds ?? 0) < 86400) {
      out.push(makeFinding({
        address, chainId,
        detector: "short_timelock",
        severity: "low",
        category: "centralization",
        title: `Timelock delay is short (${Math.floor((admin.timelockDelaySeconds ?? 0) / 60)} min)`,
        description: `Owner timelock delay is ${admin.timelockDelaySeconds}s — under 24 hours, leaving little time for users to react to a queued malicious operation. Industry norm is 24-72h for production protocols.`,
        confidence: "high",
      }));
    }
  }

  // 2) Proxy upgradeability — informational unless admin is risky
  if (proxy.isProxy) {
    const sev = (admin.ownerIsContract === false || (admin.multisigThreshold === 1))
      ? "high"
      : "medium";
    out.push(makeFinding({
      address, chainId,
      detector: `proxy_${proxy.pattern}`,
      severity: sev,
      category: "upgrade_proxy",
      title: `Upgradeable proxy (${proxy.pattern}) — implementation can be replaced`,
      description: [
        `Contract is a ${proxy.pattern} proxy.`,
        proxy.implementationAddress ? `Current implementation: ${proxy.implementationAddress}.` : "",
        proxy.adminAddress ? `Proxy admin: ${proxy.adminAddress}.` : "",
        proxy.beaconAddress ? `Beacon: ${proxy.beaconAddress}.` : "",
        `Whoever controls the proxy admin can upgrade the logic at any time, replacing the audited code with arbitrary new code (drain user funds, brick withdrawals, mint unlimited tokens). The risk reduces to the admin's controls — verify that the admin is a multisig + timelock before depositing.`,
      ].filter(Boolean).join(" "),
      confidence: "confirmed",
    }));
  }

  // 3) Verification status
  if (!meta.isVerified) {
    out.push(makeFinding({
      address, chainId,
      detector: "unverified_source",
      severity: "high",
      category: "code_quality",
      title: "Contract source code is not verified",
      description: "Source code is not published to a public block explorer. The bytecode cannot be matched to readable Solidity, so static analysis and human review are not possible. Treat as opaque — do not interact unless the protocol explicitly justifies why.",
      confidence: "confirmed",
    }));
  }

  // 4) Very young contract — informational
  if (meta.ageDays !== undefined && meta.ageDays < 30) {
    out.push(makeFinding({
      address, chainId,
      detector: "very_young_contract",
      severity: "low",
      category: "other",
      title: `Contract deployed less than 30 days ago (${meta.ageDays}d)`,
      description: `Contract age is ${meta.ageDays} days. Vulnerabilities often surface in the first weeks of mainnet exposure (see history of post-launch reentrancy / oracle issues). Apply extra caution and prefer protocols with sustained operation history.`,
      confidence: "high",
    }));
  }

  return out;
}

/* ---------- finding factory ---------- */

interface MakeFindingArgs {
  address: string;
  chainId: number;
  detector: string;
  severity: import("@/types/audit").AuditSeverity;
  category: import("@/types/audit").AuditCategory;
  title: string;
  description: string;
  confidence?: import("@/types/audit").AuditConfidence;
}

function makeFinding(args: MakeFindingArgs): ToolFinding {
  const id = createHash("sha1")
    .update(`onchain|${args.detector}|${args.address}|${args.chainId}`)
    .digest("hex")
    .slice(0, 16);
  return {
    id,
    tool: "onchain_interrogator",
    category: args.category,
    severity: args.severity,
    confidence: args.confidence ?? "high",
    title: args.title,
    description: args.description,
    rawDetectorId: args.detector,
  };
}

/* ---------- empty/error result ---------- */

function emptyResult(address: string, chainId: number, errors: string[]): OnChainInterrogation {
  return {
    meta: {
      address,
      chainId,
      chainName: CHAIN_ID_TO_NAME[chainId] ?? `chain-${chainId}`,
      bytecodeSize: 0,
      hasCode: false,
      isVerified: false,
    },
    proxy: { isProxy: false, pattern: "none", detected: false },
    admin: {},
    findings: [],
    errors,
  };
}

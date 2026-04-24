import type {
  DeployerForensicsReport,
  DeployerFlag,
  DeployerRiskLevel,
  DeployerTrace,
  FundingSource,
  OtherDeployment,
} from "@/types/security";
import {
  CHAIN_ID_TO_NAME,
  KNOWN_ADDRESSES,
  getContractCreation,
  getNormalTxs,
} from "./etherscan";
import { invokeClaude, extractJson } from "./claude-client";

const cache = new Map<string, { report: DeployerForensicsReport; expiresAt: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000;

function cacheKey(chainId: number, address: string): string {
  return `${chainId}:${address.toLowerCase()}`;
}

function classifyAddress(address: string): FundingSource["riskCategory"] {
  const known = KNOWN_ADDRESSES[address.toLowerCase()];
  if (known) return known.risk;
  return "unknown";
}

async function traceCreator(
  chainId: number,
  creator: string
): Promise<{
  firstSeen: number | null;
  txCount: number | null;
  fundingSources: FundingSource[];
  otherDeployments: OtherDeployment[];
}> {
  const txs = await getNormalTxs(chainId, creator, { offset: 200, sort: "asc" });

  if (txs.length === 0) {
    return { firstSeen: null, txCount: null, fundingSources: [], otherDeployments: [] };
  }

  const firstTx = txs[0];
  const firstSeen = firstTx.timeStamp ? parseInt(firstTx.timeStamp, 10) : null;

  const fundingSources: FundingSource[] = [];
  const seenFunders = new Set<string>();

  for (const tx of txs) {
    if (tx.isError === "1") continue;
    if (tx.to?.toLowerCase() !== creator.toLowerCase()) continue;
    const value = Number(tx.value || "0");
    if (value <= 0) continue;

    const from = tx.from?.toLowerCase();
    if (!from || seenFunders.has(from)) continue;
    seenFunders.add(from);

    const known = KNOWN_ADDRESSES[from];
    fundingSources.push({
      address: from,
      label: known?.label ?? null,
      firstFundingTxHash: tx.hash,
      firstFundingValueEth: value / 1e18,
      firstFundingTimestamp: parseInt(tx.timeStamp, 10),
      riskCategory: classifyAddress(from),
    });

    if (fundingSources.length >= 5) break;
  }

  const otherDeployments: OtherDeployment[] = [];
  for (const tx of txs) {
    if (tx.isError === "1") continue;
    if (!tx.contractAddress || tx.contractAddress === "") continue;
    otherDeployments.push({
      address: tx.contractAddress.toLowerCase(),
      creationTxHash: tx.hash,
      creationTimestamp: parseInt(tx.timeStamp, 10),
      label: null,
    });
    if (otherDeployments.length >= 20) break;
  }

  return {
    firstSeen,
    txCount: txs.length >= 200 ? null : txs.length,
    fundingSources,
    otherDeployments,
  };
}

function deriveFlags(trace: Omit<DeployerTrace, "flags">): DeployerFlag[] {
  const flags: DeployerFlag[] = [];

  if (trace.creatorAgeDays !== null && trace.creatorAgeDays < 30) {
    flags.push({
      severity: "high",
      code: "FRESH_DEPLOYER",
      message: `Deployer wallet is only ${trace.creatorAgeDays} days old`,
    });
  } else if (trace.creatorAgeDays !== null && trace.creatorAgeDays < 180) {
    flags.push({
      severity: "medium",
      code: "YOUNG_DEPLOYER",
      message: `Deployer wallet is ${trace.creatorAgeDays} days old`,
    });
  }

  const tornadoFunding = trace.fundingSources.find((f) => f.riskCategory === "tornado" || f.riskCategory === "mixer");
  if (tornadoFunding) {
    flags.push({
      severity: "critical",
      code: "MIXER_FUNDED",
      message: `Initial funding traced to ${tornadoFunding.label || "mixer"}`,
    });
  }

  if (trace.otherDeployments.length > 10) {
    flags.push({
      severity: "medium",
      code: "SERIAL_DEPLOYER",
      message: `Creator has deployed ${trace.otherDeployments.length}+ contracts`,
    });
  }

  if (trace.fundingSources.length === 0) {
    flags.push({
      severity: "low",
      code: "NO_FUNDING_TRACE",
      message: "No funding sources resolved (wallet may be too new or API limited)",
    });
  }

  if (trace.creatorTxCount !== null && trace.creatorTxCount < 5) {
    flags.push({
      severity: "medium",
      code: "LOW_ACTIVITY",
      message: `Creator has only ${trace.creatorTxCount} total transactions`,
    });
  }

  return flags;
}

function scoreFromFlags(flags: DeployerFlag[]): number {
  let score = 100;
  for (const f of flags) {
    if (f.severity === "critical") score -= 40;
    else if (f.severity === "high") score -= 20;
    else if (f.severity === "medium") score -= 10;
    else if (f.severity === "low") score -= 4;
  }
  return Math.max(0, Math.min(100, score));
}

function levelFromScore(score: number): DeployerRiskLevel {
  if (score >= 80) return "safe";
  if (score >= 55) return "caution";
  if (score >= 30) return "high_risk";
  return "avoid";
}

const SYNTHESIS_SYSTEM = `You are an on-chain forensics analyst. You receive a structured trace of a contract deployer wallet and return ONLY a JSON object.

Rules:
- Base every statement on the provided FACTS. Do not invent transactions, dates, or addresses.
- If FACTS are thin, say so. Do not speculate beyond them.
- Be concrete: cite specific flags, addresses, or dates from FACTS.
- Return ONLY valid JSON matching this schema:

{
  "summary": "<one paragraph, 2-3 sentences>",
  "reasoning": ["<fact-grounded bullet>", "..."],
  "recommendations": ["<actionable step>", "..."]
}`;

function buildSynthesisPrompt(trace: DeployerTrace): string {
  return `${SYNTHESIS_SYSTEM}

FACTS:
${JSON.stringify(
  {
    contract: trace.contractAddress,
    chain: trace.chainName,
    creator: trace.creatorAddress,
    creationTx: trace.creationTxHash,
    creatorAgeDays: trace.creatorAgeDays,
    creatorTxCount: trace.creatorTxCount,
    fundingSources: trace.fundingSources.map((f) => ({
      from: f.address,
      label: f.label,
      category: f.riskCategory,
      eth: f.firstFundingValueEth,
      date: new Date(f.firstFundingTimestamp * 1000).toISOString().slice(0, 10),
    })),
    siblingDeployments: trace.otherDeployments.length,
    flags: trace.flags,
  },
  null,
  2
)}

Return ONLY the JSON object.`;
}

export async function analyzeDeployer(
  chainId: number,
  contractAddress: string
): Promise<DeployerForensicsReport> {
  const key = cacheKey(chainId, contractAddress);
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.report;

  const creation = await getContractCreation(chainId, contractAddress);
  if (!creation) {
    throw new Error(
      `Contract creation record not found for ${contractAddress} on chain ${chainId}. Contract may be too new, not deployed, or Etherscan has no record.`
    );
  }

  const creator = creation.contractCreator.toLowerCase();

  const [traceData, creationTxs] = await Promise.all([
    traceCreator(chainId, creator),
    getNormalTxs(chainId, contractAddress, { offset: 1, sort: "asc" }),
  ]);

  const creationBlockTimestamp = creationTxs[0]?.timeStamp
    ? parseInt(creationTxs[0].timeStamp, 10)
    : null;

  const now = Math.floor(Date.now() / 1000);
  const creatorAgeDays =
    traceData.firstSeen !== null
      ? Math.floor((now - traceData.firstSeen) / 86400)
      : null;

  const preTrace: Omit<DeployerTrace, "flags"> = {
    contractAddress: contractAddress.toLowerCase(),
    chainId,
    chainName: CHAIN_ID_TO_NAME[chainId] ?? `chain-${chainId}`,
    creatorAddress: creator,
    creationTxHash: creation.txHash,
    creationBlockTimestamp,
    creatorFirstSeen: traceData.firstSeen,
    creatorAgeDays,
    creatorTxCount: traceData.txCount,
    fundingSources: traceData.fundingSources,
    otherDeployments: traceData.otherDeployments,
    priorExploits: [],
  };

  const flags = deriveFlags(preTrace);
  const trace: DeployerTrace = { ...preTrace, flags };

  const score = scoreFromFlags(flags);
  const riskLevel = levelFromScore(score);

  let summary = "";
  let reasoning: string[] = [];
  let recommendations: string[] = [];

  try {
    const prompt = buildSynthesisPrompt(trace);
    const output = await invokeClaude(prompt, { effort: "max", timeoutMs: 120_000 });
    const parsed = extractJson<{
      summary: string;
      reasoning: string[];
      recommendations: string[];
    }>(output);
    summary = String(parsed.summary || "").trim();
    reasoning = Array.isArray(parsed.reasoning)
      ? parsed.reasoning.map(String).filter(Boolean).slice(0, 8)
      : [];
    recommendations = Array.isArray(parsed.recommendations)
      ? parsed.recommendations.map(String).filter(Boolean).slice(0, 6)
      : [];
  } catch (err) {
    summary = `Automatic synthesis unavailable (${
      err instanceof Error ? err.message : "unknown error"
    }). Review raw flags below.`;
    reasoning = flags.map((f) => `${f.severity.toUpperCase()}: ${f.message}`);
    recommendations = flags.length > 0
      ? ["Review each flagged signal manually before depositing capital."]
      : ["No automated concerns — still cross-check audits and TVL independently."];
  }

  const report: DeployerForensicsReport = {
    trace,
    riskLevel,
    score,
    summary,
    reasoning,
    recommendations,
    analyzedAt: new Date().toISOString(),
  };

  cache.set(key, { report, expiresAt: Date.now() + CACHE_TTL });
  return report;
}

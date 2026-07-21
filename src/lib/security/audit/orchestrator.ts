import { randomUUID } from "crypto";
import type {
  AuditJobEvent,
  AuditReport,
  ConsensusFinding,
  OnChainInterrogation,
  ScsvsReport,
  ToolFinding,
  ToolName,
  ToolRunResult,
} from "@/types/audit";
import { getContractSource, CHAIN_ID_TO_NAME } from "../etherscan";
import { materializeSource } from "../tools/runtime";
import { runSlither } from "../tools/slither";
import { runAderyn } from "../tools/aderyn";
import { runMythril } from "../tools/mythril";
import { interrogateContract } from "../onchain/interrogator";
import { buildConsensus, aggregateRisk } from "./consensus";
import { buildScsvsReport } from "./scsvs";
import { explainFindings } from "./explainer";
import { log } from "@/lib/log";

function displayFilePath(input: string | undefined): string | undefined {
  if (!input) return undefined;
  const normalized = input.replace(/\\/g, "/").replace(/\0/g, "");
  const workspaceRelative = normalized.replace(/^.*\/sov-audit-[^/]+\//, "");
  if (workspaceRelative !== normalized) return workspaceRelative.slice(0, 300);
  const contractsIndex = normalized.lastIndexOf("/contracts/");
  if (contractsIndex >= 0) return normalized.slice(contractsIndex + 1, contractsIndex + 301);
  if (normalized.startsWith("/")) return normalized.split("/").pop()?.slice(0, 300);
  return normalized.replace(/^\.\//, "").slice(0, 300);
}

function sanitizeFinding(finding: ToolFinding): ToolFinding {
  return {
    ...finding,
    filePath: displayFilePath(finding.filePath),
    raw: undefined,
  };
}

function sanitizeToolResult(result: ToolRunResult): ToolRunResult {
  const executionFailed = Boolean(result.rawError);
  if (executionFailed) {
    log.warn("contract-review", "analysis tool execution failed", {
      tool: result.tool,
      scope: result.scope?.kind,
      error: result.rawError,
    });
  }
  return {
    ...result,
    available: result.available && !executionFailed,
    unavailableReason: executionFailed
      ? "Execution failed for this run; its coverage is unavailable."
      : result.unavailableReason,
    findings: result.findings.map(sanitizeFinding),
    rawError: executionFailed ? "Execution failed; see server logs." : undefined,
    rawStdout: undefined,
  };
}

/**
 * Multi-engine audit orchestrator.
 *
 * Stage order:
 *   1. fetching_source     — pull verified source from Etherscan
 *   2. fetching_onchain    — read live state with viem (proxy slots, owner, multisig, timelock)
 *   3. running_tools       — Slither + Aderyn + Mythril + on-chain in parallel
 *   4. consensus           — group + dedupe findings, escalate confidence on agreement
 *   5. ai_explanation      — the ensemble explains each top-25 finding (cannot invent new findings)
 *   6. scsvs_mapping       — map findings to OWASP SCSVS v12 categories
 *   7. assembling_report   — final structured AuditReport
 *
 * Designed for `Promise.allSettled` semantics: any tool can fail (binary not
 * installed, source not verified) and the rest of the pipeline still ships a
 * report — we just mark the affected SCSVS checks as `indeterminate`.
 */

export interface OrchestratorOptions {
  onProgress?: (event: Omit<AuditJobEvent, "ts">) => void;
  /** Skip AI explanation phase (useful for fast preview/CI). */
  skipAiExplanation?: boolean;
  /** Skip Mythril (it's the slowest; sometimes you want a fast first pass). */
  skipMythril?: boolean;
}

export async function runMultiEngineAudit(
  address: string,
  chainId: number,
  opts: OrchestratorOptions = {}
): Promise<AuditReport> {
  const startedAt = new Date();
  const startMs = startedAt.getTime();
  const warnings: string[] = [];
  const emit = (e: Omit<AuditJobEvent, "ts">) => opts.onProgress?.(e);
  const workspacesToClean: Array<Awaited<ReturnType<typeof materializeSource>>> = [];

  try {

  // -------- stage 1: source --------
  emit({ stage: "fetching_source", message: "Fetching verified contract source…" });
  const source = await getContractSource(chainId, address).catch((err) => {
    log.warn("contract-review", "verified source fetch failed", { error: err });
    warnings.push("Verified source could not be fetched; static coverage is unavailable.");
    return null;
  });

  let workspace: Awaited<ReturnType<typeof materializeSource>> | null = null;
  if (source) {
    try {
      workspace = await materializeSource(source);
      workspacesToClean.push(workspace);
    } catch (err) {
      log.warn("contract-review", "workspace materialization failed", { error: err });
      warnings.push("Source workspace could not be prepared; static coverage is unavailable.");
    }
  } else {
    warnings.push("Source code is not verified — static analyzers will be skipped.");
  }

  // -------- stage 2: on-chain --------
  emit({ stage: "fetching_onchain", message: "Probing live contract state via RPC…" });
  let onchain: OnChainInterrogation | null = null;
  try {
    onchain = await interrogateContract(address, chainId, {
      contractName: source?.ContractName,
      compilerVersion: source?.CompilerVersion,
      isVerified: !!source,
    });
  } catch (err) {
    log.warn("contract-review", "on-chain interrogation failed", { error: err });
    warnings.push("On-chain interrogation failed; live-state coverage is unavailable.");
  }

  // A proxy shell is not the application logic. Fetch and analyze the active
  // implementation as a separate scope; otherwise a verified 20-line proxy
  // could incorrectly produce a clean report while its implementation was
  // never inspected.
  let implementationWorkspace: Awaited<ReturnType<typeof materializeSource>> | null = null;
  const implementationAddress = onchain?.proxy.isProxy
    ? onchain.proxy.implementationAddress
    : undefined;
  if (
    implementationAddress &&
    implementationAddress.toLowerCase() !== address.toLowerCase()
  ) {
    emit({ stage: "fetching_source", message: "Fetching active implementation source…" });
    try {
      const implementationSource = await getContractSource(chainId, implementationAddress);
      if (implementationSource) {
        implementationWorkspace = await materializeSource(implementationSource);
        workspacesToClean.push(implementationWorkspace);
      } else {
        warnings.push("Active proxy implementation source is not verified.");
      }
    } catch (err) {
      log.warn("contract-review", "implementation source preparation failed", { error: err });
      warnings.push("Active implementation source could not be prepared for analysis.");
    }
  } else if (onchain?.proxy.isProxy) {
    warnings.push("Proxy implementation address could not be resolved; implementation analysis is unavailable.");
  }

  // -------- stage 3: tools --------
  emit({ stage: "running_tools", message: "Running static & symbolic analyzers in parallel…" });
  const scopes: Array<{
    address: string;
    kind: "target" | "implementation";
    workspace: Awaited<ReturnType<typeof materializeSource>>;
  }> = [];
  if (workspace) scopes.push({ address, kind: "target", workspace });
  if (implementationWorkspace && implementationAddress) {
    scopes.push({
      address: implementationAddress,
      kind: "implementation",
      workspace: implementationWorkspace,
    });
  }
  const toolTasks: Array<{
    tool: "slither" | "aderyn" | "mythril";
    scope: { address: string; kind: "target" | "implementation" };
    promise: Promise<ToolRunResult>;
  }> = [];
  for (const scope of scopes) {
    const scopeMeta = { address: scope.address, kind: scope.kind };
    toolTasks.push({ tool: "slither", scope: scopeMeta, promise: runSlither(scope.workspace) });
    toolTasks.push({ tool: "aderyn", scope: scopeMeta, promise: runAderyn(scope.workspace) });
    if (!opts.skipMythril) {
      toolTasks.push({ tool: "mythril", scope: scopeMeta, promise: runMythril(scope.workspace) });
    }
  }
  const settled = await Promise.allSettled(toolTasks.map((task) => task.promise));
  let toolResults: ToolRunResult[] = settled.map((r, i): ToolRunResult => {
    const task = toolTasks[i];
    if (r.status === "fulfilled") return { ...r.value, scope: task.scope };
    return {
      tool: task.tool,
      scope: task.scope,
      available: false,
      durationMs: 0,
      findings: [],
      rawError: r.reason instanceof Error ? r.reason.message : String(r.reason),
    };
  });

  // Add on-chain interrogator as a synthetic tool result so SCSVS sees it.
  if (onchain) {
    toolResults.push({
      tool: "onchain_interrogator",
      available: true,
      durationMs: 0,
      findings: onchain.findings,
      scope: { address, kind: "target" },
    });
  }

  toolResults = toolResults.map(sanitizeToolResult);

  for (const t of toolResults) {
    if (!t.available) {
      warnings.push(`${t.tool}: ${t.unavailableReason ?? "unavailable"}`);
    }
  }

  // -------- stage 4: consensus --------
  emit({ stage: "consensus", message: "Reconciling findings across engines…" });
  const allFindings: ToolFinding[] = toolResults.flatMap((t) => t.findings);
  let consensus: ConsensusFinding[] = buildConsensus(allFindings);

  // -------- stage 5: AI explanation --------
  if (!opts.skipAiExplanation && consensus.length > 0) {
    emit({
      stage: "ai_explanation",
      message: `Ensemble explainer drafting writeups for ${Math.min(25, consensus.length)} findings…`,
    });
    consensus = await explainFindings(consensus, (done, total) => {
      emit({
        stage: "ai_explanation",
        message: `AI explainer ${done}/${total}…`,
        sub: { done, total },
      });
    });
  }

  // -------- stage 6: SCSVS --------
  emit({ stage: "scsvs_mapping", message: "Mapping findings to OWASP SCSVS v12…" });
  const scsvs: ScsvsReport = buildScsvsReport({
    findings: consensus,
    rawFindings: allFindings,
    toolResults,
    onchain: onchain ?? undefined,
  });

  // -------- stage 7: assemble --------
  emit({ stage: "assembling_report", message: "Composing final audit report…" });

  const implementationRequired = Boolean(onchain?.proxy.isProxy);
  const successfulStaticFor = (kind: "target" | "implementation") =>
    new Set(
      toolResults
        .filter(
          (result) =>
            result.scope?.kind === kind &&
            result.available &&
            !result.rawError &&
            (result.tool === "slither" || result.tool === "aderyn" || result.tool === "mythril"),
        )
        .map((result) => result.tool),
    );
  const targetStatic = successfulStaticFor("target");
  const implementationStatic = successfulStaticFor("implementation");
  const staticAnalyzersAvailable = Array.from(
    new Set(
      toolResults
        .filter(
          (result) =>
            result.available &&
            !result.rawError &&
            (result.tool === "slither" || result.tool === "aderyn" || result.tool === "mythril"),
        )
        .map((result) => result.tool),
    ),
  ) as ToolName[];
  const onchainAvailable = Boolean(
    onchain?.meta.hasCode && onchain.errors.length === 0,
  );
  const coverage: AuditReport["coverage"] = {
    targetSourceAvailable: Boolean(workspace),
    implementationRequired,
    implementationSourceAvailable: Boolean(implementationWorkspace),
    staticAnalyzersAvailable,
    onchainAvailable,
    sufficientForCleanVerdict:
      Boolean(workspace) &&
      targetStatic.size >= 2 &&
      onchainAvailable &&
      (!implementationRequired ||
        (Boolean(implementationWorkspace) && implementationStatic.size >= 2)),
  };
  if (!coverage.sufficientForCleanVerdict) {
    warnings.push(
      "Coverage is insufficient for a clean verdict; treat absent findings as unknown, not safe.",
    );
  }

  const aggregate = aggregateRisk(consensus, {
    allowClean: coverage.sufficientForCleanVerdict,
  });
  const finishedAt = new Date();

  const report: AuditReport = {
    version: 1,
    contractAddress: onchain?.meta.address ?? address,
    chainId,
    chainName: CHAIN_ID_TO_NAME[chainId] ?? `chain-${chainId}`,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startMs,
    meta:
      onchain?.meta ?? {
        address,
        chainId,
        chainName: CHAIN_ID_TO_NAME[chainId] ?? `chain-${chainId}`,
        bytecodeSize: 0,
        hasCode: false,
        isVerified: !!source,
        contractName: source?.ContractName,
        compilerVersion: source?.CompilerVersion,
      },
    proxy: onchain?.proxy ?? { isProxy: false, pattern: "none", detected: false },
    admin: onchain?.admin ?? {},
    toolResults,
    coverage,
    scsvs,
    findings: consensus,
    riskScore: aggregate.riskScore,
    verdict: aggregate.verdict,
    executiveSummary: writeExecutiveSummary(aggregate, consensus, onchain, scsvs, coverage),
    recommendations: writeRecommendations(consensus, onchain, scsvs),
    warnings,
  };

  return report;
  } finally {
    await Promise.allSettled(workspacesToClean.map((workspace) => workspace.cleanup()));
  }
}

/* ==================== EXEC SUMMARY + RECOMMENDATIONS ==================== */

function writeExecutiveSummary(
  aggregate: ReturnType<typeof aggregateRisk>,
  findings: ConsensusFinding[],
  onchain: OnChainInterrogation | null,
  scsvs: ScsvsReport,
  coverage: AuditReport["coverage"],
): string {
  const parts: string[] = [];

  // Verdict + score in plain language
  const verdictWord = {
    clean: "Low risk",
    review: "Review recommended",
    dangerous: "Dangerous",
    critical: "Critical risk",
  }[aggregate.verdict];
  parts.push(`${verdictWord} (risk score ${aggregate.riskScore}/100).`);
  if (!coverage.sufficientForCleanVerdict) {
    parts.push("Automated coverage was incomplete, so this report cannot establish that the contract is safe.");
  }

  // Headline counts
  const sevSummary: string[] = [];
  if (aggregate.counts.critical) sevSummary.push(`${aggregate.counts.critical} critical`);
  if (aggregate.counts.high) sevSummary.push(`${aggregate.counts.high} high`);
  if (aggregate.counts.medium) sevSummary.push(`${aggregate.counts.medium} medium`);
  if (aggregate.counts.low) sevSummary.push(`${aggregate.counts.low} low`);
  if (sevSummary.length === 0) {
    parts.push("No issues were surfaced by the analyzers that ran.");
  } else {
    parts.push(`Surfaced findings: ${sevSummary.join(", ")}.`);
  }

  // On-chain control narrative
  if (onchain) {
    if (!onchain.meta.isVerified) {
      parts.push("Source code is NOT verified — static analysis was not possible; assessment is based on on-chain state alone.");
    }
    if (onchain.proxy.isProxy) {
      parts.push(`Contract is a ${onchain.proxy.pattern} proxy — implementation is upgradeable.`);
    }
    if (onchain.admin.renounced) {
      parts.push("Ownership is renounced (admin = 0x0).");
    } else if (onchain.admin.ownerAddress) {
      const isMultisig = (onchain.admin.multisigOwners ?? 0) > 1;
      const hasTimelock = (onchain.admin.timelockDelaySeconds ?? 0) >= 3600;
      if (isMultisig && hasTimelock) {
        parts.push(`Admin keys: ${onchain.admin.multisigThreshold}/${onchain.admin.multisigOwners} multisig + ${Math.floor((onchain.admin.timelockDelaySeconds ?? 0) / 3600)}h timelock — strong governance.`);
      } else if (onchain.admin.ownerIsContract === false) {
        parts.push("Owner is an EOA — single-key compromise gives full control.");
      } else {
        parts.push("Owner is a contract but neither multisig threshold nor timelock delay was detected.");
      }
    }
  }

  // SCSVS coverage
  parts.push(`SCSVS coverage: ${scsvs.summary.passed}/${scsvs.summary.total} checks pass, ${scsvs.summary.failed} fail, ${scsvs.summary.indeterminate} indeterminate.`);

  // AI consensus highlight
  const aiBackedCriticals = findings.filter(
    (f) => f.aiExplanation && f.aiExplanation.aiConsensus === "all" && (f.aiExplanation.finalSeverity === "critical" || f.aiExplanation.finalSeverity === "high")
  );
  if (aiBackedCriticals.length > 0) {
    parts.push(`${aiBackedCriticals.length} high/critical finding${aiBackedCriticals.length === 1 ? "" : "s"} confirmed by both models.`);
  }

  return parts.join(" ");
}

function writeRecommendations(
  findings: ConsensusFinding[],
  onchain: OnChainInterrogation | null,
  scsvs: ScsvsReport
): string[] {
  const recs: string[] = [];

  // Highest-priority findings → top recs (max 5)
  const top = findings
    .filter((f) => f.severity === "critical" || f.severity === "high")
    .slice(0, 5);
  for (const f of top) {
    if (f.aiExplanation?.recommendedFix) {
      recs.push(`[${f.severity.toUpperCase()}] ${f.title} — ${f.aiExplanation.recommendedFix.slice(0, 240)}`);
    } else {
      recs.push(`[${f.severity.toUpperCase()}] Review and fix: ${f.title}${f.filePath ? ` (${f.filePath}${f.startLine ? `:${f.startLine}` : ""})` : ""}.`);
    }
  }

  // Governance recommendations
  if (onchain && !onchain.admin.renounced && onchain.admin.ownerAddress) {
    const isMultisig = (onchain.admin.multisigOwners ?? 0) > 1 && (onchain.admin.multisigThreshold ?? 0) > 1;
    const hasTimelock = (onchain.admin.timelockDelaySeconds ?? 0) >= 86400;
    if (!isMultisig) {
      recs.push("[GOVERNANCE] Migrate ownership to a Gnosis Safe multisig (recommend ≥3/5 threshold) so no single key can unilaterally execute privileged actions.");
    }
    if (!hasTimelock) {
      recs.push("[GOVERNANCE] Wrap the multisig in a TimelockController with a 24-72h delay so users can exit before any malicious upgrade or parameter change takes effect.");
    }
  }

  // Verification
  if (onchain && !onchain.meta.isVerified) {
    recs.push("[TRANSPARENCY] Verify the contract source on the chain's public block explorer so users and auditors can read the deployed bytecode.");
  }

  // Failed SCSVS checks not already covered
  const failedScsvs = scsvs.checks.filter((c) => c.status === "fail").slice(0, 3);
  for (const c of failedScsvs) {
    recs.push(`[SCSVS-${c.id}] ${c.description}`);
  }

  return dedupe(recs).slice(0, 12);
}

function dedupe(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const key = item.toLowerCase().replace(/\s+/g, " ").slice(0, 80);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

/* Exposed for tests / direct CLI runs. */
export function _internal_id(): string {
  return randomUUID();
}

import type {
  AuditCategory,
  ConsensusFinding,
  OnChainInterrogation,
  ScsvsCategoryId,
  ScsvsCheck,
  ScsvsReport,
  ToolFinding,
  ToolRunResult,
} from "@/types/audit";

/**
 * OWASP Smart Contract Security Verification Standard (SCSVS) checklist
 * mapper. This translates the unstructured "tools found N findings" output
 * into a structured pass/fail matrix against the 12 SCSVS categories.
 *
 * For each check we decide:
 *   - "fail"            — at least one finding directly violates this check
 *   - "pass"            — relevant tools ran without flagging this category
 *   - "manual_review"   — tools cannot fully verify (e.g. business logic, gas DoS edge cases)
 *   - "indeterminate"   — relevant tools didn't run / unavailable
 *   - "n/a"             — check is irrelevant to this contract type
 */

interface ScsvsRule {
  id: string;
  category: ScsvsCategoryId;
  description: string;
  /** Categories of findings that trigger a fail. */
  failOnCategories?: AuditCategory[];
  /** Tools that must have run to credit a "pass"; otherwise indeterminate. */
  requiredTools?: ("slither" | "aderyn" | "mythril" | "onchain_interrogator")[];
  /** If true, default verdict is manual_review (auto-tools cannot decide). */
  manualOnly?: boolean;
  /** Custom evaluator for cases the rule-driven path can't handle. */
  evaluate?: (
    ctx: ScsvsContext
  ) => Pick<ScsvsCheck, "status" | "evidence" | "linkedFindingIds">;
}

interface ScsvsContext {
  findings: ConsensusFinding[];
  rawFindings: ToolFinding[];
  toolResults: ToolRunResult[];
  onchain?: OnChainInterrogation;
}

const RULES: ScsvsRule[] = [
  // V1 Architecture, design, threat modeling
  {
    id: "V1.1",
    category: "V1_architecture",
    description: "Contract uses an explicit upgrade pattern (proxy + admin) only when justified.",
    evaluate: ({ onchain }) => {
      if (!onchain) return { status: "indeterminate" };
      if (!onchain.proxy.isProxy) return { status: "pass", evidence: ["Not a proxy — upgradeability surface absent."] };
      if (onchain.proxy.pattern === "minimal") {
        return { status: "pass", evidence: ["EIP-1167 minimal proxy — implementation is immutable."] };
      }
      const hasGoodAdmin =
        (onchain.admin.multisigThreshold ?? 0) > 1 &&
        (onchain.admin.timelockDelaySeconds ?? 0) >= 86400;
      return hasGoodAdmin
        ? { status: "pass", evidence: [`Upgrade controls: multisig ${onchain.admin.multisigThreshold}/${onchain.admin.multisigOwners} + timelock ${Math.floor((onchain.admin.timelockDelaySeconds ?? 0) / 3600)}h.`] }
        : { status: "fail", evidence: ["Upgradeable proxy without multisig + timelock combination."] };
    },
  },
  {
    id: "V1.2",
    category: "V1_architecture",
    description: "Contract source code is verified and matches deployed bytecode.",
    evaluate: ({ onchain }) => {
      if (!onchain) return { status: "indeterminate" };
      return onchain.meta.isVerified
        ? { status: "pass", evidence: ["Source code published & verified on a public block explorer."] }
        : { status: "fail", evidence: ["Source code is NOT verified — bytecode is opaque."] };
    },
  },

  // V2 Access control
  {
    id: "V2.1",
    category: "V2_access_control",
    description: "Privileged functions use access control modifiers (Ownable / Roles).",
    failOnCategories: ["access_control"],
    requiredTools: ["slither", "aderyn"],
  },
  {
    id: "V2.2",
    category: "V2_access_control",
    description: "Admin keys are protected by multisig + timelock (no single-key control).",
    evaluate: ({ onchain }) => {
      if (!onchain) return { status: "indeterminate" };
      if (onchain.admin.renounced) return { status: "pass", evidence: ["Ownership renounced (owner == 0x0)."] };
      if (!onchain.admin.ownerAddress) return { status: "n/a", evidence: ["No `owner()` exposed on this contract."] };
      const isMultisig = (onchain.admin.multisigOwners ?? 0) > 1 && (onchain.admin.multisigThreshold ?? 0) > 1;
      const hasTimelock = (onchain.admin.timelockDelaySeconds ?? 0) >= 3600;
      if (isMultisig && hasTimelock) {
        return {
          status: "pass",
          evidence: [`Owner is ${onchain.admin.multisigThreshold}/${onchain.admin.multisigOwners} multisig with ${Math.floor((onchain.admin.timelockDelaySeconds ?? 0) / 3600)}h timelock.`],
        };
      }
      return {
        status: "fail",
        evidence: [
          `Owner: ${onchain.admin.ownerAddress}`,
          onchain.admin.ownerIsContract === false
            ? "Owner is an EOA — single-key compromise = total compromise."
            : "Owner is a contract but not a recognizable multisig + timelock combination.",
        ],
      };
    },
  },
  {
    id: "V2.3",
    category: "V2_access_control",
    description: "tx.origin is not used for authorization.",
    failOnCategories: ["tx_origin"],
    requiredTools: ["slither"],
  },

  // V3 Blockchain data
  {
    id: "V3.1",
    category: "V3_blockchain_data",
    description: "block.timestamp / blockhash are not used as a strong source of randomness or critical deadlines.",
    failOnCategories: ["timestamp_dependence", "weak_prng"],
    requiredTools: ["slither", "aderyn"],
  },
  {
    id: "V3.2",
    category: "V3_blockchain_data",
    description: "On-chain randomness is not used; if needed, a verifiable randomness function (VRF) is used instead.",
    failOnCategories: ["weak_prng"],
    requiredTools: ["slither"],
  },

  // V4 Communications
  {
    id: "V4.1",
    category: "V4_communications",
    description: "External call return values are checked; low-level calls have explicit success handling.",
    failOnCategories: ["unchecked_call", "low_level_call"],
    requiredTools: ["slither"],
  },
  {
    id: "V4.2",
    category: "V4_communications",
    description: "delegatecall is used safely (target is trusted, no controlled input).",
    failOnCategories: ["delegatecall_risk"],
    requiredTools: ["slither", "aderyn"],
  },

  // V5 Arithmetic
  {
    id: "V5.1",
    category: "V5_arithmetic",
    description: "Arithmetic does not over/underflow (Solidity ≥0.8 or SafeMath).",
    failOnCategories: ["arithmetic"],
    requiredTools: ["slither", "mythril"],
  },
  {
    id: "V5.2",
    category: "V5_arithmetic",
    description: "Division-before-multiplication and rounding errors are absent.",
    failOnCategories: ["arithmetic"],
    requiredTools: ["slither"],
  },

  // V6 Malicious input handling
  {
    id: "V6.1",
    category: "V6_malicious_input",
    description: "Reentrancy is prevented (CEI pattern or ReentrancyGuard).",
    failOnCategories: ["reentrancy"],
    requiredTools: ["slither", "aderyn", "mythril"],
  },
  {
    id: "V6.2",
    category: "V6_malicious_input",
    description: "Input validation: zero-address checks where required.",
    failOnCategories: ["uninitialized_state"],
    requiredTools: ["slither", "aderyn"],
  },

  // V7 Gas usage and DoS
  {
    id: "V7.1",
    category: "V7_gas_dos",
    description: "Loops are bounded; no unbounded iteration over user-controlled arrays.",
    failOnCategories: ["denial_of_service", "unbounded_loop"],
    requiredTools: ["slither", "aderyn"],
  },
  {
    id: "V7.2",
    category: "V7_gas_dos",
    description: "External calls inside loops are avoided or strictly bounded.",
    failOnCategories: ["denial_of_service"],
    requiredTools: ["slither"],
  },

  // V8 Business logic
  {
    id: "V8.1",
    category: "V8_business_logic",
    description: "State invariants hold under all callable code paths (requires fuzzing or formal verification).",
    manualOnly: true,
  },
  {
    id: "V8.2",
    category: "V8_business_logic",
    description: "Front-running is not exploitable; commit-reveal or private mempool used where required.",
    failOnCategories: ["front_running"],
    manualOnly: true,
  },

  // V9 DoS
  {
    id: "V9.1",
    category: "V9_denial_of_service",
    description: "Contract cannot be locked by a malicious actor (no `selfdestruct`, no force-fail).",
    failOnCategories: ["selfdestruct_risk"],
    requiredTools: ["slither", "aderyn"],
  },
  {
    id: "V9.2",
    category: "V9_denial_of_service",
    description: "Push-payment patterns are avoided; pull-payments preferred for distributions.",
    failOnCategories: ["denial_of_service"],
    manualOnly: true,
  },

  // V10 Token standards
  {
    id: "V10.1",
    category: "V10_token",
    description: "ERC-20/721 implementations follow the spec (decimals, return values, events).",
    failOnCategories: ["missing_events", "code_quality"],
    requiredTools: ["slither", "aderyn"],
  },
  {
    id: "V10.2",
    category: "V10_token",
    description: "Approval pattern is safe (no front-runnable allowance; use of `increase/decrease`).",
    failOnCategories: ["unlimited_approval"],
    manualOnly: true,
  },

  // V11 Code quality
  {
    id: "V11.1",
    category: "V11_code_quality",
    description: "No shadowed variables; no use of deprecated constructs.",
    failOnCategories: ["shadowing", "code_quality"],
    requiredTools: ["slither", "aderyn"],
  },
  {
    id: "V11.2",
    category: "V11_code_quality",
    description: "State-changing functions emit events (auditability).",
    failOnCategories: ["missing_events"],
    requiredTools: ["slither", "aderyn"],
  },

  // V12 Test coverage
  {
    id: "V12.1",
    category: "V12_test_coverage",
    description: "Project includes a test suite with adequate coverage (manual review).",
    manualOnly: true,
  },
  {
    id: "V12.2",
    category: "V12_test_coverage",
    description: "Property-based fuzzing is part of the test pipeline (Foundry / Echidna).",
    manualOnly: true,
  },
];

/* ==================== EVALUATOR ==================== */

export function buildScsvsReport(ctx: ScsvsContext): ScsvsReport {
  const checks: ScsvsCheck[] = RULES.map((rule) => evaluateRule(rule, ctx));
  return summarize(checks);
}

function evaluateRule(rule: ScsvsRule, ctx: ScsvsContext): ScsvsCheck {
  if (rule.evaluate) {
    const out = rule.evaluate(ctx);
    return {
      id: rule.id,
      category: rule.category,
      description: rule.description,
      ...out,
    };
  }

  if (rule.manualOnly) {
    return {
      id: rule.id,
      category: rule.category,
      description: rule.description,
      status: "manual_review",
      evidence: ["Automatic verification is not possible — requires human review or fuzzing/formal verification."],
    };
  }

  // Rule-driven path: did any finding match `failOnCategories`?
  const matchedFindings = (rule.failOnCategories ?? []).length
    ? ctx.findings.filter((f) => rule.failOnCategories!.includes(f.category))
    : [];

  if (matchedFindings.length > 0) {
    return {
      id: rule.id,
      category: rule.category,
      description: rule.description,
      status: "fail",
      evidence: matchedFindings.slice(0, 3).map(
        (f) =>
          `[${f.severity}] ${f.title}${
            f.filePath ? ` (${f.filePath}${f.startLine ? `:${f.startLine}` : ""})` : ""
          }`
      ),
      linkedFindingIds: matchedFindings.map((f) => f.id),
    };
  }

  // No matching finding — pass only if the required tools actually ran.
  if (rule.requiredTools && rule.requiredTools.length) {
    const ranTools = ctx.toolResults
      .filter((t) => t.available && !t.rawError)
      .map((t) => t.tool);
    const missing = rule.requiredTools.filter((t) => !ranTools.includes(t));
    if (missing.length === rule.requiredTools.length) {
      return {
        id: rule.id,
        category: rule.category,
        description: rule.description,
        status: "indeterminate",
        evidence: [`No relevant tool ran: ${rule.requiredTools.join(", ")} unavailable.`],
      };
    }
    if (missing.length > 0) {
      return {
        id: rule.id,
        category: rule.category,
        description: rule.description,
        status: "pass",
        evidence: [`Partial coverage: ${missing.join(", ")} did not run, but ${rule.requiredTools.filter((t) => !missing.includes(t)).join(", ")} found nothing.`],
      };
    }
  }

  return {
    id: rule.id,
    category: rule.category,
    description: rule.description,
    status: "pass",
    evidence: ["No findings in this category from the tools that ran."],
  };
}

function summarize(checks: ScsvsCheck[]): ScsvsReport {
  const counts = {
    total: checks.length,
    passed: checks.filter((c) => c.status === "pass").length,
    failed: checks.filter((c) => c.status === "fail").length,
    manualReview: checks.filter((c) => c.status === "manual_review").length,
    notApplicable: checks.filter((c) => c.status === "n/a").length,
    indeterminate: checks.filter((c) => c.status === "indeterminate").length,
  };
  const decided = counts.passed + counts.failed;
  const coveragePercent = decided > 0 ? Math.round((counts.passed / decided) * 100) : 0;

  const byCategoryMap = new Map<ScsvsCategoryId, { passed: number; failed: number; total: number }>();
  for (const c of checks) {
    const entry = byCategoryMap.get(c.category) ?? { passed: 0, failed: 0, total: 0 };
    entry.total++;
    if (c.status === "pass") entry.passed++;
    if (c.status === "fail") entry.failed++;
    byCategoryMap.set(c.category, entry);
  }
  const byCategory = Array.from(byCategoryMap.entries()).map(([category, stats]) => ({
    category,
    ...stats,
  }));

  return {
    checks,
    summary: { ...counts, coveragePercent },
    byCategory,
  };
}

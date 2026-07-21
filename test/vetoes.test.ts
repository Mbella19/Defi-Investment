import { describe, expect, it } from "vitest";
import { applyHeuristicVetoes } from "@/lib/anthropic";
import type { GroundTruthChecks } from "@/types/analysis";

function baseGroundTruth(overrides: Partial<GroundTruthChecks> = {}): GroundTruthChecks {
  return {
    auditLinks: { claimed: 0, checked: 0, unchecked: 0, verified: 0, broken: 0, details: [] },
    recentExploitAlerts: { count: 0, lookbackDays: 30, alerts: [] },
    tvlCrash: { change1d: -2, change7d: 1, crashed: false },
    onChain: { contractAuditAvailable: false },
    ...overrides,
  };
}

describe("applyHeuristicVetoes", () => {
  it("passes a clean protocol through unchanged", () => {
    const out = applyHeuristicVetoes(
      { legitimacyScore: 88, overallVerdict: "high_confidence" },
      baseGroundTruth(),
    );
    expect(out.legitimacyScore).toBe(88);
    expect(out.overallVerdict).toBe("high_confidence");
    expect(out.vetoes).toHaveLength(0);
  });

  it("caps score at 35 and forces caution on a recent exploit", () => {
    const out = applyHeuristicVetoes(
      { legitimacyScore: 90, overallVerdict: "high_confidence" },
      baseGroundTruth({
        recentExploitAlerts: {
          count: 1,
          lookbackDays: 30,
          alerts: [{ name: "Critical net drain detected", severity: "critical", detectedAt: 0 }],
        },
      }),
    );
    expect(out.legitimacyScore).toBe(35);
    expect(out.overallVerdict).toBe("caution");
    expect(out.vetoes.map((v) => v.rule)).toContain("RECENT_EXPLOIT_ALERT");
  });

  it("caps score at 55 on a TVL crash", () => {
    const out = applyHeuristicVetoes(
      { legitimacyScore: 80, overallVerdict: "moderate_confidence" },
      baseGroundTruth({ tvlCrash: { change1d: -45, change7d: -10, crashed: true } }),
    );
    expect(out.legitimacyScore).toBe(55);
    expect(out.overallVerdict).toBe("low_confidence");
  });

  it("caps score at 30 for a dangerous recent contract audit", () => {
    const out = applyHeuristicVetoes(
      { legitimacyScore: 75, overallVerdict: "moderate_confidence" },
      baseGroundTruth({
        onChain: {
          contractAuditAvailable: true,
          contractAuditVerdict: "dangerous",
          contractAuditRiskScore: 72,
        },
      }),
    );
    expect(out.legitimacyScore).toBe(30);
    expect(out.overallVerdict).toBe("caution");
    expect(out.vetoes.map((v) => v.rule)).toContain("CONTRACT_AUDIT_DANGEROUS");
  });

  it("caps score at 20 for a critical recent contract audit", () => {
    const out = applyHeuristicVetoes(
      { legitimacyScore: 75, overallVerdict: "moderate_confidence" },
      baseGroundTruth({
        onChain: {
          contractAuditAvailable: true,
          contractAuditVerdict: "critical",
          contractAuditRiskScore: 95,
        },
      }),
    );
    expect(out.legitimacyScore).toBe(20);
    expect(out.overallVerdict).toBe("caution");
    expect(out.vetoes.map((v) => v.rule)).toContain("CONTRACT_AUDIT_CRITICAL");
  });

  it("forces low_confidence when every claimed audit link is broken", () => {
    const out = applyHeuristicVetoes(
      { legitimacyScore: 70, overallVerdict: "high_confidence" },
      baseGroundTruth({
        auditLinks: {
          claimed: 3,
          checked: 3,
          unchecked: 0,
          verified: 0,
          broken: 3,
          details: [
            { url: "https://a", ok: false },
            { url: "https://b", ok: false },
            { url: "https://c", ok: false },
          ],
        },
      }),
    );
    expect(out.overallVerdict).toBe("low_confidence");
    // No score ceiling for this rule — score untouched.
    expect(out.legitimacyScore).toBe(70);
  });

  it("does not fire the broken-links veto when only one link is claimed", () => {
    const out = applyHeuristicVetoes(
      { legitimacyScore: 70, overallVerdict: "high_confidence" },
      baseGroundTruth({
        auditLinks: { claimed: 1, checked: 1, unchecked: 0, verified: 0, broken: 1, details: [{ url: "https://a", ok: false }] },
      }),
    );
    expect(out.vetoes).toHaveLength(0);
  });

  it("stacks vetoes — the lowest ceiling wins and no-op vetoes are not recorded", () => {
    const out = applyHeuristicVetoes(
      { legitimacyScore: 90, overallVerdict: "high_confidence" },
      baseGroundTruth({
        tvlCrash: { change1d: -50, change7d: -60, crashed: true },
        recentExploitAlerts: {
          count: 2,
          lookbackDays: 30,
          alerts: [{ name: "Drain", severity: "critical", detectedAt: 0 }],
        },
      }),
    );
    // Exploit veto (ceiling 35, caution) applies first; the TVL veto's
    // ceiling of 55 then changes nothing, so by design it isn't recorded.
    expect(out.legitimacyScore).toBe(35);
    expect(out.overallVerdict).toBe("caution");
    expect(out.vetoes.map((v) => v.rule)).toEqual(["RECENT_EXPLOIT_ALERT"]);
  });
});

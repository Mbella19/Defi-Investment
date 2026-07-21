import { describe, expect, it } from "vitest";
import { safetyFingerprint } from "@/lib/anthropic";
import type { GroundTruthChecks } from "@/types/analysis";

function groundTruth(): GroundTruthChecks {
  return {
    auditLinks: {
      claimed: 1,
      checked: 1,
      unchecked: 0,
      verified: 1,
      broken: 0,
      details: [{ url: "https://audit.example/report", ok: true, status: 200 }],
    },
    recentExploitAlerts: { count: 0, lookbackDays: 30, alerts: [] },
    tvlCrash: { change1d: -2, change7d: -4, crashed: false },
    onChain: { contractAuditAvailable: false },
  };
}

describe("protocol-analysis cache safety fingerprint", () => {
  it("does not invalidate for ordinary non-crash TVL drift", () => {
    const before = groundTruth();
    const after = groundTruth();
    after.tvlCrash.change1d = -3;
    after.tvlCrash.change7d = -5;
    expect(safetyFingerprint(after)).toBe(safetyFingerprint(before));
  });

  it("invalidates when a new exploit or crash signal appears", () => {
    const before = groundTruth();
    const exploited = groundTruth();
    exploited.recentExploitAlerts = {
      count: 1,
      lookbackDays: 30,
      alerts: [{ name: "Drain detected", severity: "critical", detectedAt: 1_700_000_000 }],
    };
    const crashed = groundTruth();
    crashed.tvlCrash = { change1d: -45, change7d: -50, crashed: true };
    expect(safetyFingerprint(exploited)).not.toBe(safetyFingerprint(before));
    expect(safetyFingerprint(crashed)).not.toBe(safetyFingerprint(before));
  });

  it("invalidates when verified audit evidence changes", () => {
    const before = groundTruth();
    const broken = groundTruth();
    broken.auditLinks = {
      claimed: 1,
      checked: 1,
      unchecked: 0,
      verified: 0,
      broken: 1,
      details: [{ url: "https://audit.example/report", ok: false, status: 404 }],
    };
    expect(safetyFingerprint(broken)).not.toBe(safetyFingerprint(before));
    expect(safetyFingerprint({})).toBeNull();
  });
});

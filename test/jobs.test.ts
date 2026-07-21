import { randomUUID } from "crypto";
import { describe, expect, it } from "vitest";
import { getDb } from "@/lib/db";
import {
  claimNextStrategyJob,
  createJob,
  getJob,
} from "@/lib/strategy-jobs";
import {
  claimNextAuditJob,
  createAuditJob,
  getAuditJob,
} from "@/lib/security/audit/jobs";

const criteria = {
  budget: 10_000,
  riskAppetite: "medium" as const,
  targetApyMin: 6,
  targetApyMax: 18,
  assetType: "all" as const,
};

describe("durable job integrity", () => {
  it("returns the winning strategy job when an idempotent insert races", () => {
    const wallet = "0x3000000000000000000000000000000000000001";
    const key = `strategy-${randomUUID()}`;
    const first = createJob(wallet, { criteria, mode: "dual" }, key, randomUUID());
    const second = createJob(wallet, { criteria, mode: "dual" }, key, randomUUID());

    expect(second.id).toBe(first.id);
    const row = getDb()
      .prepare(
        "SELECT COUNT(*) AS count FROM strategy_jobs WHERE wallet_address = ? AND idempotency_key = ?",
      )
      .get(wallet, key) as { count: number };
    expect(row.count).toBe(1);
  });

  it("fails an exhausted strategy lease instead of leaving it running forever", () => {
    const wallet = "0x3000000000000000000000000000000000000002";
    const job = createJob(
      wallet,
      { criteria, mode: "solo" },
      `strategy-${randomUUID()}`,
      randomUUID(),
    );
    getDb()
      .prepare(
        "UPDATE strategy_jobs SET attempts = max_attempts, lease_expires_at = ? WHERE id = ?",
      )
      .run(Date.now() - 1, job.id);

    claimNextStrategyJob("test-worker");
    expect(getJob(job.id)?.status).toBe("error");
  });

  it("returns the winning audit job when an idempotent insert races", () => {
    const wallet = "0x3000000000000000000000000000000000000003";
    const key = `audit-${randomUUID()}`;
    const address = "0x4000000000000000000000000000000000000003";
    const first = createAuditJob(wallet, address, 1, key, randomUUID());
    const second = createAuditJob(wallet, address, 1, key, randomUUID());

    expect(second.id).toBe(first.id);
    const row = getDb()
      .prepare(
        "SELECT COUNT(*) AS count FROM audit_jobs WHERE wallet_address = ? AND idempotency_key = ?",
      )
      .get(wallet, key) as { count: number };
    expect(row.count).toBe(1);
  });

  it("fails an exhausted audit lease instead of leaving it running forever", () => {
    const wallet = "0x3000000000000000000000000000000000000004";
    const job = createAuditJob(
      wallet,
      "0x4000000000000000000000000000000000000004",
      1,
      `audit-${randomUUID()}`,
      randomUUID(),
    );
    getDb()
      .prepare(
        "UPDATE audit_jobs SET attempts = max_attempts, lease_expires_at = ? WHERE id = ?",
      )
      .run(Date.now() - 1, job.id);

    claimNextAuditJob("test-worker");
    expect(getAuditJob(job.id)?.status).toBe("error");
  });
});

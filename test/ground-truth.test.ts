import { randomUUID } from "crypto";
import { describe, expect, it } from "vitest";
import { getDb } from "@/lib/db";
import { readCompletedContractAudit } from "@/lib/security/ground-truth";
import type { DefiLlamaProtocol } from "@/types/pool";

function protocol(address: string): DefiLlamaProtocol {
  return {
    id: randomUUID(),
    name: "Test Protocol",
    address,
    symbol: "TEST",
    url: "https://example.com",
    description: "",
    chain: "Ethereum",
    logo: "",
    audits: "0",
    category: "Test",
    chains: ["Ethereum"],
    twitter: "",
    tvl: 1,
    change_1h: null,
    change_1d: null,
    change_7d: null,
    listedAt: 0,
    slug: randomUUID(),
    mcap: null,
    gecko_id: null,
  };
}

describe("durable contract-audit ground truth", () => {
  it("reuses a recent validated completed audit without exposing its owner", () => {
    const db = getDb();
    const id = randomUUID();
    const address = "0x5000000000000000000000000000000000000001";
    const now = Date.now();
    const report = {
      version: 1,
      contractAddress: address,
      chainId: 1,
      verdict: "dangerous",
      riskScore: 71,
      coverage: { sufficientForCleanVerdict: true },
    };

    db.prepare(
      `INSERT INTO audit_jobs
       (id, wallet_address, contract_address, chain_id, status, events_json,
        result_json, started_at, finished_at)
       VALUES (?, ?, ?, ?, 'done', '[]', ?, ?, ?)`,
    ).run(
      id,
      "0x6000000000000000000000000000000000000001",
      address,
      1,
      JSON.stringify(report),
      now - 1_000,
      now,
    );

    const result = readCompletedContractAudit(protocol(address));
    expect(result).toMatchObject({
      contractAuditAvailable: true,
      contractAuditVerdict: "dangerous",
      contractAuditRiskScore: 71,
      contractAuditCoverageSufficient: true,
    });
    expect(result.contractAuditCompletedAt).toBe(new Date(now).toISOString());
    expect(result).not.toHaveProperty("walletAddress");
  });

  it("fails closed when a stored report does not match the requested contract", () => {
    const db = getDb();
    const address = "0x5000000000000000000000000000000000000002";
    const now = Date.now();
    db.prepare(
      `INSERT INTO audit_jobs
       (id, wallet_address, contract_address, chain_id, status, events_json,
        result_json, started_at, finished_at)
       VALUES (?, ?, ?, ?, 'done', '[]', ?, ?, ?)`,
    ).run(
      randomUUID(),
      "0x6000000000000000000000000000000000000002",
      address,
      1,
      JSON.stringify({
        version: 1,
        contractAddress: "0x5000000000000000000000000000000000000099",
        chainId: 1,
        verdict: "critical",
        riskScore: 100,
      }),
      now - 1_000,
      now,
    );

    expect(readCompletedContractAudit(protocol(address))).toEqual({
      contractAuditAvailable: false,
    });
  });
});

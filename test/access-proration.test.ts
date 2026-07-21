import { describe, expect, it } from "vitest";
import { activateSubscription, resolveTier, TIER_PRICE_USD } from "@/lib/plans/access";

const DAY_MS = 86_400_000;

function expiryMs(wallet: string, tier: "pro" | "ultra"): number {
  const { expiresAt } = activateSubscription({
    wallet,
    tier,
    chain: "ethereum",
    token: "USDC",
    amount: "1",
    txHash: `0x${Math.random().toString(16).slice(2).padEnd(64, "0")}`,
  });
  return new Date(expiresAt).getTime();
}

function daysFromNow(ms: number): number {
  return (ms - Date.now()) / DAY_MS;
}

describe("activateSubscription proration", () => {
  it("fresh activation gives 30 days", () => {
    const exp = expiryMs("0x1000000000000000000000000000000000000001", "pro");
    expect(daysFromNow(exp)).toBeGreaterThan(29.9);
    expect(daysFromNow(exp)).toBeLessThan(30.1);
    expect(resolveTier("0x1000000000000000000000000000000000000001")).toBe("pro");
  });

  it("same-tier renewal extends from the current expiry (~60 days)", () => {
    const w = "0x1000000000000000000000000000000000000002";
    expiryMs(w, "pro");
    const exp = expiryMs(w, "pro");
    expect(daysFromNow(exp)).toBeGreaterThan(59.8);
    expect(daysFromNow(exp)).toBeLessThan(60.2);
  });

  it("upgrade converts remaining time by price ratio", () => {
    const w = "0x1000000000000000000000000000000000000003";
    expiryMs(w, "pro"); // 30 days of Pro remaining
    const exp = expiryMs(w, "ultra");
    const expected = 30 + 30 * (TIER_PRICE_USD.pro / TIER_PRICE_USD.ultra); // ≈ 39.9d
    expect(daysFromNow(exp)).toBeGreaterThan(expected - 0.5);
    expect(daysFromNow(exp)).toBeLessThan(expected + 0.5);
    expect(resolveTier(w)).toBe("ultra");
  });

  it("a lower-tier payment never downgrades an active Ultra subscription", () => {
    const w = "0x1000000000000000000000000000000000000004";
    expiryMs(w, "ultra"); // 30 days of Ultra remaining
    const exp = expiryMs(w, "pro");
    const expected = 30 + 30 * (TIER_PRICE_USD.pro / TIER_PRICE_USD.ultra); // ≈ 39.9d Ultra
    expect(daysFromNow(exp)).toBeGreaterThan(expected - 0.5);
    expect(daysFromNow(exp)).toBeLessThan(expected + 0.5);
    expect(resolveTier(w)).toBe("ultra");
  });
});

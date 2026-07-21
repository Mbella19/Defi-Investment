import { describe, expect, it } from "vitest";
import { compareAmount, toRawUnits } from "@/lib/payments/pricing";

describe("toRawUnits", () => {
  it("converts 18-decimal amounts without float drift", () => {
    expect(toRawUnits(1, 18)).toBe("1000000000000000000");
    expect(toRawUnits(149, 18)).toBe("149000000000000000000");
    // The old float path (149 * 1e18) landed on 149000000000000010240.
    expect(toRawUnits(0.1, 18)).toBe("100000000000000000");
  });

  it("handles 6/8/9-decimal tokens", () => {
    expect(toRawUnits(49, 6)).toBe("49000000");
    expect(toRawUnits(0.00042, 8)).toBe("42000");
    expect(toRawUnits(1.5, 9)).toBe("1500000000");
  });

  it("never emits exponential notation for large values", () => {
    // 5000 tokens * 1e18 = 5e21 — Number.toString() would go exponential.
    expect(toRawUnits(5000, 18)).toBe("5000000000000000000000");
  });

  it("preserves representable precision and rounds fractional raw units up", () => {
    expect(toRawUnits(0.1234567890123456, 18)).toBe("123456789012345600");
    expect(toRawUnits(1.0000004, 6)).toBe("1000001");
    expect(toRawUnits(0.0000001, 6)).toBe("1");
  });

  it("rejects non-finite amounts", () => {
    expect(() => toRawUnits(Number.NaN, 18)).toThrow();
    expect(() => toRawUnits(Infinity, 6)).toThrow();
    expect(() => toRawUnits(1, -1)).toThrow();
    expect(() => toRawUnits(1, 1.5)).toThrow();
  });
});

describe("compareAmount", () => {
  it("accepts exact matches", () => {
    expect(compareAmount("1000000", "1000000")).toBe(true);
  });

  it("accepts overpayment but never underpayment", () => {
    expect(compareAmount("1004000", "1000000")).toBe(true);
    expect(compareAmount("996000", "1000000")).toBe(false);
  });

  it("rejects any amount below the locked quote", () => {
    expect(compareAmount("1006000", "1000000")).toBe(true);
    expect(compareAmount("990000", "1000000")).toBe(false);
  });

  it("rejects malformed inputs", () => {
    expect(compareAmount("abc", "1000000")).toBe(false);
    expect(compareAmount("1.5", "1000000")).toBe(false);
    expect(compareAmount("0", "0")).toBe(false);
  });
});

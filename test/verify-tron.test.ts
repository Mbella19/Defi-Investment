import { describe, expect, it } from "vitest";
import { normalizeTronAddress } from "@/lib/payments/verify-tron";

// Canonical well-known pair: USDT (TRC20) contract.
const USDT_BASE58 = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
const USDT_HEX = "41a614f803b6fd780986a42c78ec9c7f77e6ded13c";

describe("normalizeTronAddress", () => {
  it("decodes base58check to canonical 41-prefixed hex", () => {
    expect(normalizeTronAddress(USDT_BASE58)).toBe(USDT_HEX);
  });

  it("accepts 41-prefixed hex directly (case-insensitive)", () => {
    expect(normalizeTronAddress(USDT_HEX)).toBe(USDT_HEX);
    expect(normalizeTronAddress(USDT_HEX.toUpperCase())).toBe(USDT_HEX);
    expect(normalizeTronAddress(`0x${USDT_HEX}`)).toBe(USDT_HEX);
  });

  it("accepts bare 20-byte hex (event payloads without the network prefix)", () => {
    const bare = USDT_HEX.slice(2);
    expect(normalizeTronAddress(bare)).toBe(USDT_HEX);
    expect(normalizeTronAddress(`0x${bare}`)).toBe(USDT_HEX);
  });

  it("rejects a base58 address with a corrupted checksum", () => {
    const corrupted = USDT_BASE58.slice(0, -1) + (USDT_BASE58.endsWith("t") ? "u" : "t");
    expect(normalizeTronAddress(corrupted)).toBeNull();
  });

  it("rejects junk", () => {
    expect(normalizeTronAddress("")).toBeNull();
    expect(normalizeTronAddress(null)).toBeNull();
    expect(normalizeTronAddress("not-an-address")).toBeNull();
    expect(normalizeTronAddress("0x1234")).toBeNull();
  });

  it("equates the two representations after normalization", () => {
    expect(normalizeTronAddress(USDT_BASE58)).toBe(normalizeTronAddress(`0x${USDT_HEX}`));
  });
});

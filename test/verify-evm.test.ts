import { describe, expect, it } from "vitest";
import type { Hex } from "viem";
import { matchErc20Transfer, type Erc20LogLike } from "@/lib/payments/verify-evm";

const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const TOKEN = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
const RECIPIENT = "0x35de0b4157ecb2037ab1041d2333981e81baef24";
const SENDER = "0x1111111111111111111111111111111111111111";
const OTHER = "0x2222222222222222222222222222222222222222";

function pad32(addr: string): Hex {
  return `0x${addr.slice(2).padStart(64, "0")}` as Hex;
}

function valueData(raw: bigint): Hex {
  return `0x${raw.toString(16).padStart(64, "0")}` as Hex;
}

function transferLog(params: {
  token?: string;
  from: string;
  to: string;
  value: bigint;
}): Erc20LogLike {
  return {
    address: params.token ?? TOKEN,
    topics: [TRANSFER_TOPIC as Hex, pad32(params.from), pad32(params.to)],
    data: valueData(params.value),
  };
}

describe("matchErc20Transfer", () => {
  it("matches a simple transfer to the recipient", () => {
    const logs = [transferLog({ from: SENDER, to: RECIPIENT, value: BigInt(49_000_000) })];
    const out = matchErc20Transfer(logs, TOKEN, RECIPIENT, "49000000");
    expect(out).not.toBeNull();
    expect(out!.amountMatches).toBe(true);
    expect(out!.transfer.from.toLowerCase()).toBe(SENDER);
  });

  it("finds the correct transfer among several on the same token (router tx)", () => {
    // The old .find() grabbed the FIRST transfer and rejected the payment.
    const logs = [
      transferLog({ from: SENDER, to: OTHER, value: BigInt(10) }),
      transferLog({ from: OTHER, to: SENDER, value: BigInt(5) }),
      transferLog({ from: SENDER, to: RECIPIENT, value: BigInt(49_000_000) }),
    ];
    const out = matchErc20Transfer(logs, TOKEN, RECIPIENT, "49000000");
    expect(out).not.toBeNull();
    expect(out!.amountMatches).toBe(true);
  });

  it("reports amount mismatch when the recipient got the wrong amount", () => {
    const logs = [transferLog({ from: SENDER, to: RECIPIENT, value: BigInt(10_000) })];
    const out = matchErc20Transfer(logs, TOKEN, RECIPIENT, "49000000");
    expect(out).not.toBeNull();
    expect(out!.amountMatches).toBe(false);
  });

  it("returns null when no transfer reaches the recipient", () => {
    const logs = [transferLog({ from: SENDER, to: OTHER, value: BigInt(49_000_000) })];
    expect(matchErc20Transfer(logs, TOKEN, RECIPIENT, "49000000")).toBeNull();
  });

  it("ignores transfers on other token contracts", () => {
    const logs = [
      transferLog({ token: "0x3333333333333333333333333333333333333333", from: SENDER, to: RECIPIENT, value: BigInt(49_000_000) }),
    ];
    expect(matchErc20Transfer(logs, TOKEN, RECIPIENT, "49000000")).toBeNull();
  });

  it("tolerates the ±0.5% band on the matched transfer", () => {
    const logs = [transferLog({ from: SENDER, to: RECIPIENT, value: BigInt(49_100_000) })];
    const out = matchErc20Transfer(logs, TOKEN, RECIPIENT, "49000000");
    expect(out!.amountMatches).toBe(true);
  });
});

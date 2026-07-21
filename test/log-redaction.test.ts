import { afterEach, describe, expect, it, vi } from "vitest";
import { log } from "@/lib/log";

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.TEST_API_KEY;
});

describe("runtime log redaction", () => {
  it("removes configured secrets, credentials, and wallet identifiers", () => {
    const secret = "super-secret-provider-value";
    const wallet = "0x7000000000000000000000000000000000000007";
    process.env.TEST_API_KEY = secret;
    const sink = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    log.warn("security-test", `request failed with Bearer ${secret}`, {
      authorization: `Bearer ${secret}`,
      wallet,
      endpoint: `https://example.test/path?api_key=${secret}`,
      tokenSymbol: "USDC",
      error: new Error(`provider URL contained ${secret}`),
    });

    const rendered = String(sink.mock.calls[0]?.[0] ?? "");
    expect(rendered).not.toContain(secret);
    expect(rendered).not.toContain(wallet);
    expect(rendered).toContain("[redacted]");
    expect(rendered).toContain("USDC");
  });
});

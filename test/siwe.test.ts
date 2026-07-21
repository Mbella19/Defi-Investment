import { describe, expect, it } from "vitest";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { verifySiweMessage } from "@/lib/auth/siwe";
import { rememberNonce } from "@/lib/auth/nonce-store";

const DOMAIN = "app.test";

function buildMessage(params: {
  address: string;
  nonce: string;
  domain?: string;
  uri?: string;
  chainId?: number;
  issuedAt?: string;
}): string {
  return [
    `${params.domain ?? DOMAIN} wants you to sign in with your Ethereum account:`,
    params.address,
    "",
    "Sign in to Sovereign Investment Group. This signature does not authorize any transactions.",
    "",
    `URI: ${params.uri ?? `https://${DOMAIN}`}`,
    `Version: 1`,
    `Chain ID: ${params.chainId ?? 1}`,
    `Nonce: ${params.nonce}`,
    `Issued At: ${params.issuedAt ?? new Date().toISOString()}`,
  ].join("\n");
}

describe("verifySiweMessage", () => {
  it("accepts a correctly signed message with a live nonce", async () => {
    const pk = generatePrivateKey();
    const account = privateKeyToAccount(pk);
    const nonce = "test-nonce-happy";
    rememberNonce(nonce);
    const message = buildMessage({ address: account.address, nonce });
    const signature = await account.signMessage({ message });
    const out = await verifySiweMessage({ message, signature, expectedOrigin: DOMAIN });
    expect(out.ok).toBe(true);
    expect(out.address).toBe(account.address.toLowerCase());
  });

  it("burns the nonce — a second verification of the same message fails", async () => {
    const pk = generatePrivateKey();
    const account = privateKeyToAccount(pk);
    const nonce = "test-nonce-replay";
    rememberNonce(nonce);
    const message = buildMessage({ address: account.address, nonce });
    const signature = await account.signMessage({ message });
    const first = await verifySiweMessage({ message, signature, expectedOrigin: DOMAIN });
    expect(first.ok).toBe(true);
    const replay = await verifySiweMessage({ message, signature, expectedOrigin: DOMAIN });
    expect(replay.ok).toBe(false);
    expect(replay.error).toMatch(/nonce/i);
  });

  it("rejects a signature from a different key", async () => {
    const signer = privateKeyToAccount(generatePrivateKey());
    const claimed = privateKeyToAccount(generatePrivateKey());
    const nonce = "test-nonce-forged";
    rememberNonce(nonce);
    const message = buildMessage({ address: claimed.address, nonce });
    const signature = await signer.signMessage({ message });
    const out = await verifySiweMessage({ message, signature, expectedOrigin: DOMAIN });
    expect(out.ok).toBe(false);
  });

  it("does not consume a nonce when cryptographic verification fails", async () => {
    const account = privateKeyToAccount(generatePrivateKey());
    const wrongSigner = privateKeyToAccount(generatePrivateKey());
    const nonce = "test-nonce-not-burned";
    rememberNonce(nonce);
    const message = buildMessage({ address: account.address, nonce });
    const wrongSignature = await wrongSigner.signMessage({ message });
    expect((await verifySiweMessage({ message, signature: wrongSignature, expectedOrigin: DOMAIN })).ok)
      .toBe(false);

    const correctSignature = await account.signMessage({ message });
    expect((await verifySiweMessage({ message, signature: correctSignature, expectedOrigin: DOMAIN })).ok)
      .toBe(true);
  });

  it("rejects a domain that doesn't match the expected origin", async () => {
    const account = privateKeyToAccount(generatePrivateKey());
    const nonce = "test-nonce-domain";
    rememberNonce(nonce);
    const message = buildMessage({ address: account.address, nonce, domain: "evil.test", uri: "https://evil.test" });
    const signature = await account.signMessage({ message });
    const out = await verifySiweMessage({ message, signature, expectedOrigin: DOMAIN });
    expect(out.ok).toBe(false);
    expect(out.error).toMatch(/domain/i);
  });

  it("binds the URI scheme as well as the host", async () => {
    const account = privateKeyToAccount(generatePrivateKey());
    const nonce = "test-nonce-scheme";
    rememberNonce(nonce);
    const message = buildMessage({ address: account.address, nonce, uri: `http://${DOMAIN}` });
    const signature = await account.signMessage({ message });
    const out = await verifySiweMessage({
      message,
      signature,
      expectedOrigin: `https://${DOMAIN}`,
    });
    expect(out.ok).toBe(false);
    expect(out.error).toMatch(/URI origin/i);
  });

  it("rejects credentials embedded in the SIWE URI", async () => {
    const account = privateKeyToAccount(generatePrivateKey());
    const nonce = "test-nonce-uri-credentials";
    rememberNonce(nonce);
    const message = buildMessage({
      address: account.address,
      nonce,
      uri: `https://user:password@${DOMAIN}`,
    });
    const signature = await account.signMessage({ message });
    const out = await verifySiweMessage({ message, signature, expectedOrigin: DOMAIN });
    expect(out.ok).toBe(false);
    expect(out.error).toMatch(/credentials/i);
  });

  it("rejects when Domain and URI disagree even without an expectedOrigin", async () => {
    const account = privateKeyToAccount(generatePrivateKey());
    const nonce = "test-nonce-mismatch";
    rememberNonce(nonce);
    const message = buildMessage({ address: account.address, nonce, uri: "https://elsewhere.test" });
    const signature = await account.signMessage({ message });
    const out = await verifySiweMessage({ message, signature });
    expect(out.ok).toBe(false);
  });

  it("rejects stale Issued At timestamps (10-min tolerance)", async () => {
    const account = privateKeyToAccount(generatePrivateKey());
    const nonce = "test-nonce-stale";
    rememberNonce(nonce);
    const issuedAt = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const message = buildMessage({ address: account.address, nonce, issuedAt });
    const signature = await account.signMessage({ message });
    const out = await verifySiweMessage({ message, signature, expectedOrigin: DOMAIN });
    expect(out.ok).toBe(false);
    expect(out.error).toMatch(/too old|future/i);
  });

  it("rejects messages missing required fields", async () => {
    const out = await verifySiweMessage({ message: "garbage", signature: "0x00" });
    expect(out.ok).toBe(false);
  });
});

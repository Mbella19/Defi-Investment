import { describe, expect, it } from "vitest";
import { getDb } from "@/lib/db";
import {
  consumeVerification,
  findVerificationByCode,
  listDeliverableChannels,
  startVerification,
  upsertChannel,
} from "@/lib/notifications/channels";

const WALLET = "0x2000000000000000000000000000000000000001";

describe("notification channel secret storage", () => {
  it("encrypts channel endpoints at rest and decrypts only for delivery", () => {
    const endpoint = "https://hooks.slack.com/services/T000/B000/SECRET";
    upsertChannel({ wallet: WALLET, channel: "slack", endpoint, verified: true });

    const stored = getDb()
      .prepare(
        `SELECT endpoint, endpoint_ciphertext, endpoint_iv, endpoint_tag
         FROM user_channels WHERE wallet_address = ? AND channel = 'slack'`,
      )
      .get(WALLET) as {
      endpoint: string;
      endpoint_ciphertext: string | null;
      endpoint_iv: string | null;
      endpoint_tag: string | null;
    };
    expect(stored.endpoint).toBe("encrypted:v1");
    expect(stored.endpoint_ciphertext).not.toContain("SECRET");
    expect(stored.endpoint_iv).toBeTruthy();
    expect(stored.endpoint_tag).toBeTruthy();
    expect(listDeliverableChannels(WALLET)[0].endpoint).toBe(endpoint);
  });

  it("stores verification codes as keyed hashes and consumes them", () => {
    const code = "739201";
    const endpoint = "owner@example.com";
    startVerification({ wallet: WALLET, channel: "email", endpoint, code });
    const stored = getDb()
      .prepare(
        `SELECT endpoint, code, code_hash FROM channel_verifications
         WHERE wallet_address = ? AND channel = 'email'`,
      )
      .get(WALLET) as { endpoint: string; code: string; code_hash: string | null };
    expect(stored.endpoint).toBe("encrypted:v1");
    expect(stored.code).toBe("encrypted:v1");
    expect(stored.code_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(consumeVerification(WALLET, "email", "000000").ok).toBe(false);
    expect(consumeVerification(WALLET, "email", code)).toEqual({ ok: true, endpoint });
  });

  it("finds Telegram setup by a hashed token", () => {
    const token = "telegram-token-123";
    startVerification({
      wallet: WALLET,
      channel: "telegram",
      endpoint: "pending",
      code: token,
    });
    expect(findVerificationByCode("telegram", token)?.walletAddress).toBe(WALLET);
    expect(findVerificationByCode("telegram", "wrong-token")).toBeNull();
  });

  it("rejects and removes expired Telegram setup tokens", () => {
    const token = "expired-telegram-token";
    startVerification({
      wallet: WALLET,
      channel: "telegram",
      endpoint: "pending",
      code: token,
    });
    getDb()
      .prepare(
        "UPDATE channel_verifications SET expires_at = ? WHERE wallet_address = ? AND channel = 'telegram'",
      )
      .run(new Date(Date.now() - 1_000).toISOString(), WALLET);

    expect(findVerificationByCode("telegram", token)).toBeNull();
    const row = getDb()
      .prepare(
        "SELECT 1 FROM channel_verifications WHERE wallet_address = ? AND channel = 'telegram'",
      )
      .get(WALLET);
    expect(row).toBeUndefined();
  });
});

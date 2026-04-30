import "server-only";
import { getDb } from "@/lib/db";

export type Tier = "free" | "pro" | "ultra";
export type StrategistMode = "solo" | "dual" | "council";
export type AlertChannel = "discord" | "email" | "slack" | "telegram" | "sms";

export interface Capabilities {
  monthlyStrategies: number;
  strategistMode: StrategistMode;
  riskBandSelection: boolean;
  stablecoinToggle: boolean;
  realtimeAlerts: boolean;
  customApyMode: boolean;
  toolSimulator: boolean;
  toolCorrelation: boolean;
  toolPortfolioLens: boolean;
  toolAudit: boolean;
  alertChannels: AlertChannel[];
  prioritySupport: boolean;
}

export const TIER_CAPS: Record<Tier, Capabilities> = {
  free: {
    monthlyStrategies: 2,
    strategistMode: "solo",
    riskBandSelection: false,
    stablecoinToggle: false,
    realtimeAlerts: false,
    customApyMode: false,
    toolSimulator: false,
    toolCorrelation: false,
    toolPortfolioLens: false,
    toolAudit: true,
    alertChannels: [],
    prioritySupport: false,
  },
  pro: {
    monthlyStrategies: 20,
    strategistMode: "dual",
    riskBandSelection: true,
    stablecoinToggle: true,
    realtimeAlerts: true,
    customApyMode: false,
    toolSimulator: true,
    toolCorrelation: true,
    toolPortfolioLens: true,
    toolAudit: true,
    alertChannels: ["discord"],
    prioritySupport: false,
  },
  ultra: {
    monthlyStrategies: 60,
    strategistMode: "council",
    riskBandSelection: true,
    stablecoinToggle: true,
    realtimeAlerts: true,
    customApyMode: true,
    toolSimulator: true,
    toolCorrelation: true,
    toolPortfolioLens: true,
    toolAudit: true,
    alertChannels: ["discord", "email", "slack", "telegram", "sms"],
    prioritySupport: true,
  },
};

export const TIER_PRICE_USD: Record<Tier, number> = {
  free: 0,
  pro: 100,
  ultra: 200,
};

/**
 * Owner-wallet bypass list. Set OWNER_WALLETS in .env.local to a
 * comma-separated list of lowercase 0x addresses; those wallets always
 * resolve to the Ultra tier regardless of subscription state.
 */
function ownerWallets(): string[] {
  const raw = process.env.OWNER_WALLETS ?? "";
  return raw
    .split(",")
    .map((w) => w.trim().toLowerCase())
    .filter((w) => /^0x[0-9a-f]{40}$/.test(w));
}

export function isOwnerWallet(wallet: string | null | undefined): boolean {
  if (!wallet) return false;
  return ownerWallets().includes(wallet.toLowerCase());
}

interface SubscriptionRow {
  tier: string;
  expires_at: string;
}

/**
 * Resolve the active tier for a wallet — owner bypass first, then look up
 * the subscriptions table and reject expired rows. Defaults to "free".
 */
export function resolveTier(wallet: string | null | undefined): Tier {
  if (!wallet) return "free";
  if (isOwnerWallet(wallet)) return "ultra";
  try {
    const db = getDb();
    const row = db
      .prepare(
        "SELECT tier, expires_at FROM subscriptions WHERE wallet_address = ?",
      )
      .get(wallet.toLowerCase()) as SubscriptionRow | undefined;
    if (!row) return "free";
    if (new Date(row.expires_at).getTime() <= Date.now()) return "free";
    if (row.tier === "pro" || row.tier === "ultra") return row.tier;
    return "free";
  } catch (err) {
    console.warn("[plans] resolveTier db read failed:", err);
    return "free";
  }
}

export interface PlanSnapshot {
  tier: Tier;
  capabilities: Capabilities;
  isOwner: boolean;
  expiresAt: string | null;
}

export function getPlan(wallet: string | null | undefined): PlanSnapshot {
  const tier = resolveTier(wallet);
  let expiresAt: string | null = null;
  if (wallet && !isOwnerWallet(wallet) && tier !== "free") {
    try {
      const db = getDb();
      const row = db
        .prepare("SELECT expires_at FROM subscriptions WHERE wallet_address = ?")
        .get(wallet.toLowerCase()) as { expires_at: string } | undefined;
      expiresAt = row?.expires_at ?? null;
    } catch {
      /* ignore */
    }
  }
  return {
    tier,
    capabilities: TIER_CAPS[tier],
    isOwner: isOwnerWallet(wallet),
    expiresAt,
  };
}

/**
 * Activate or extend a paid subscription. Pro/Ultra rows are upserted with
 * a 30-day expiry (or extended from the existing expiry if it's still in the
 * future). Caller is responsible for validating the on-chain payment first.
 */
export function activateSubscription(params: {
  wallet: string;
  tier: "pro" | "ultra";
  chain: string;
  token: string;
  amount: string;
  txHash: string;
  durationDays?: number;
}): { expiresAt: string } {
  const days = params.durationDays ?? 30;
  const db = getDb();
  const wallet = params.wallet.toLowerCase();
  const existing = db
    .prepare("SELECT expires_at FROM subscriptions WHERE wallet_address = ?")
    .get(wallet) as { expires_at: string } | undefined;
  const baseTime =
    existing && new Date(existing.expires_at).getTime() > Date.now()
      ? new Date(existing.expires_at).getTime()
      : Date.now();
  const expiresAt = new Date(baseTime + days * 24 * 60 * 60 * 1000).toISOString();
  db.prepare(
    `INSERT INTO subscriptions (wallet_address, tier, activated_at, expires_at, payment_chain, payment_token, payment_amount, payment_tx_hash)
     VALUES (?, ?, datetime('now'), ?, ?, ?, ?, ?)
     ON CONFLICT(wallet_address) DO UPDATE SET
       tier=excluded.tier,
       activated_at=datetime('now'),
       expires_at=excluded.expires_at,
       payment_chain=excluded.payment_chain,
       payment_token=excluded.payment_token,
       payment_amount=excluded.payment_amount,
       payment_tx_hash=excluded.payment_tx_hash`,
  ).run(
    wallet,
    params.tier,
    expiresAt,
    params.chain,
    params.token,
    params.amount,
    params.txHash,
  );
  return { expiresAt };
}

/**
 * Server guard — reject the request if the wallet's tier doesn't include
 * the named capability. Pass `null` for the wallet to reject anonymous calls.
 */
export function requireCapability(
  wallet: string | null,
  capability: keyof Capabilities,
): { ok: true; plan: PlanSnapshot } | { ok: false; response: Response } {
  const plan = getPlan(wallet);
  const value = plan.capabilities[capability];
  let enabled: boolean;
  if (typeof value === "boolean") enabled = value;
  else if (Array.isArray(value)) enabled = value.length > 0;
  else if (typeof value === "number") enabled = value > 0;
  else enabled = false;
  if (enabled) return { ok: true, plan };
  return {
    ok: false,
    response: Response.json(
      {
        error: "Upgrade required",
        capability,
        currentTier: plan.tier,
        requiredTier: capability === "customApyMode" ? "ultra" : "pro",
      },
      { status: 402 },
    ),
  };
}

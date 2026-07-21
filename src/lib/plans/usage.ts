import "server-only";
import { getDb } from "@/lib/db";

export type UsageKind = "strategy" | "audit";

function startOfMonthIso(): string {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0),
  ).toISOString();
}

export function monthlyUsage(wallet: string, kind: UsageKind): number {
  const row = getDb()
    .prepare(
      `SELECT COUNT(*) AS n
       FROM usage_reservations
       WHERE wallet_address = ? AND kind = ? AND period_start = ?
         AND status IN ('reserved', 'settled')`,
    )
    .get(wallet.toLowerCase(), kind, startOfMonthIso()) as { n: number } | undefined;
  return row?.n ?? 0;
}

export function reserveMonthlyUsage(params: {
  wallet: string;
  kind: UsageKind;
  id: string;
  limit: number;
}): { ok: true; used: number } | { ok: false; used: number } {
  const db = getDb();
  const wallet = params.wallet.toLowerCase();
  const periodStart = startOfMonthIso();
  const now = Date.now();
  return db.transaction(() => {
    const existing = db
      .prepare("SELECT status FROM usage_reservations WHERE id = ?")
      .get(params.id) as { status: string } | undefined;
    const count = db
      .prepare(
        `SELECT COUNT(*) AS n
         FROM usage_reservations
         WHERE wallet_address = ? AND kind = ? AND period_start = ?
           AND status IN ('reserved', 'settled')`,
      )
      .get(wallet, params.kind, periodStart) as { n: number };
    if (existing?.status === "reserved" || existing?.status === "settled") {
      return { ok: true as const, used: count.n };
    }
    if (params.limit !== -1 && count.n >= params.limit) {
      return { ok: false as const, used: count.n };
    }
    db.prepare(
      `INSERT INTO usage_reservations
         (id, wallet_address, kind, period_start, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'settled', ?, ?)`,
    ).run(params.id, wallet, params.kind, periodStart, now, now);
    return { ok: true as const, used: count.n + 1 };
  })();
}

export function releaseUsage(id: string): void {
  getDb()
    .prepare(
      `UPDATE usage_reservations
       SET status = 'released', updated_at = ?
       WHERE id = ? AND status IN ('reserved', 'settled')`,
    )
    .run(Date.now(), id);
}

export function strategyGenerationsThisMonth(wallet: string): number {
  return monthlyUsage(wallet, "strategy");
}

export function auditsThisMonth(wallet: string): number {
  return monthlyUsage(wallet, "audit");
}

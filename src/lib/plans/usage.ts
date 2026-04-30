import "server-only";
import { getDb } from "@/lib/db";

function startOfMonthIso(): string {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0),
  ).toISOString();
}

export function strategyGenerationsThisMonth(wallet: string): number {
  try {
    const db = getDb();
    const since = startOfMonthIso();
    const row = db
      .prepare(
        "SELECT COUNT(*) AS n FROM strategy_generations WHERE LOWER(wallet_address) = ? AND created_at >= ?",
      )
      .get(wallet.toLowerCase(), since) as { n: number } | undefined;
    return row?.n ?? 0;
  } catch (err) {
    console.warn("[plans] generation count read failed:", err);
    return 0;
  }
}

export function recordStrategyGeneration(wallet: string, id: string): void {
  try {
    const db = getDb();
    db.prepare(
      "INSERT INTO strategy_generations (id, wallet_address) VALUES (?, ?)",
    ).run(id, wallet.toLowerCase());
  } catch (err) {
    console.warn("[plans] generation record failed:", err);
  }
}

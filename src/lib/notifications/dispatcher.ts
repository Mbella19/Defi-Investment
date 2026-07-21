import "server-only";
import { randomUUID } from "crypto";
import type { StrategyMonitorAlert } from "@/lib/strategy-monitor";
import { listDeliverableChannels, type ChannelKind } from "@/lib/notifications/channels";
import { getPlan } from "@/lib/plans/access";
import { getDb } from "@/lib/db";
import { log } from "@/lib/log";
import { sendEmailAlert, sendEmailText } from "@/lib/notifications/channels/email";
import { sendTelegramAlert, sendTelegramMessage } from "@/lib/notifications/channels/telegram";
import { sendSlackAlert, sendSlackText } from "@/lib/notifications/channels/slack";
import {
  sendUserDiscordAlert,
  sendUserDiscordText,
} from "@/lib/notifications/channels/discord-user";

export interface DispatchSummary {
  email: number;
  telegram: number;
  slack: number;
  discord: number;
}

const CHANNEL_KINDS: ChannelKind[] = ["email", "telegram", "slack", "discord"];
const OUTBOX_MAX_ATTEMPTS = 5;
const OUTBOX_LEASE_MS = 30_000;

function allowedChannels(wallet: string): Set<ChannelKind> {
  const configured = getPlan(wallet).capabilities.alertChannels;
  return new Set(
    configured.filter((channel): channel is ChannelKind =>
      CHANNEL_KINDS.includes(channel as ChannelKind),
    ),
  );
}

/**
 * Send a plain informational message (billing notices, expiry reminders) to
 * every verified+enabled channel the wallet's tier permits. Returns how many
 * channel deliveries succeeded.
 */
export async function sendPlainMessageToUser(
  wallet: string,
  message: { title: string; body: string },
): Promise<number> {
  const channels = listDeliverableChannels(wallet);
  if (channels.length === 0) return 0;

  const allowed = allowedChannels(wallet);

  let delivered = 0;
  await Promise.allSettled(
    channels.map(async (ch) => {
      if (!allowed.has(ch.channel)) return;
      let ok = false;
      switch (ch.channel) {
        case "email":
          ok = await sendEmailText(ch.endpoint, message.title, message.body);
          break;
        case "telegram":
          ok = await sendTelegramMessage(ch.endpoint, `<b>${message.title}</b>\n\n${message.body}`);
          break;
        case "slack":
          ok = await sendSlackText(ch.endpoint, `*${message.title}*\n${message.body}`);
          break;
        case "discord":
          ok = await sendUserDiscordText(ch.endpoint, message.title, message.body);
          break;
      }
      if (ok) delivered += 1;
    }),
  );
  return delivered;
}

/**
 * Dispatch a batch of alerts spanning multiple wallets. Groups by wallet,
 * dispatches each user's alerts in parallel.
 */
export async function dispatchAlertBatch(
  alerts: Array<StrategyMonitorAlert & { walletAddress?: string }>,
): Promise<void> {
  enqueueAlertBatch(alerts);
  await drainAlertOutbox();
}

function enqueueAlertBatch(
  alerts: Array<StrategyMonitorAlert & { walletAddress?: string }>,
): void {
  if (alerts.length === 0) return;
  const db = getDb();
  const insert = db.prepare(
    `INSERT OR IGNORE INTO alert_outbox
       (id, alert_id, wallet_address, channel, status, attempts, available_at, created_at)
     SELECT ?, alerts.id, lower(strategies.wallet_address), ?, 'pending', 0, ?, ?
     FROM strategy_alerts alerts
     JOIN active_strategies strategies ON strategies.id = alerts.strategy_id
     WHERE alerts.id = ? AND lower(strategies.wallet_address) = ?`,
  );
  const now = Date.now();
  db.transaction(() => {
    for (const alert of alerts) {
      const wallet = alert.walletAddress?.toLowerCase();
      if (!wallet) continue;
      const allowed = allowedChannels(wallet);
      const deliverable = listDeliverableChannels(wallet);
      for (const channel of deliverable) {
        if (!allowed.has(channel.channel)) continue;
        insert.run(randomUUID(), channel.channel, now, now, alert.id, wallet);
      }
    }
  })();
}

interface OutboxRow {
  id: string;
  alert_id: string;
  wallet_address: string;
  channel: ChannelKind;
  attempts: number;
}

interface AlertRow {
  id: string;
  strategy_id: string;
  type: string;
  severity: string;
  pool_id: string | null;
  protocol: string;
  symbol: string;
  chain: string;
  message: string;
  detail: string;
  created_at: string;
  owner_wallet: string;
}

function rowToAlert(row: AlertRow): StrategyMonitorAlert {
  return {
    id: row.id,
    strategyId: row.strategy_id,
    type: row.type,
    severity: row.severity,
    poolId: row.pool_id,
    protocol: row.protocol,
    symbol: row.symbol,
    chain: row.chain,
    message: row.message,
    detail: row.detail,
    createdAt: row.created_at,
    walletAddress: row.owner_wallet,
  };
}

async function deliverOne(
  channel: ChannelKind,
  endpoint: string,
  alert: StrategyMonitorAlert,
): Promise<boolean> {
  switch (channel) {
    case "email":
      return sendEmailAlert(endpoint, alert);
    case "telegram":
      return sendTelegramAlert(endpoint, alert);
    case "slack":
      return sendSlackAlert(endpoint, alert);
    case "discord":
      return sendUserDiscordAlert(endpoint, alert);
  }
}

/**
 * Claim and deliver persisted notifications. Failed deliveries are retried
 * with bounded exponential backoff; stale claims become eligible again after
 * their lease, making process crashes recoverable on the next scheduler run.
 */
export async function drainAlertOutbox(limit = 100): Promise<DispatchSummary> {
  const db = getDb();
  const summary: DispatchSummary = { email: 0, telegram: 0, slack: 0, discord: 0 };
  const now = Date.now();
  db.prepare(
    `DELETE FROM alert_outbox
     WHERE (status = 'delivered' AND delivered_at < ?)
        OR (status = 'dead' AND created_at < ?)`,
  ).run(
    now - 90 * 24 * 60 * 60 * 1000,
    now - 30 * 24 * 60 * 60 * 1000,
  );
  db.prepare(
    `UPDATE alert_outbox SET status = 'pending'
     WHERE status = 'delivering' AND available_at <= ?`,
  ).run(now);

  const candidates = db
    .prepare(
      `SELECT id, alert_id, wallet_address, channel, attempts
       FROM alert_outbox
       WHERE status = 'pending' AND available_at <= ?
       ORDER BY created_at ASC LIMIT ?`,
    )
    .all(now, Math.max(1, Math.min(500, limit))) as OutboxRow[];
  const claim = db.prepare(
    `UPDATE alert_outbox
     SET status = 'delivering', attempts = attempts + 1, available_at = ?
     WHERE id = ? AND status = 'pending' AND available_at <= ?`,
  );
  const readAlert = db.prepare(
    `SELECT alerts.id, alerts.strategy_id, alerts.type, alerts.severity,
            alerts.pool_id, alerts.protocol, alerts.symbol, alerts.chain,
            alerts.message, alerts.detail, alerts.created_at,
            lower(strategies.wallet_address) AS owner_wallet
     FROM strategy_alerts alerts
     JOIN active_strategies strategies ON strategies.id = alerts.strategy_id
     WHERE alerts.id = ?`,
  );
  const delivered = db.prepare(
    `UPDATE alert_outbox
     SET status = 'delivered', delivered_at = ?, available_at = ?, last_error = NULL
     WHERE id = ? AND status = 'delivering'`,
  );
  const failed = db.prepare(
    `UPDATE alert_outbox
     SET status = ?, available_at = ?, last_error = ?
     WHERE id = ? AND status = 'delivering'`,
  );

  for (const row of candidates) {
    const claimed = claim.run(now + OUTBOX_LEASE_MS, row.id, now);
    if (claimed.changes !== 1) continue;
    const attempt = row.attempts + 1;
    try {
      const record = readAlert.get(row.alert_id) as AlertRow | undefined;
      if (!record || record.owner_wallet !== row.wallet_address.toLowerCase()) {
        failed.run("dead", now, "Alert ownership no longer matches", row.id);
        continue;
      }
      if (!allowedChannels(row.wallet_address).has(row.channel)) {
        failed.run("dead", now, "Channel is not permitted by the current plan", row.id);
        continue;
      }
      const channel = listDeliverableChannels(row.wallet_address).find(
        (candidate) => candidate.channel === row.channel,
      );
      if (!channel) {
        failed.run("dead", now, "Channel is unavailable or disabled", row.id);
        continue;
      }
      const ok = await deliverOne(row.channel, channel.endpoint, rowToAlert(record));
      if (ok) {
        delivered.run(Date.now(), Date.now(), row.id);
        summary[row.channel] += 1;
        continue;
      }
      const dead = attempt >= OUTBOX_MAX_ATTEMPTS;
      const backoff = Math.min(60 * 60 * 1000, 30_000 * 2 ** (attempt - 1));
      failed.run(
        dead ? "dead" : "pending",
        dead ? Date.now() : Date.now() + backoff,
        "Delivery provider rejected or failed the request",
        row.id,
      );
    } catch (error) {
      const dead = attempt >= OUTBOX_MAX_ATTEMPTS;
      const message = error instanceof Error ? error.message : "Delivery failed";
      const backoff = Math.min(60 * 60 * 1000, 30_000 * 2 ** (attempt - 1));
      failed.run(
        dead ? "dead" : "pending",
        dead ? Date.now() : Date.now() + backoff,
        message.slice(0, 300),
        row.id,
      );
      log.warn("notification-outbox", "delivery attempt failed", {
        channel: row.channel,
        attempt,
        error: message,
      });
    }
  }
  return summary;
}

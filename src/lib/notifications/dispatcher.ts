import "server-only";
import type { StrategyMonitorAlert } from "@/lib/strategy-monitor";
import { listDeliverableChannels, type ChannelKind } from "@/lib/notifications/channels";
import { getPlan } from "@/lib/plans/access";
import { sendEmailAlert } from "@/lib/notifications/channels/email";
import { sendTelegramAlert } from "@/lib/notifications/channels/telegram";
import { sendSlackAlert } from "@/lib/notifications/channels/slack";
import { sendUserDiscordAlertBatch } from "@/lib/notifications/channels/discord-user";

export interface DispatchSummary {
  email: number;
  telegram: number;
  slack: number;
  discord: number;
}

/**
 * Fan a batch of alerts (for one wallet) out to every verified+enabled
 * channel that wallet has configured AND that their tier permits. Per-channel
 * failures are swallowed — one broken webhook must not block the others.
 */
export async function sendAlertsToUser(
  wallet: string,
  alerts: StrategyMonitorAlert[],
): Promise<DispatchSummary> {
  const summary: DispatchSummary = {
    email: 0,
    telegram: 0,
    slack: 0,
    discord: 0,
  };
  if (alerts.length === 0) return summary;

  const channels = listDeliverableChannels(wallet);
  if (channels.length === 0) return summary;

  const plan = getPlan(wallet);
  const allowed = new Set<ChannelKind>(
    plan.capabilities.alertChannels.filter(
      (c): c is ChannelKind =>
        c === "email" || c === "telegram" || c === "slack" || c === "discord",
    ),
  );

  await Promise.allSettled(
    channels.map(async (ch) => {
      if (!allowed.has(ch.channel)) return;
      switch (ch.channel) {
        case "email": {
          // Send one email per alert so users see distinct items in their inbox.
          for (const alert of alerts) {
            const ok = await sendEmailAlert(ch.endpoint, alert);
            if (ok) summary.email++;
          }
          return;
        }
        case "telegram": {
          for (const alert of alerts) {
            const ok = await sendTelegramAlert(ch.endpoint, alert);
            if (ok) summary.telegram++;
          }
          return;
        }
        case "slack": {
          for (const alert of alerts) {
            const ok = await sendSlackAlert(ch.endpoint, alert);
            if (ok) summary.slack++;
          }
          return;
        }
        case "discord": {
          // Discord webhook supports batched embeds; use the batch sender.
          const out = await sendUserDiscordAlertBatch(ch.endpoint, alerts);
          summary.discord += out.sent;
          return;
        }
      }
    }),
  );

  return summary;
}

/**
 * Dispatch a batch of alerts spanning multiple wallets. Groups by wallet,
 * dispatches each user's alerts in parallel.
 */
export async function dispatchAlertBatch(
  alerts: Array<StrategyMonitorAlert & { walletAddress?: string }>,
): Promise<void> {
  const byWallet = new Map<string, StrategyMonitorAlert[]>();
  for (const alert of alerts) {
    const wallet = alert.walletAddress?.toLowerCase();
    if (!wallet) continue;
    const list = byWallet.get(wallet) ?? [];
    list.push(alert);
    byWallet.set(wallet, list);
  }
  if (byWallet.size === 0) return;
  await Promise.allSettled(
    Array.from(byWallet.entries()).map(([wallet, list]) =>
      sendAlertsToUser(wallet, list),
    ),
  );
}

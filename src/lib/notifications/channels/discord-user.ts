import "server-only";
import type { StrategyMonitorAlert } from "@/lib/strategy-monitor";
import { alertDiscordEmbed } from "@/lib/notifications/templates";
import { log } from "@/lib/log";

const TIMEOUT_MS = 6_000;
const MAX_EMBEDS_PER_REQUEST = 10;

export function isValidDiscordWebhook(url: string): boolean {
  return /^https:\/\/discord(?:app)?\.com\/api\/webhooks\/[A-Za-z0-9_/-]+$/.test(
    url.trim(),
  );
}

async function postDiscord(
  url: string,
  embeds: ReturnType<typeof alertDiscordEmbed>[],
): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "Sovereign",
        embeds,
        allowed_mentions: { parse: [] },
      }),
      signal: controller.signal,
      redirect: "error",
    });
    if (!res.ok) {
      log.warn("discord", "user webhook rejected delivery", { status: res.status });
      return false;
    }
    return true;
  } catch (err) {
    log.warn("discord", "user webhook delivery failed", { error: err });
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

export async function verifyDiscordWebhook(url: string): Promise<boolean> {
  if (!isValidDiscordWebhook(url)) return false;
  return postDiscord(url, [
    {
      title: "Sovereign connected",
      description:
        "Alerts on your active positions will arrive in this channel — APY collapse, TVL drains, contract pauses, exploit signals.",
      color: 0x6ee7b7,
      timestamp: new Date().toISOString(),
      fields: [],
      footer: { text: "Sovereign · 24/7 monitoring" },
    },
  ]);
}

/** Plain informational embed (billing notices etc.) — not an alert. */
export async function sendUserDiscordText(
  url: string,
  title: string,
  description: string,
): Promise<boolean> {
  return postDiscord(url, [
    {
      title: title.slice(0, 256),
      description: description.slice(0, 2000),
      color: 0x60a5fa,
      timestamp: new Date().toISOString(),
      fields: [],
      footer: { text: "Sovereign" },
    },
  ]);
}

export async function sendUserDiscordAlert(
  url: string,
  alert: StrategyMonitorAlert,
): Promise<boolean> {
  return postDiscord(url, [alertDiscordEmbed(alert)]);
}

export async function sendUserDiscordAlertBatch(
  url: string,
  alerts: StrategyMonitorAlert[],
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;
  for (let i = 0; i < alerts.length; i += MAX_EMBEDS_PER_REQUEST) {
    const chunk = alerts.slice(i, i + MAX_EMBEDS_PER_REQUEST);
    const ok = await postDiscord(url, chunk.map(alertDiscordEmbed));
    if (ok) sent += chunk.length;
    else failed += chunk.length;
  }
  return { sent, failed };
}

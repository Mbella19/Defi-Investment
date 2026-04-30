import "server-only";
import type { StrategyMonitorAlert } from "@/lib/strategy-monitor";
import { alertDiscordEmbed } from "@/lib/notifications/templates";

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
      body: JSON.stringify({ username: "Sovereign", embeds }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      console.warn("[discord] user webhook failed", res.status, txt.slice(0, 200));
      return false;
    }
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[discord] user webhook post failed:", msg);
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

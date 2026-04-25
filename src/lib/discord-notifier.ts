import type { StrategyMonitorAlert } from "@/lib/strategy-monitor";

const WEBHOOK_TIMEOUT_MS = 6_000;
const MAX_EMBEDS_PER_REQUEST = 10;

const SEVERITY_COLOR: Record<string, number> = {
  critical: 0xef4444,
  warning: 0xf59e0b,
  info: 0x3b82f6,
};

const TYPE_LABEL: Record<string, string> = {
  apy_drop: "APY drop",
  tvl_drain: "TVL drain",
  rebalance: "Rebalance signal",
  protocol_tvl_crash: "Protocol TVL crash",
  protocol_paused: "Protocol paused",
  exploit_alert: "Exploit alert",
};

function getWebhookUrl(): string | null {
  const url = process.env.DISCORD_WEBHOOK_URL?.trim();
  if (!url) return null;
  if (!/^https:\/\/discord(?:app)?\.com\/api\/webhooks\//i.test(url)) return null;
  return url;
}

interface DiscordEmbed {
  title: string;
  description: string;
  color: number;
  timestamp: string;
  fields: Array<{ name: string; value: string; inline?: boolean }>;
  footer?: { text: string };
}

function buildEmbed(alert: StrategyMonitorAlert): DiscordEmbed {
  const sev = alert.severity.toLowerCase();
  const color = SEVERITY_COLOR[sev] ?? SEVERITY_COLOR.info;
  const typeLabel = TYPE_LABEL[alert.type] ?? alert.type;
  const sevTag = sev.toUpperCase();

  const fields: DiscordEmbed["fields"] = [
    { name: "Protocol", value: alert.protocol || "—", inline: true },
    { name: "Pool", value: alert.symbol || "—", inline: true },
    { name: "Chain", value: alert.chain || "—", inline: true },
  ];
  if (alert.detail) {
    fields.push({ name: "Detail", value: alert.detail.slice(0, 1000) });
  }

  return {
    title: `[${sevTag}] ${typeLabel}: ${alert.message}`.slice(0, 256),
    description: `Strategy \`${alert.strategyId.slice(0, 8)}\` flagged a new event.`,
    color,
    timestamp: alert.createdAt,
    fields,
    footer: { text: "Sovereign Terminal · continuous monitoring" },
  };
}

async function postWebhook(embeds: DiscordEmbed[]): Promise<boolean> {
  const url = getWebhookUrl();
  if (!url) return false;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "Sovereign Terminal",
        embeds,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.warn("[discord] webhook returned", res.status, body.slice(0, 200));
      return false;
    }
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[discord] webhook post failed:", msg);
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

export async function sendDiscordAlert(alert: StrategyMonitorAlert): Promise<boolean> {
  if (!getWebhookUrl()) return false;
  return postWebhook([buildEmbed(alert)]);
}

/**
 * Post a batch of alerts in chunks of ≤10 embeds (Discord's per-request limit).
 * Failures in one chunk do not block subsequent chunks.
 */
export async function sendDiscordAlertBatch(
  alerts: StrategyMonitorAlert[],
): Promise<{ sent: number; failed: number }> {
  if (alerts.length === 0 || !getWebhookUrl()) {
    return { sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;
  for (let i = 0; i < alerts.length; i += MAX_EMBEDS_PER_REQUEST) {
    const chunk = alerts.slice(i, i + MAX_EMBEDS_PER_REQUEST);
    const ok = await postWebhook(chunk.map(buildEmbed));
    if (ok) sent += chunk.length;
    else failed += chunk.length;
  }
  return { sent, failed };
}

export function isDiscordWebhookConfigured(): boolean {
  return getWebhookUrl() !== null;
}

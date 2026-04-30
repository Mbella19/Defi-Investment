import "server-only";
import type { StrategyMonitorAlert } from "@/lib/strategy-monitor";
import { alertPlainText, alertTitle } from "@/lib/notifications/templates";

const TIMEOUT_MS = 6_000;

const SEVERITY_COLOR: Record<string, string> = {
  critical: "#ef4444",
  warning: "#f59e0b",
  info: "#3b82f6",
};

export function isValidSlackWebhook(url: string): boolean {
  return /^https:\/\/hooks\.slack\.com\/services\/[A-Z0-9/]+$/i.test(url.trim());
}

interface SlackPayload {
  text: string;
  attachments?: Array<{
    color?: string;
    text?: string;
    fields?: Array<{ title: string; value: string; short?: boolean }>;
    footer?: string;
  }>;
}

async function postSlack(url: string, body: SlackPayload): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      console.warn("[slack] webhook failed", res.status, txt.slice(0, 200));
      return false;
    }
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[slack] webhook post failed:", msg);
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Verify a Slack webhook URL by posting a friendly greeting. If Slack
 * accepts the post (2xx), we know the URL is valid. Used during channel
 * setup to validate without storing an unverified webhook.
 */
export async function verifySlackWebhook(url: string): Promise<boolean> {
  if (!isValidSlackWebhook(url)) return false;
  return postSlack(url, {
    text: "🔐 Sovereign connected. Alerts on your active positions will arrive here.",
  });
}

export async function sendSlackAlert(
  url: string,
  alert: StrategyMonitorAlert,
): Promise<boolean> {
  const sev = alert.severity.toLowerCase();
  const color = SEVERITY_COLOR[sev] ?? SEVERITY_COLOR.info;
  return postSlack(url, {
    text: alertTitle(alert),
    attachments: [
      {
        color,
        text: alertPlainText(alert),
        footer: "Sovereign · 24/7 monitoring",
      },
    ],
  });
}

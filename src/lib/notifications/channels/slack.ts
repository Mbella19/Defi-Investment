import "server-only";
import type { StrategyMonitorAlert } from "@/lib/strategy-monitor";
import { alertPlainText, alertTitle } from "@/lib/notifications/templates";
import { log } from "@/lib/log";

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

/** Prevent Slack mrkdwn control sequences such as <!channel> from mentions. */
export function escapeSlackMrkdwn(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
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
      redirect: "error",
    });
    if (!res.ok) {
      log.warn("slack", "webhook rejected delivery", { status: res.status });
      return false;
    }
    return true;
  } catch (err) {
    log.warn("slack", "webhook delivery failed", { error: err });
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

/** Plain informational message (billing notices etc.) — not an alert. */
export async function sendSlackText(url: string, text: string): Promise<boolean> {
  return postSlack(url, { text });
}

export async function sendSlackAlert(
  url: string,
  alert: StrategyMonitorAlert,
): Promise<boolean> {
  const sev = alert.severity.toLowerCase();
  const color = SEVERITY_COLOR[sev] ?? SEVERITY_COLOR.info;
  return postSlack(url, {
    text: escapeSlackMrkdwn(alertTitle(alert)).slice(0, 300),
    attachments: [
      {
        color,
        text: escapeSlackMrkdwn(alertPlainText(alert)).slice(0, 3_000),
        footer: "Sovereign · 24/7 monitoring",
      },
    ],
  });
}

import "server-only";
import type { StrategyMonitorAlert } from "@/lib/strategy-monitor";
import { alertHtml, alertTitle } from "@/lib/notifications/templates";

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const SEND_TIMEOUT_MS = 8_000;

function getResendKey(): string | null {
  const key = process.env.RESEND_API_KEY?.trim();
  return key && key.length > 0 ? key : null;
}

function getFromAddress(): string {
  // Fallback to Resend's onboarding address — works without a verified
  // domain, but Resend will only deliver to the account owner's email
  // (you). For real multi-user delivery, configure your own verified domain
  // in the Resend dashboard and set RESEND_FROM=alerts@your-domain.com.
  return process.env.RESEND_FROM?.trim() || "Sovereign <onboarding@resend.dev>";
}

export function isEmailConfigured(): boolean {
  return getResendKey() !== null;
}

interface ResendBody {
  from: string;
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

async function postResend(body: ResendBody): Promise<boolean> {
  const key = getResendKey();
  if (!key) return false;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);
  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.warn("[email] resend send failed", res.status, text.slice(0, 200));
      return false;
    }
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[email] resend post failed:", msg);
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

export async function sendEmailVerificationCode(
  to: string,
  code: string,
): Promise<boolean> {
  if (!isEmailConfigured()) return false;
  const html = `<!doctype html>
<html><body style="margin:0;background:#0d1015;color:#e9edf2;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;">
  <div style="max-width:480px;margin:0 auto;padding:32px 24px;">
    <div style="padding:24px;background:#1a1d24;border-radius:10px;border:1px solid #2a313d;">
      <div style="text-transform:uppercase;font-size:11px;letter-spacing:0.08em;color:#6ee7b7;font-weight:700;margin-bottom:8px;">
        Sovereign · Email verification
      </div>
      <div style="font-size:18px;font-weight:600;line-height:1.3;color:#fff;margin-bottom:18px;">
        Confirm this email for alert delivery
      </div>
      <div style="font-size:13px;color:#9aa3b0;line-height:1.55;margin-bottom:18px;">
        Paste this code back into the alerts settings to finish setup. This code expires in 30 minutes.
      </div>
      <div style="display:inline-block;padding:14px 22px;background:#0d1015;border:1px solid #2a313d;border-radius:8px;font-family:'JetBrains Mono',Menlo,monospace;font-size:24px;font-weight:700;color:#fff;letter-spacing:0.2em;">
        ${code}
      </div>
      <div style="font-size:11px;color:#6c7280;margin-top:24px;line-height:1.5;">
        If you didn't request this, ignore the email. No alerts will be sent until you complete verification.
      </div>
    </div>
  </div>
</body></html>`;
  return postResend({
    from: getFromAddress(),
    to,
    subject: `Sovereign verification code: ${code}`,
    html,
    text: `Your Sovereign verification code is ${code}. It expires in 30 minutes.`,
  });
}

export async function sendEmailAlert(
  to: string,
  alert: StrategyMonitorAlert,
): Promise<boolean> {
  if (!isEmailConfigured()) return false;
  return postResend({
    from: getFromAddress(),
    to,
    subject: alertTitle(alert),
    html: alertHtml(alert),
  });
}

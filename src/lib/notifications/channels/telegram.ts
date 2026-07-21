import "server-only";
import type { StrategyMonitorAlert } from "@/lib/strategy-monitor";
import { alertPlainText, alertTitle } from "@/lib/notifications/templates";
import { log } from "@/lib/log";

const TIMEOUT_MS = 8_000;

function getBotToken(): string | null {
  const t = process.env.TELEGRAM_BOT_TOKEN?.trim();
  return t && t.length > 0 ? t : null;
}

export function getBotUsername(): string | null {
  const u = process.env.TELEGRAM_BOT_USERNAME?.trim();
  if (!u) return null;
  return u.replace(/^@/, "");
}

export function isTelegramConfigured(): boolean {
  return getBotToken() !== null && getBotUsername() !== null;
}

/**
 * The deeplink we hand to the user. Clicking it opens Telegram + drops a
 * pre-filled `/start <token>` into the bot chat. The bot's webhook (or our
 * polling endpoint) matches the token back to the pending verification.
 */
export function buildStartDeepLink(token: string): string | null {
  const username = getBotUsername();
  if (!username) return null;
  return `https://t.me/${username}?start=${encodeURIComponent(token)}`;
}

interface TelegramSendBody {
  chat_id: string;
  text: string;
  parse_mode?: "HTML" | "MarkdownV2";
  disable_web_page_preview?: boolean;
}

async function postTelegram<T = unknown>(
  method: string,
  body: Record<string, unknown>,
): Promise<{ ok: true; result: T } | { ok: false; reason: string }> {
  const token = getBotToken();
  if (!token) return { ok: false, reason: "Telegram bot not configured" };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
      redirect: "error",
    });
    const data = (await res.json().catch(() => ({}))) as {
      ok: boolean;
      result?: T;
      description?: string;
    };
    if (!res.ok || !data.ok) {
      return { ok: false, reason: data.description ?? `Telegram ${res.status}` };
    }
    return { ok: true, result: data.result as T };
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : String(err),
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function sendTelegramMessage(
  chatId: string,
  text: string,
): Promise<boolean> {
  const body: TelegramSendBody = {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
  };
  const out = await postTelegram("sendMessage", body as unknown as Record<string, unknown>);
  return out.ok;
}

export async function sendTelegramAlert(
  chatId: string,
  alert: StrategyMonitorAlert,
): Promise<boolean> {
  const heading = `<b>${escapeHtml(alertTitle(alert))}</b>`;
  const body = escapeHtml(alertPlainText(alert));
  return sendTelegramMessage(chatId, `${heading}\n\n${body}`);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

interface TelegramUpdate {
  update_id: number;
  message?: {
    chat: { id: number };
    text?: string;
    from?: { username?: string; first_name?: string };
  };
}

/**
 * Poll the Bot API for recent updates. Telegram returns updates since the
 * last acknowledged offset. The route acknowledges only after every matching
 * token has been persisted, so a transient SQLite failure cannot discard the
 * one Telegram update needed to complete setup.
 */
let updateOffset = 0;

export async function pollTelegramUpdates(): Promise<TelegramUpdate[]> {
  const out = await postTelegram<TelegramUpdate[]>("getUpdates", {
    offset: updateOffset,
    timeout: 0,
    allowed_updates: ["message"],
  });
  if (!out.ok) {
    log.warn("telegram", "poll failed", { reason: out.reason });
    return [];
  }
  return out.result ?? [];
}

export function acknowledgeTelegramUpdates(
  updates: ReadonlyArray<{ update_id: number }>,
): void {
  for (const update of updates) {
    if (update.update_id >= updateOffset) updateOffset = update.update_id + 1;
  }
}

/**
 * Pull the start-token argument from a Telegram /start command. Returns
 * the trimmed argument or null if the message isn't a /start with one.
 */
export function parseStartArgument(text: string | undefined): string | null {
  if (!text) return null;
  const match = text.match(/^\/start(?:\s+(.+))?$/);
  if (!match) return null;
  const arg = match[1]?.trim();
  return arg && arg.length > 0 ? arg : null;
}

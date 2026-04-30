import { requireWallet } from "@/lib/auth/guard";
import { enforceRateLimit } from "@/lib/rate-limit";
import {
  clearVerification,
  findVerificationByCode,
  getVerification,
  upsertChannel,
} from "@/lib/notifications/channels";
import {
  isTelegramConfigured,
  parseStartArgument,
  pollTelegramUpdates,
  sendTelegramMessage,
} from "@/lib/notifications/channels/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Polled by the client after the user clicks the Telegram deeplink. We
 * fetch recent updates from the Bot API, look for /start <token> messages,
 * and match each token back to its pending verification row.
 *
 * For multi-instance / serverless production, swap this for a webhook at
 * /api/webhooks/telegram with the same matching logic.
 */
export async function POST(request: Request) {
  const limited = enforceRateLimit(request, "channels.telegram-poll", {
    max: 60,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return limited;
  const auth = requireWallet(request);
  if ("response" in auth) return auth.response;

  if (!isTelegramConfigured()) {
    return Response.json(
      { error: "Telegram bot not configured on this server." },
      { status: 503 },
    );
  }

  // Pull recent updates and process any /start <token> matches we find.
  // A single poll covers ALL pending verifications across users — Telegram
  // only stores updates for ~24h, so it's fine to claim them all at once.
  const updates = await pollTelegramUpdates();
  for (const u of updates) {
    const text = u.message?.text;
    const chatId = u.message?.chat.id;
    const token = parseStartArgument(text);
    if (!token || chatId === undefined) continue;
    const pending = findVerificationByCode("telegram", token);
    if (!pending) continue;
    upsertChannel({
      wallet: pending.walletAddress,
      channel: "telegram",
      endpoint: String(chatId),
      verified: true,
    });
    clearVerification(pending.walletAddress, "telegram");
    void sendTelegramMessage(
      String(chatId),
      "✅ <b>Sovereign connected.</b>\n\nThis chat will now receive alerts on your active positions — APY collapse, TVL drains, contract pauses, exploit signals.",
    );
  }

  // Then check whether THIS user's verification has resolved (either by this
  // poll or a prior one). If so, the row is gone and the channel is upserted.
  const stillPending = getVerification(auth.wallet, "telegram");
  return Response.json({
    connected: stillPending === null,
    pending: stillPending !== null,
  });
}

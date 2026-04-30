import { requireWallet } from "@/lib/auth/guard";
import { getPlan } from "@/lib/plans/access";
import {
  generateAlphanumericToken,
  generateNumericCode,
  listUserChannels,
  startVerification,
  upsertChannel,
  type ChannelKind,
} from "@/lib/notifications/channels";
import {
  isEmailConfigured,
  sendEmailVerificationCode,
} from "@/lib/notifications/channels/email";
import {
  buildStartDeepLink,
  isTelegramConfigured,
} from "@/lib/notifications/channels/telegram";
import {
  isValidSlackWebhook,
  verifySlackWebhook,
} from "@/lib/notifications/channels/slack";
import {
  isValidDiscordWebhook,
  verifyDiscordWebhook,
} from "@/lib/notifications/channels/discord-user";
import { enforceRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_CHANNELS: ChannelKind[] = ["email", "telegram", "slack", "discord"];
const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface StartBody {
  channel?: string;
  endpoint?: string;
}

interface StartResponse {
  channel: ChannelKind;
  status: "pending_code" | "pending_telegram" | "verified";
  message: string;
  /** Only set for the telegram flow — the deeplink the user must click. */
  telegramDeeplink?: string;
  /** Only set for telegram — surfaced so support can debug if the bot misses it. */
  telegramToken?: string;
}

export async function GET(request: Request) {
  const auth = requireWallet(request);
  if ("response" in auth) return auth.response;
  const channels = listUserChannels(auth.wallet);
  const plan = getPlan(auth.wallet);
  return Response.json({
    channels,
    allowedChannels: plan.capabilities.alertChannels,
    tier: plan.tier,
    config: {
      email: isEmailConfigured(),
      telegram: isTelegramConfigured(),
    },
  });
}

export async function POST(request: Request) {
  const limited = enforceRateLimit(request, "channels", {
    max: 20,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return limited;
  const auth = requireWallet(request);
  if ("response" in auth) return auth.response;

  let body: StartBody;
  try {
    body = (await request.json()) as StartBody;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const channel = body.channel as ChannelKind | undefined;
  const endpoint = body.endpoint?.trim() ?? "";
  if (!channel || !VALID_CHANNELS.includes(channel)) {
    return Response.json(
      { error: "Unknown channel. Expected: email, telegram, slack, or discord." },
      { status: 400 },
    );
  }

  const plan = getPlan(auth.wallet);
  if (!plan.capabilities.alertChannels.includes(channel)) {
    return Response.json(
      {
        error: `${channel} alerts are not available on the ${plan.tier} plan.`,
        tier: plan.tier,
        upgradePath: plan.tier === "free" ? "pro" : "ultra",
      },
      { status: 402 },
    );
  }

  if (channel === "email") {
    if (!EMAIL_RX.test(endpoint)) {
      return Response.json(
        { error: "Enter a valid email address." },
        { status: 400 },
      );
    }
    if (!isEmailConfigured()) {
      return Response.json(
        {
          error:
            "Email delivery isn't configured on this server. Ask the operator to set RESEND_API_KEY.",
        },
        { status: 503 },
      );
    }
    const code = generateNumericCode(6);
    startVerification({
      wallet: auth.wallet,
      channel,
      endpoint,
      code,
    });
    const sent = await sendEmailVerificationCode(endpoint, code);
    if (!sent) {
      return Response.json(
        { error: "Could not send the verification email. Try again in a minute." },
        { status: 502 },
      );
    }
    const response: StartResponse = {
      channel,
      status: "pending_code",
      message: `We sent a 6-digit code to ${endpoint}. Paste it below to confirm.`,
    };
    return Response.json(response);
  }

  if (channel === "telegram") {
    if (!isTelegramConfigured()) {
      return Response.json(
        {
          error:
            "Telegram bot isn't configured on this server. Ask the operator to set TELEGRAM_BOT_TOKEN and TELEGRAM_BOT_USERNAME.",
        },
        { status: 503 },
      );
    }
    const token = generateAlphanumericToken(10);
    // Endpoint is a placeholder until the user pings the bot — we'll fill in
    // the real chat_id when /start <token> arrives. Store the token as the
    // verification code AND seed the row so the dispatcher knows there's a
    // setup in progress.
    startVerification({
      wallet: auth.wallet,
      channel,
      endpoint: "pending",
      code: token,
    });
    const link = buildStartDeepLink(token);
    if (!link) {
      return Response.json(
        { error: "Telegram bot username not configured." },
        { status: 503 },
      );
    }
    const response: StartResponse = {
      channel,
      status: "pending_telegram",
      message:
        "Open the link below in Telegram. The bot will receive your /start automatically — come back here and click 'Check connection'.",
      telegramDeeplink: link,
      telegramToken: token,
    };
    return Response.json(response);
  }

  if (channel === "slack") {
    if (!isValidSlackWebhook(endpoint)) {
      return Response.json(
        {
          error:
            "That doesn't look like a Slack incoming-webhook URL. It should start with https://hooks.slack.com/services/.",
        },
        { status: 400 },
      );
    }
    const ok = await verifySlackWebhook(endpoint);
    if (!ok) {
      return Response.json(
        { error: "Slack didn't accept the webhook test post — check the URL." },
        { status: 400 },
      );
    }
    upsertChannel({
      wallet: auth.wallet,
      channel,
      endpoint,
      verified: true,
    });
    const response: StartResponse = {
      channel,
      status: "verified",
      message: "Slack channel connected. We posted a confirmation message.",
    };
    return Response.json(response);
  }

  if (channel === "discord") {
    if (!isValidDiscordWebhook(endpoint)) {
      return Response.json(
        {
          error:
            "That doesn't look like a Discord webhook URL. It should start with https://discord.com/api/webhooks/.",
        },
        { status: 400 },
      );
    }
    const ok = await verifyDiscordWebhook(endpoint);
    if (!ok) {
      return Response.json(
        { error: "Discord didn't accept the webhook test post — check the URL." },
        { status: 400 },
      );
    }
    upsertChannel({
      wallet: auth.wallet,
      channel,
      endpoint,
      verified: true,
    });
    const response: StartResponse = {
      channel,
      status: "verified",
      message: "Discord channel connected. We posted a confirmation message.",
    };
    return Response.json(response);
  }

  return Response.json({ error: "Unhandled channel" }, { status: 400 });
}

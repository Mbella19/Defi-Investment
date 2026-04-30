import { requireWallet } from "@/lib/auth/guard";
import { enforceRateLimit } from "@/lib/rate-limit";
import {
  consumeVerification,
  upsertChannel,
  type ChannelKind,
} from "@/lib/notifications/channels";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface VerifyBody {
  channel?: string;
  code?: string;
}

const VALID_CHANNELS: ChannelKind[] = ["email"];

export async function POST(request: Request) {
  const limited = enforceRateLimit(request, "channels.verify", {
    max: 30,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return limited;
  const auth = requireWallet(request);
  if ("response" in auth) return auth.response;

  let body: VerifyBody;
  try {
    body = (await request.json()) as VerifyBody;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const channel = body.channel as ChannelKind | undefined;
  const code = body.code?.trim() ?? "";
  if (!channel || !VALID_CHANNELS.includes(channel)) {
    return Response.json(
      {
        error:
          "Code verification is only used for email. Telegram uses the deeplink + 'Check connection'; Slack and Discord verify on connect.",
      },
      { status: 400 },
    );
  }
  if (!code || code.length < 4) {
    return Response.json({ error: "Enter the code." }, { status: 400 });
  }

  const out = consumeVerification(auth.wallet, channel, code);
  if (!out.ok) {
    return Response.json({ error: out.reason }, { status: 400 });
  }

  upsertChannel({
    wallet: auth.wallet,
    channel,
    endpoint: out.endpoint,
    verified: true,
  });

  return Response.json({
    ok: true,
    channel,
    endpoint: out.endpoint,
    message: "Channel verified — alerts will arrive here.",
  });
}

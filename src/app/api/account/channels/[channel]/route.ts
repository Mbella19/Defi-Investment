import { requireWallet } from "@/lib/auth/guard";
import {
  deleteChannel,
  setChannelEnabled,
  type ChannelKind,
} from "@/lib/notifications/channels";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID: ChannelKind[] = ["email", "telegram", "slack", "discord"];

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ channel: string }> },
) {
  const auth = requireWallet(request);
  if ("response" in auth) return auth.response;
  const { channel } = await params;
  if (!VALID.includes(channel as ChannelKind)) {
    return Response.json({ error: "Unknown channel." }, { status: 400 });
  }
  deleteChannel(auth.wallet, channel as ChannelKind);
  return Response.json({ ok: true });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ channel: string }> },
) {
  const auth = requireWallet(request);
  if ("response" in auth) return auth.response;
  const { channel } = await params;
  if (!VALID.includes(channel as ChannelKind)) {
    return Response.json({ error: "Unknown channel." }, { status: 400 });
  }
  let body: { enabled?: boolean };
  try {
    body = (await request.json()) as { enabled?: boolean };
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (typeof body.enabled !== "boolean") {
    return Response.json({ error: "enabled must be a boolean" }, { status: 400 });
  }
  setChannelEnabled(auth.wallet, channel as ChannelKind, body.enabled);
  return Response.json({ ok: true, enabled: body.enabled });
}

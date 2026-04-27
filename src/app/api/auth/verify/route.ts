import { verifySiweMessage } from "@/lib/auth/siwe";
import { sessionCookieHeader } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { message?: string; signature?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.message || !body.signature) {
    return Response.json({ error: "message and signature required" }, { status: 400 });
  }

  const result = await verifySiweMessage({
    message: body.message,
    signature: body.signature,
  });
  if (!result.ok || !result.address) {
    return Response.json({ error: result.error ?? "verification failed" }, { status: 401 });
  }

  const headers = new Headers();
  headers.set("Set-Cookie", sessionCookieHeader(result.address));
  return new Response(JSON.stringify({ address: result.address }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": sessionCookieHeader(result.address),
    },
  });
}

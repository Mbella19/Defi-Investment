import { getSession } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = getSession(request);
  return Response.json(
    {
      address: session?.wallet ?? null,
      authMethod: session?.authMethod ?? null,
      expiresAt: session ? new Date(session.expiresAt).toISOString() : null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

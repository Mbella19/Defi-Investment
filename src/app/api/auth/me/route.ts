import { getSessionWallet } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const wallet = getSessionWallet(request);
  return Response.json({ address: wallet ?? null });
}

import { endSession } from "@/lib/session";
import { resetWorld } from "@/lib/db";

// POST /api/reset  -> dev convenience: reseed the demo world and sign out.
export async function POST() {
  await resetWorld();
  await endSession();
  return Response.json({ ok: true });
}

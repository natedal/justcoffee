import { currentUserId, unauthorized } from "@/lib/auth";
import { matchView } from "@/lib/actions";
import * as db from "@/lib/db";

// GET /api/matches  -> the signed-in user's confirmed matches
export async function GET() {
  const uid = await currentUserId();
  if (!uid) return unauthorized();
  const matches = db
    .matchesForUser(uid)
    .filter((m) => m.status !== "closed")
    .map((m) => matchView(m, uid));
  return Response.json({ matches });
}

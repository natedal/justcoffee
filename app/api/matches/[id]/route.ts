import { currentUserId, unauthorized } from "@/lib/auth";
import { matchView } from "@/lib/actions";
import * as db from "@/lib/db";

// GET /api/matches/:id  -> a single confirmed match (identities revealed)
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const uid = await currentUserId();
  if (!uid) return unauthorized();
  const { id } = await params;
  const m = await db.getMatch(id);
  if (!m || (m.aId !== uid && m.bId !== uid))
    return Response.json({ error: "not found" }, { status: 404 });
  return Response.json({ match: await matchView(m, uid) });
}

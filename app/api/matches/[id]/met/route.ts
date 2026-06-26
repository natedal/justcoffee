import { currentUserId, unauthorized } from "@/lib/auth";
import { matchView } from "@/lib/actions";
import * as db from "@/lib/db";

// POST /api/matches/:id/met  { met: boolean }  -> post-coffee "did you meet?" prompt
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const uid = await currentUserId();
  if (!uid) return unauthorized();
  const { id } = await params;
  const m = db.getMatch(id);
  if (!m || (m.aId !== uid && m.bId !== uid))
    return Response.json({ error: "not found" }, { status: 404 });

  let met: boolean | null = null;
  try {
    met = Boolean((await req.json())?.met);
  } catch {
    /* noop */
  }
  m.met[uid] = met ? "yes" : "no";
  db.updateMatch(m);
  return Response.json({ match: matchView(m, uid) });
}

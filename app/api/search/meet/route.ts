import { currentUserId, unauthorized } from "@/lib/auth";
import { expressInterest, matchView } from "@/lib/actions";
import * as db from "@/lib/db";

// POST /api/search/meet  { candidateId }
// Records interest. If it's mutual, a match is created and returned (identities revealed).
export async function POST(req: Request) {
  const uid = await currentUserId();
  if (!uid) return unauthorized();

  let candidateId = "";
  try {
    candidateId = String((await req.json())?.candidateId ?? "");
  } catch {
    /* noop */
  }
  if (!candidateId) return Response.json({ error: "candidateId required" }, { status: 400 });

  const result = expressInterest(uid, candidateId);
  if (result.matched && result.matchId) {
    const m = db.getMatch(result.matchId)!;
    return Response.json({ matched: true, match: matchView(m, uid) });
  }
  return Response.json({ matched: false, theyPassed: result.theyPassed });
}

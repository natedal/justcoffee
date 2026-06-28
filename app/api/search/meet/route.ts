import { currentUserId, unauthorized } from "@/lib/auth";
import { expressInterest, matchView } from "@/lib/actions";
import { track } from "@/lib/analytics";
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

  const result = await expressInterest(uid, candidateId);
  track(uid, "interest_sent", { mutual: result.matched, they_passed: result.theyPassed });
  if (result.matched && result.matchId) {
    track(uid, "mutual_match", { match_id: result.matchId });
    const m = (await db.getMatch(result.matchId))!;
    return Response.json({ matched: true, match: await matchView(m, uid) });
  }
  return Response.json({ matched: false, theyPassed: result.theyPassed });
}

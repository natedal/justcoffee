import { currentUserId, unauthorized } from "@/lib/auth";
import { passCandidate } from "@/lib/actions";

// POST /api/search/pass  { candidateId }
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

  await passCandidate(uid, candidateId);
  return Response.json({ ok: true });
}

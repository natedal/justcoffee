import { currentUserId, unauthorized } from "@/lib/auth";
import { nextCandidateFor } from "@/lib/actions";
import { aiEnabled } from "@/lib/claude";

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

// POST /api/search  { challenge: 0..1 }  -> the next best candidate (or null)
export async function POST(req: Request) {
  const uid = await currentUserId();
  if (!uid) return unauthorized();

  let challenge = 0.5;
  try {
    const body = await req.json();
    if (Number.isFinite(Number(body?.challenge))) challenge = clamp01(Number(body.challenge));
  } catch {
    /* default challenge */
  }

  const candidate = await nextCandidateFor(uid, challenge);
  return Response.json({ candidate, aiEnabled: aiEnabled() });
}

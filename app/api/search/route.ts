import { currentUserId, unauthorized } from "@/lib/auth";
import { nextCandidateFor } from "@/lib/actions";
import { aiEnabled } from "@/lib/claude";
import { challengeBucket, track } from "@/lib/analytics";
import type { AvailabilityWindow } from "@/lib/types";

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const AVAIL: AvailabilityWindow[] = ["now", "today", "weekend"];

// POST /api/search  { challenge: 0..1, availability?: now|today|weekend }
//   -> the next best candidate (or null). Availability is chosen per search.
export async function POST(req: Request) {
  const uid = await currentUserId();
  if (!uid) return unauthorized();

  let challenge = 0.5;
  let availability: AvailabilityWindow | undefined;
  try {
    const body = await req.json();
    if (Number.isFinite(Number(body?.challenge))) challenge = clamp01(Number(body.challenge));
    if (AVAIL.includes(body?.availability)) availability = body.availability;
  } catch {
    /* defaults */
  }

  const candidate = await nextCandidateFor(uid, challenge, availability);
  track(uid, "search_started", {
    challenge: challengeBucket(challenge),
    availability: availability ?? null,
    found_candidate: Boolean(candidate),
  });
  return Response.json({ candidate, aiEnabled: aiEnabled() });
}

import { currentUserId, unauthorized } from "@/lib/auth";
import { selfView } from "@/lib/actions";
import * as db from "@/lib/db";

// POST /api/verify  -> marks the current photo as verified.
// MVP stub for real identity/selfie verification: it confirms a photo exists and
// records the user's attestation. Swap the body for a liveness/ID-match provider
// (e.g. Stripe Identity, Persona) without touching call sites.
export async function POST() {
  const uid = await currentUserId();
  if (!uid) return unauthorized();

  const user = await db.getUser(uid);
  if (!user) return unauthorized();
  if (!user.photoUrl)
    return Response.json(
      { error: "add a photo before verifying" },
      { status: 400 },
    );

  user.verified = true;
  await db.upsertUser(user);
  return Response.json({ user: selfView(user) });
}

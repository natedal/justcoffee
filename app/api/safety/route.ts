import { currentUserId, unauthorized } from "@/lib/auth";
import { blockUser, reportUser } from "@/lib/actions";

// POST /api/safety  { targetId, action: "block" | "report", reason?, context? }
// Available at any time — including before the reveal.
export async function POST(req: Request) {
  const uid = await currentUserId();
  if (!uid) return unauthorized();

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    /* noop */
  }
  const targetId = String(body.targetId ?? "");
  const action = String(body.action ?? "");
  if (!targetId) return Response.json({ error: "targetId required" }, { status: 400 });

  if (action === "report") {
    await reportUser(
      uid,
      targetId,
      String(body.reason ?? "unspecified").slice(0, 80),
      String(body.context ?? "").slice(0, 300),
    );
    return Response.json({ ok: true, blocked: true, reported: true });
  }
  if (action === "block") {
    await blockUser(uid, targetId);
    return Response.json({ ok: true, blocked: true });
  }
  return Response.json({ error: "unknown action" }, { status: 400 });
}

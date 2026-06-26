import { currentUserId, unauthorized } from "@/lib/auth";
import * as db from "@/lib/db";

function ensureParticipant(matchId: string, uid: string) {
  const m = db.getMatch(matchId);
  if (!m || (m.aId !== uid && m.bId !== uid)) return null;
  return m;
}

function serialize(matchId: string, uid: string) {
  return db.messagesForMatch(matchId).map((msg) => ({
    id: msg.id,
    mine: msg.fromId === uid,
    body: msg.body,
    at: msg.at,
  }));
}

// GET /api/matches/:id/messages  -> messages (only after a mutual match)
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const uid = await currentUserId();
  if (!uid) return unauthorized();
  const { id } = await params;
  if (!ensureParticipant(id, uid))
    return Response.json({ error: "not found" }, { status: 404 });
  return Response.json({ messages: serialize(id, uid) });
}

// POST /api/matches/:id/messages  { body }
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const uid = await currentUserId();
  if (!uid) return unauthorized();
  const { id } = await params;
  const m = ensureParticipant(id, uid);
  if (!m) return Response.json({ error: "not found" }, { status: 404 });
  if (m.status === "closed")
    return Response.json({ error: "this conversation is closed" }, { status: 403 });

  let body = "";
  try {
    body = String((await req.json())?.body ?? "").trim().slice(0, 1000);
  } catch {
    /* noop */
  }
  if (!body) return Response.json({ error: "empty message" }, { status: 400 });

  db.addMessage({
    id: db.id("msg"),
    matchId: id,
    fromId: uid,
    body,
    at: Date.now(),
  });
  return Response.json({ messages: serialize(id, uid) });
}

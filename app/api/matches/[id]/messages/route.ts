import { currentUserId, unauthorized } from "@/lib/auth";
import * as db from "@/lib/db";
import { publish } from "@/lib/events";
import { track } from "@/lib/analytics";

async function ensureParticipant(matchId: string, uid: string) {
  const m = await db.getMatch(matchId);
  if (!m || (m.aId !== uid && m.bId !== uid)) return null;
  return m;
}

async function serialize(matchId: string, uid: string) {
  const msgs = await db.messagesForMatch(matchId);
  return msgs.map((msg) => ({
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
  if (!(await ensureParticipant(id, uid)))
    return Response.json({ error: "not found" }, { status: 404 });
  return Response.json({ messages: await serialize(id, uid) });
}

// POST /api/matches/:id/messages  { body }
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const uid = await currentUserId();
  if (!uid) return unauthorized();
  const { id } = await params;
  const m = await ensureParticipant(id, uid);
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

  const now = Date.now();
  await db.addMessage({
    id: db.id("msg"),
    matchId: id,
    fromId: uid,
    body,
    at: now,
  });

  // Only the fact and length of a message — never its contents (private).
  track(uid, "message_sent", { match_id: id, length: body.length });

  // Push the new message to the other participant in real time.
  const otherId = m.aId === uid ? m.bId : m.aId;
  const sender = await db.getUser(uid);
  publish(otherId, {
    type: "message",
    matchId: id,
    fromName: sender?.name ?? "your match",
    preview: body.slice(0, 120),
    at: now,
  });

  return Response.json({ messages: await serialize(id, uid) });
}

import { getSessionUserId } from "@/lib/session";
import { selfView } from "@/lib/actions";
import { aiEnabled } from "@/lib/claude";
import * as db from "@/lib/db";

export async function GET() {
  const uid = await getSessionUserId();
  const u = uid ? db.getUser(uid) : null;
  return Response.json({ user: u ? selfView(u) : null, aiEnabled: aiEnabled() });
}

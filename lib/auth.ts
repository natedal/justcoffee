import { getSessionUserId } from "./session";
import * as db from "./db";

/** Returns the signed-in user's id, or null if there's no valid session. */
export async function currentUserId(): Promise<string | null> {
  const uid = await getSessionUserId();
  if (!uid) return null;
  return db.getUser(uid) ? uid : null;
}

export function unauthorized() {
  return Response.json({ error: "not signed in" }, { status: 401 });
}

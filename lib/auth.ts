import { getSessionUserId } from "./session";
import * as db from "./db";

/** Returns the signed-in user's id, or null if there's no valid session. */
export async function currentUserId(): Promise<string | null> {
  const uid = await getSessionUserId();
  if (!uid) return null;
  return (await db.getUser(uid)) ? uid : null;
}

export function unauthorized() {
  return Response.json({ error: "not signed in" }, { status: 401 });
}

/**
 * Admin gate for dangerous/operational endpoints (reset, stats). Requires the
 * request to present JUSTCOFFEE_ADMIN_KEY via `x-admin-key` header or `?key=`.
 * If no admin key is configured, admin endpoints are denied (fail closed).
 */
export function isAdminRequest(req: Request): boolean {
  const expected = process.env.JUSTCOFFEE_ADMIN_KEY;
  if (!expected) return false;
  const headerKey = req.headers.get("x-admin-key");
  const url = new URL(req.url);
  const queryKey = url.searchParams.get("key");
  const provided = headerKey ?? queryKey ?? "";
  return provided.length === expected.length && provided === expected;
}

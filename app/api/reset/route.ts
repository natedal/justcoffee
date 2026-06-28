import { endSession } from "@/lib/session";
import { resetWorld } from "@/lib/db";
import { isAdminRequest } from "@/lib/auth";

// POST /api/reset  -> wipes ALL data and reseeds. Admin-only: this is
// destructive, so it requires JUSTCOFFEE_ADMIN_KEY (header x-admin-key or ?key=).
export async function POST(req: Request) {
  if (!isAdminRequest(req)) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  await resetWorld();
  await endSession();
  return Response.json({ ok: true });
}

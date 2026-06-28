import { isAdminRequest } from "@/lib/auth";
import { stats } from "@/lib/db";

// GET /api/admin/stats?key=ADMIN_KEY  -> aggregate test metrics.
// Admin-only: surfaces engagement numbers without exposing any personal data.
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!isAdminRequest(req)) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  return Response.json(await stats());
}

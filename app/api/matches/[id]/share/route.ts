import { currentUserId, unauthorized } from "@/lib/auth";
import { sharePlans } from "@/lib/actions";

// GET /api/matches/:id/share  -> a "share your plans" message for a trusted contact
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const uid = await currentUserId();
  if (!uid) return unauthorized();
  const { id } = await params;
  const text = sharePlans(uid, id);
  if (!text) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json({ text });
}

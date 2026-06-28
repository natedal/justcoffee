import { currentUserId } from "@/lib/auth";
import { getPhoto, isSafeFilename } from "@/lib/uploads";

// GET /api/photo/:file  -> streams an uploaded photo (from R2 or local disk).
// Requires a session so a leaked URL alone can't expose someone's photo.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ file: string }> },
) {
  const uid = await currentUserId();
  if (!uid) return new Response("unauthorized", { status: 401 });

  const { file } = await params;
  if (!isSafeFilename(file)) return new Response("not found", { status: 404 });

  const photo = await getPhoto(file);
  if (!photo) return new Response("not found", { status: 404 });

  return new Response(photo.body, {
    headers: {
      "content-type": photo.contentType,
      "cache-control": "private, max-age=3600",
    },
  });
}

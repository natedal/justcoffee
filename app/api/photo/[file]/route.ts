import fs from "node:fs/promises";
import path from "node:path";
import { currentUserId } from "@/lib/auth";
import {
  UPLOAD_DIR,
  contentTypeForFile,
  isSafeFilename,
} from "@/lib/uploads";

// GET /api/photo/:file  -> streams an uploaded photo. Requires a session so a
// leaked URL alone can't expose someone's photo to the public internet.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ file: string }> },
) {
  const uid = await currentUserId();
  if (!uid) return new Response("unauthorized", { status: 401 });

  const { file } = await params;
  if (!isSafeFilename(file)) return new Response("not found", { status: 404 });

  try {
    const data = await fs.readFile(path.join(UPLOAD_DIR, file));
    return new Response(new Uint8Array(data), {
      headers: {
        "content-type": contentTypeForFile(file),
        "cache-control": "private, max-age=3600",
      },
    });
  } catch {
    return new Response("not found", { status: 404 });
  }
}

import crypto from "node:crypto";
import { currentUserId, unauthorized } from "@/lib/auth";
import { selfView } from "@/lib/actions";
import * as db from "@/lib/db";
import {
  ALLOWED_IMAGE_TYPES,
  MAX_UPLOAD_BYTES,
  putPhoto,
} from "@/lib/uploads";

// POST /api/photo  (multipart form-data, field "photo")
// Stores the user's photo locally and saves its URL on the profile. The photo
// is only ever revealed to a match after a mutual yes (blurred before that).
export async function POST(req: Request) {
  const uid = await currentUserId();
  if (!uid) return unauthorized();

  let file: Blob | null = null;
  try {
    const form = await req.formData();
    const entry = form.get("photo");
    if (entry instanceof Blob) file = entry;
  } catch {
    return Response.json({ error: "invalid upload" }, { status: 400 });
  }
  if (!file) return Response.json({ error: "no photo provided" }, { status: 400 });

  const ext = ALLOWED_IMAGE_TYPES[file.type];
  if (!ext)
    return Response.json(
      { error: "use a JPG, PNG, or WebP image" },
      { status: 400 },
    );
  if (file.size > MAX_UPLOAD_BYTES)
    return Response.json({ error: "image must be under 5 MB" }, { status: 400 });

  const user = await db.getUser(uid);
  if (!user) return unauthorized();

  const buf = Buffer.from(await file.arrayBuffer());
  const filename = `${uid}-${crypto.randomBytes(6).toString("hex")}.${ext}`;
  await putPhoto(filename, buf, file.type);

  user.photoUrl = `/api/photo/${filename}`;
  // A brand-new photo resets verification — you re-verify the current photo.
  user.verified = false;
  await db.upsertUser(user);

  return Response.json({ user: selfView(user) });
}

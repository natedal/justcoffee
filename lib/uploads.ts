import path from "node:path";

// Where uploaded photos live. Under .data (gitignored, same as the dev store).
// In production this becomes object storage (S3/R2/Supabase Storage) — only this
// module and the photo routes change.
export const UPLOAD_DIR = path.join(process.cwd(), ".data", "uploads");

export const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB

const EXT_TO_TYPE: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export function contentTypeForFile(file: string): string {
  const ext = file.split(".").pop()?.toLowerCase() ?? "";
  return EXT_TO_TYPE[ext] ?? "application/octet-stream";
}

/** Allow only safe, flat filenames (no path traversal). */
export function isSafeFilename(file: string): boolean {
  return /^[A-Za-z0-9._-]+$/.test(file) && !file.includes("..");
}

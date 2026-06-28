import path from "node:path";
import fs from "node:fs/promises";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";

// Photo storage. Uses Cloudflare R2 (S3-compatible) when configured — durable
// across deploys/restarts — and falls back to local disk for local dev. Photos
// are served through /api/photo/[file] (auth-gated), never a public URL, so the
// pre-reveal privacy model holds.

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

// --- R2 (Cloudflare object storage) -------------------------------------
const g = globalThis as unknown as { __jc_r2?: S3Client };

export function r2Configured(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET,
  );
}

function r2(): S3Client {
  if (g.__jc_r2) return g.__jc_r2;
  g.__jc_r2 = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
  return g.__jc_r2;
}

async function diskPut(key: string, body: Buffer): Promise<void> {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  await fs.writeFile(path.join(UPLOAD_DIR, key), body);
}

async function diskGet(
  key: string,
): Promise<{ body: Uint8Array; contentType: string } | null> {
  try {
    const data = await fs.readFile(path.join(UPLOAD_DIR, key));
    return { body: new Uint8Array(data), contentType: contentTypeForFile(key) };
  } catch {
    return null;
  }
}

/** Store a photo. Tries R2 (durable); on any R2 error, falls back to local disk
 *  so uploads never hard-fail because of a storage misconfiguration. */
export async function putPhoto(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  if (r2Configured()) {
    try {
      await r2().send(
        new PutObjectCommand({
          Bucket: process.env.R2_BUCKET!,
          Key: key,
          Body: body,
          ContentType: contentType,
        }),
      );
      return;
    } catch (err) {
      console.error(
        "[r2] put failed, falling back to local disk:",
        err instanceof Error ? err.message : err,
      );
    }
  }
  await diskPut(key, body);
}

/** Fetch a stored photo. Tries R2, then local disk; null if not found. */
export async function getPhoto(
  key: string,
): Promise<{ body: Uint8Array; contentType: string } | null> {
  if (r2Configured()) {
    try {
      const res = await r2().send(
        new GetObjectCommand({ Bucket: process.env.R2_BUCKET!, Key: key }),
      );
      const bytes = await res.Body!.transformToByteArray();
      return { body: bytes, contentType: res.ContentType ?? contentTypeForFile(key) };
    } catch {
      // fall through to disk (e.g. file was written before R2 worked)
    }
  }
  return diskGet(key);
}

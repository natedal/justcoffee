import crypto from "node:crypto";

// Magic-link sign-in tokens — STATELESS and signed (HMAC over "email|expiry").
// Because nothing is stored server-side, links survive deploys, restarts, and
// multiple instances (the previous in-memory store broke on every redeploy).
// Time-limited (15 min); not single-use, which is an acceptable tradeoff for a
// passwordless email link. The signing key is the app's session secret.

const TTL_MS = 15 * 60 * 1000; // 15 minutes
const SECRET = process.env.JUSTCOFFEE_SESSION_SECRET || "dev-only-change-me";

export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const email = raw.trim().toLowerCase();
  // Deliberately permissive: one @, something on each side, a dot in the domain.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email.slice(0, 200);
}

function hmac(payload: string): string {
  return crypto.createHmac("sha256", SECRET).update(payload).digest("base64url");
}

/** Issue a signed, time-limited token for an email. No server-side state. */
export function createToken(email: string): string {
  const payload = Buffer.from(`${email}|${Date.now() + TTL_MS}`).toString(
    "base64url",
  );
  return `${payload}.${hmac(payload)}`;
}

/** Validate a token, returning the email it was issued for (or null if invalid
 *  or expired). Verifies the HMAC in constant time before trusting anything. */
export function consumeToken(token: string): string | null {
  const dot = token.lastIndexOf(".");
  if (dot < 0) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  const expected = hmac(payload);
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return null;
  }

  let decoded: string;
  try {
    decoded = Buffer.from(payload, "base64url").toString("utf8");
  } catch {
    return null;
  }
  const sep = decoded.lastIndexOf("|");
  if (sep < 0) return null;
  const email = decoded.slice(0, sep);
  const expiresAt = Number(decoded.slice(sep + 1));
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return null;
  return email;
}

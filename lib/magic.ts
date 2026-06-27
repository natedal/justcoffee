import crypto from "node:crypto";

// Magic-link sign-in tokens. Single-use, short-lived, kept in memory (stashed on
// globalThis so dev hot-reloads don't drop them). In production these would be
// stored in the database and the link would be delivered by an email provider
// (Resend/Postmark/SES); here we surface the link directly so the flow is fully
// usable with zero external services.

const TTL_MS = 15 * 60 * 1000; // 15 minutes

interface PendingToken {
  email: string;
  expiresAt: number;
}

const g = globalThis as unknown as {
  __jc_magic?: Map<string, PendingToken>;
};

function store(): Map<string, PendingToken> {
  if (!g.__jc_magic) g.__jc_magic = new Map();
  return g.__jc_magic;
}

export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const email = raw.trim().toLowerCase();
  // Deliberately permissive: one @, something on each side, a dot in the domain.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email.slice(0, 200);
}

/** Issue a single-use token for an email and return it. */
export function createToken(email: string): string {
  const token = crypto.randomBytes(24).toString("base64url");
  store().set(token, { email, expiresAt: Date.now() + TTL_MS });
  return token;
}

/** Consume a token, returning the email it was issued for (or null if invalid). */
export function consumeToken(token: string): string | null {
  const s = store();
  const entry = s.get(token);
  if (!entry) return null;
  s.delete(token); // single use
  if (Date.now() > entry.expiresAt) return null;
  return entry.email;
}

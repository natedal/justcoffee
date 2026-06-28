import { cookies } from "next/headers";
import crypto from "node:crypto";

// Lightweight signed-cookie session. No passwords for the MVP: completing
// onboarding issues a session. Replace with real auth (magic link / OAuth)
// before launch.

const COOKIE = "jc_session";
const SECRET = process.env.JUSTCOFFEE_SESSION_SECRET || "dev-only-change-me";

function sign(userId: string): string {
  const mac = crypto
    .createHmac("sha256", SECRET)
    .update(userId)
    .digest("base64url");
  return `${userId}.${mac}`;
}

function verify(token: string | undefined): string | null {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot < 0) return null;
  const userId = token.slice(0, dot);
  const mac = token.slice(dot + 1);
  const expected = crypto
    .createHmac("sha256", SECRET)
    .update(userId)
    .digest("base64url");
  if (mac.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected)))
    return null;
  return userId;
}

export async function getSessionUserId(): Promise<string | null> {
  const store = await cookies();
  return verify(store.get(COOKIE)?.value);
}

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 90,
};

export async function startSession(userId: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE, sign(userId), COOKIE_OPTS);
}

/** The session cookie spec, for setting it directly on a response (e.g. a
 *  redirect from the magic-link verify route, where relying on the ambient
 *  cookie store is less reliable). */
export function sessionCookie(userId: string) {
  return { name: COOKIE, value: sign(userId), options: COOKIE_OPTS };
}

export async function endSession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
}

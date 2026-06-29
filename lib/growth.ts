import crypto from "node:crypto";
import { isSupabaseConfigured, supabase } from "./supabase";
import {
  ATTR_COOKIE,
  ANON_COOKIE,
  parseAttrCookie,
  type Attribution,
  type GrowthEventType,
} from "./growth-shared";

// Server-side (Node) growth logging. Imports the service-role Supabase client,
// so this must only be used from server routes — never a client component, and
// never the Edge middleware (which uses growth-shared.ts + a raw fetch instead).

/** HMAC the email so we can de-duplicate signups without ever storing PII —
 *  consistent with the anonymity-first posture of lib/analytics.ts. */
export function emailHash(email: string): string {
  const secret = process.env.JUSTCOFFEE_SESSION_SECRET || "jc-growth-fallback";
  return crypto
    .createHmac("sha256", secret)
    .update(email.trim().toLowerCase())
    .digest("hex");
}

/** Signed, un-guessable token for one-click unsubscribe links, so bots can't
 *  opt out arbitrary contacts by enumerating ids. */
export function unsubToken(contactId: string): string {
  const secret = process.env.JUSTCOFFEE_SESSION_SECRET || "jc-growth-fallback";
  return crypto
    .createHmac("sha256", secret)
    .update("unsub:" + contactId)
    .digest("hex")
    .slice(0, 32);
}

export function verifyUnsubToken(contactId: string, sig: string): boolean {
  if (!sig) return false;
  try {
    return crypto.timingSafeEqual(
      Buffer.from(unsubToken(contactId)),
      Buffer.from(sig),
    );
  } catch {
    return false;
  }
}

function readCookie(
  header: string | null | undefined,
  name: string,
): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i === -1) continue;
    if (part.slice(0, i).trim() === name)
      return decodeURIComponent(part.slice(i + 1).trim());
  }
  return undefined;
}

export function attrFromCookieHeader(
  header: string | null | undefined,
): Attribution | null {
  return parseAttrCookie(readCookie(header, ATTR_COOKIE));
}

export function anonFromCookieHeader(
  header: string | null | undefined,
): string | undefined {
  return readCookie(header, ANON_COOKIE);
}

/** Record one funnel event. Fire-and-forget: never throws, so a growth-logging
 *  failure can never break the user-facing request. */
export async function logEvent(e: {
  type: GrowthEventType;
  attr?: Attribution | null;
  anonId?: string | null;
  userId?: string | null;
  email?: string | null;
  meta?: Record<string, unknown>;
}): Promise<void> {
  try {
    if (!isSupabaseConfigured()) return;
    await supabase()
      .from("growth_events")
      .insert({
        type: e.type,
        variant: e.attr?.v ?? "",
        market: e.attr?.c ?? "",
        channel: e.attr?.ch || "unknown",
        contact_id: e.attr?.ct || null,
        anon_id: e.anonId || null,
        user_id: e.userId || null,
        email_hash: e.email ? emailHash(e.email) : null,
        meta: e.meta ?? {},
        at: Date.now(),
      });
  } catch {
    /* growth logging must never break a request */
  }
}

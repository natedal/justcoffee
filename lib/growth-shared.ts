// Growth attribution — pure, dependency-free helpers shared by the Edge
// middleware and the Node server routes. NOTHING here may import node:* or any
// package, so it is safe to bundle into the Edge runtime (middleware.ts).
//
// The attribution scheme is four short query params on any ad link:
//   ?v=<ad-variant>&c=<market>&ch=<channel>&ct=<contact-id>
// e.g.  https://justcoffee.app/?v=hour-to-kill&c=ut-austin&ch=flyer
// Standard utm_* params are accepted as a fallback so links from other tools work.

export const ATTR_COOKIE = "jc_attr"; // first/last-touch attribution (which ad)
export const ANON_COOKIE = "jc_anon"; // opaque first-party visitor id (de-dup)
export const ATTR_MAX_AGE = 60 * 60 * 24 * 30; // 30 days
export const ANON_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

export interface Attribution {
  v: string; // ad variant   — which creative
  c: string; // market       — campus / segment
  ch: string; // channel     — flyer | ig | reddit | qr | email | unknown
  ct: string; // contact id  — per-recipient (email channel only; "" otherwise)
}

export type GrowthEventType =
  | "visit"
  | "signup"
  | "activated"
  // reserved for the (deferred) email channel:
  | "sent"
  | "delivered"
  | "opened"
  | "clicked"
  | "bounced"
  | "complained"
  | "unsubscribed";

/** Normalize a raw param to a safe slug: lowercase, [a-z0-9_-], max 64 chars.
 *  Keeps junk and injection out of variant/market/channel. */
export function slug(s: string | null | undefined): string {
  if (!s) return "";
  return String(s)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

/** Read attribution from a URL's params (or any get()-like accessor). */
export function parseAttrFromParams(
  get: (key: string) => string | null,
): Attribution {
  return {
    v: slug(get("v") ?? get("utm_campaign")),
    c: slug(get("c") ?? get("utm_term")),
    ch: slug(get("ch") ?? get("utm_source")),
    ct: slug(get("ct")),
  };
}

/** True when the URL actually carries any attribution param (i.e. an ad click). */
export function hasAttrParams(get: (key: string) => string | null): boolean {
  const a = parseAttrFromParams(get);
  return Boolean(a.v || a.c || a.ch || a.ct);
}

/** Cookie value is a tilde-joined string — no JSON/percent-encoding pitfalls,
 *  since every field is a `~`-free slug. */
export function serializeAttr(a: Attribution): string {
  return [a.v, a.c, a.ch, a.ct].join("~");
}

export function parseAttrCookie(
  value: string | null | undefined,
): Attribution | null {
  if (!value) return null;
  const p = value.split("~");
  const a: Attribution = {
    v: slug(p[0]),
    c: slug(p[1]),
    ch: slug(p[2]),
    ct: slug(p[3]),
  };
  return a.v || a.c || a.ch || a.ct ? a : null;
}

/** Last-touch, field-level merge: a fresh ad click wins per-field, but a click
 *  that only sets `v` doesn't wipe a market captured on an earlier touch. */
export function mergeAttr(
  prev: Attribution | null,
  next: Attribution,
): Attribution {
  if (!prev) return next;
  return {
    v: next.v || prev.v,
    c: next.c || prev.c,
    ch: next.ch || prev.ch,
    ct: next.ct || prev.ct,
  };
}

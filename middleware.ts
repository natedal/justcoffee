import { NextResponse } from "next/server";
import type { NextRequest, NextFetchEvent } from "next/server";
import {
  ATTR_COOKIE,
  ANON_COOKIE,
  ATTR_MAX_AGE,
  ANON_MAX_AGE,
  parseAttrFromParams,
  hasAttrParams,
  serializeAttr,
  parseAttrCookie,
  mergeAttr,
  type Attribution,
} from "@/lib/growth-shared";

// First-touch (well, last-touch field-merge) ad attribution. Runs on page
// navigations only (see matcher). On a normal page load it does one cheap thing:
// ensure a first-party anon-id cookie. When the URL carries ad params — i.e. the
// visitor just clicked a tracked ad link — it also persists which ad/market
// brought them and logs a `visit`. Because that only fires when params are
// present, the write volume equals the number of ad clicks, not every request.

export const config = {
  // Skip API routes, Next internals, and any file with an extension (static).
  matcher: ["/((?!api|_next|.*\\.).*)"],
};

export function middleware(req: NextRequest, ev: NextFetchEvent) {
  const get = (k: string) => req.nextUrl.searchParams.get(k);
  const res = NextResponse.next();

  // Always ensure an opaque visitor id, so we can de-dup visits and join a later
  // signup back to the click within the same browser.
  let anon = req.cookies.get(ANON_COOKIE)?.value;
  if (!anon) {
    anon = globalThis.crypto.randomUUID();
    res.cookies.set(ANON_COOKIE, anon, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: ANON_MAX_AGE,
      path: "/",
    });
  }

  if (hasAttrParams(get)) {
    const prev = parseAttrCookie(req.cookies.get(ATTR_COOKIE)?.value);
    const merged = mergeAttr(prev, parseAttrFromParams(get));
    res.cookies.set(ATTR_COOKIE, serializeAttr(merged), {
      httpOnly: true,
      sameSite: "lax",
      maxAge: ATTR_MAX_AGE,
      path: "/",
    });
    ev.waitUntil(logVisit(merged, anon, req));
  }

  return res;
}

/** Insert the `visit` row via Supabase's REST endpoint — a single fetch, so we
 *  don't bundle the Node Supabase client into the Edge runtime. */
async function logVisit(attr: Attribution, anon: string, req: NextRequest) {
  try {
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!base || !key) return;
    await fetch(`${base}/rest/v1/growth_events`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        type: "visit",
        variant: attr.v,
        market: attr.c,
        channel: attr.ch || "unknown",
        contact_id: attr.ct || null,
        anon_id: anon,
        meta: {
          path: req.nextUrl.pathname,
          ua: req.headers.get("user-agent")?.slice(0, 180) ?? "",
        },
        at: Date.now(),
      }),
    });
  } catch {
    /* a visit-log failure must never break navigation */
  }
}

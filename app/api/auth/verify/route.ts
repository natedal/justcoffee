import { NextResponse } from "next/server";
import { consumeToken } from "@/lib/magic";
import { startSession } from "@/lib/session";
import { isProfileComplete } from "@/lib/actions";
import * as db from "@/lib/db";
import { getCity } from "@/lib/cities";
import { jitter } from "@/lib/geo";
import { identify, track } from "@/lib/analytics";
import type { User } from "@/lib/types";

const PSEUDONYMS = [
  "Alex", "Sam", "Jamie", "Riley", "Quinn", "Sky", "Rowan", "Reese",
  "Drew", "Nova", "Blue", "Ari", "Kai", "Remy", "Indigo", "Marlo",
];
const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];

// GET /api/auth/verify?token=...
// Validates a magic-link token, signs the user in (creating an auth-only stub
// the first time), and routes them to onboarding or straight to finding people.
/** The real public origin — `req.url` is the internal localhost:8080 behind
 *  Railway's proxy, so prefer the configured URL, then forwarded headers. */
function publicOrigin(req: Request, url: URL): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (configured) return configured;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  return host ? `${proto}://${host}` : url.origin;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = publicOrigin(req, url);
  const token = url.searchParams.get("token") ?? "";
  const email = consumeToken(token);

  if (!email) {
    return NextResponse.redirect(new URL("/signin?error=expired", origin));
  }

  let user = await db.getUserByEmail(email);
  const isNew = !user;
  if (!user) {
    const city = getCity("austin");
    const loc = jitter(city.lat, city.lng, 2.2);
    user = {
      id: db.id("user"),
      email,
      name: "",
      age: 18,
      pseudonym: pick(PSEUDONYMS),
      iAm: "",
      lookingTo: "",
      avatar: { hue: Math.floor(Math.random() * 6), shape: Math.floor(Math.random() * 5) },
      city: "austin",
      lat: loc.lat,
      lng: loc.lng,
      availability: "today",
      isDemo: false,
      openness: 1,
      createdAt: Date.now(),
    } satisfies User;
    await db.upsertUser(user);
  }

  await startSession(user.id);
  identify(user.id, { city: user.city });
  track(user.id, isNew ? "signed_up" : "signed_in");
  const dest = isProfileComplete(user) ? "/find" : "/onboarding";
  return NextResponse.redirect(new URL(dest, origin));
}

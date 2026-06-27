import { NextResponse } from "next/server";
import { consumeToken } from "@/lib/magic";
import { startSession } from "@/lib/session";
import { isProfileComplete } from "@/lib/actions";
import * as db from "@/lib/db";
import { getCity } from "@/lib/cities";
import { jitter } from "@/lib/geo";
import type { User } from "@/lib/types";

const PSEUDONYMS = [
  "Alex", "Sam", "Jamie", "Riley", "Quinn", "Sky", "Rowan", "Reese",
  "Drew", "Nova", "Blue", "Ari", "Kai", "Remy", "Indigo", "Marlo",
];
const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];

// GET /api/auth/verify?token=...
// Validates a magic-link token, signs the user in (creating an auth-only stub
// the first time), and routes them to onboarding or straight to finding people.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? "";
  const email = consumeToken(token);

  if (!email) {
    return NextResponse.redirect(new URL("/signin?error=expired", url));
  }

  let user = db.getUserByEmail(email);
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
    db.upsertUser(user);
  }

  await startSession(user.id);
  const dest = isProfileComplete(user) ? "/find" : "/onboarding";
  return NextResponse.redirect(new URL(dest, url));
}

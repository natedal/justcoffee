import { getSessionUserId, startSession } from "@/lib/session";
import { selfView } from "@/lib/actions";
import * as db from "@/lib/db";
import type { AvailabilityWindow, User } from "@/lib/types";
import { getCity } from "@/lib/cities";
import { jitter } from "@/lib/geo";

const PSEUDONYMS = [
  "Alex", "Sam", "Jamie", "Riley", "Quinn", "Sky", "Rowan", "Reese",
  "Drew", "Nova", "Blue", "Ari", "Kai", "Remy", "Indigo", "Marlo",
];
const AVAILABILITY: AvailabilityWindow[] = ["now", "today", "weekend"];

function clampStr(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }

  const name = clampStr(body.name, 40);
  const iAm = clampStr(body.iAm, 140);
  const lookingTo = clampStr(body.lookingTo, 140);
  const age = Number(body.age);
  const cityKey = clampStr(body.city, 30) || "austin";
  const availability = AVAILABILITY.includes(body.availability as AvailabilityWindow)
    ? (body.availability as AvailabilityWindow)
    : "today";

  if (!name) return Response.json({ error: "name is required" }, { status: 400 });
  if (!Number.isFinite(age) || age < 18)
    return Response.json({ error: "you must be 18 or older" }, { status: 400 });
  if (age > 120) return Response.json({ error: "invalid age" }, { status: 400 });
  if (!iAm) return Response.json({ error: "tell us who you are" }, { status: 400 });
  if (!lookingTo)
    return Response.json({ error: "tell us what you're looking for" }, { status: 400 });

  const city = getCity(cityKey);
  // Honor real device coordinates if provided; otherwise scatter near the city.
  const hasCoords =
    Number.isFinite(Number(body.lat)) && Number.isFinite(Number(body.lng));
  const loc = hasCoords
    ? { lat: Number(body.lat), lng: Number(body.lng) }
    : jitter(city.lat, city.lng, 2.2);

  const existingId = await getSessionUserId();
  const existing = existingId ? db.getUser(existingId) : undefined;

  const user: User = {
    id: existing?.id ?? db.id("user"),
    name,
    age: Math.round(age),
    pseudonym:
      existing?.pseudonym ??
      PSEUDONYMS[Math.floor(Math.random() * PSEUDONYMS.length)],
    iAm,
    lookingTo,
    avatar: {
      hue: Number.isFinite(Number(body.avatarHue))
        ? Math.abs(Math.round(Number(body.avatarHue))) % 6
        : (existing?.avatar.hue ?? Math.floor(Math.random() * 6)),
      shape: Number.isFinite(Number(body.avatarShape))
        ? Math.abs(Math.round(Number(body.avatarShape))) % 5
        : (existing?.avatar.shape ?? Math.floor(Math.random() * 5)),
    },
    city: cityKey,
    lat: loc.lat,
    lng: loc.lng,
    availability,
    isDemo: false,
    openness: 1,
    createdAt: existing?.createdAt ?? Date.now(),
  };

  db.upsertUser(user);
  await startSession(user.id);
  return Response.json({ user: selfView(user) });
}

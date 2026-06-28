import * as db from "./db";
import type { Candidate, CoffeeSpot, Match, User } from "./types";
import { normalizeDurationMinutes } from "./types";
import { rankCandidates, computeSignals } from "./matching";
import { enhanceRationale } from "./claude";
import { aiRankCandidates } from "./ai-scorer";
import { haversineMi, midpoint } from "./geo";
import { publish } from "./events";
import { COFFEE_SPOTS, getSpotById } from "./cities";

// ---- serialization views ------------------------------------------------

/** Has this user finished onboarding (vs. an auth-only stub)? */
export function isProfileComplete(u: User): boolean {
  return Boolean(u.name.trim() && u.iAm.trim() && u.lookingTo.trim());
}

/** The signed-in user's own profile. */
export function selfView(u: User) {
  return {
    id: u.id,
    email: u.email ?? null,
    name: u.name,
    age: u.age,
    pseudonym: u.pseudonym,
    iAm: u.iAm,
    lookingTo: u.lookingTo,
    avatar: u.avatar,
    photoUrl: u.photoUrl ?? null,
    verified: Boolean(u.verified),
    city: u.city,
    availability: u.availability,
    availabilityMinutes: u.availabilityMinutes ?? null,
    profileComplete: isProfileComplete(u),
  };
}

/** A confirmed match, from `userId`'s perspective (identities revealed). */
export async function matchView(m: Match, userId: string) {
  const otherId = m.aId === userId ? m.bId : m.aId;
  const other = await db.getUser(otherId);
  const spot = getSpotById(m.coffeeSpotId);
  const status =
    m.status === "active" && Date.now() > m.expiresAt ? "expired" : m.status;
  return {
    id: m.id,
    createdAt: m.createdAt,
    expiresAt: m.expiresAt,
    status,
    youSaidMet: m.met[userId] ?? null,
    theySaidMet: m.met[otherId] ?? null,
    spot,
    other: other
      ? {
          id: other.id,
          name: other.name,
          age: other.age,
          avatar: other.avatar,
          photoUrl: other.photoUrl ?? null, // safe to reveal: identities unlocked
          verified: Boolean(other.verified),
          iAm: other.iAm,
          lookingTo: other.lookingTo,
          city: other.city,
        }
      : null,
  };
}

/** Client-facing shapes (types only — safe to import into client components). */
export type SelfViewData = ReturnType<typeof selfView>;
export type MatchViewData = Awaited<ReturnType<typeof matchView>>;

// ---- candidate search ---------------------------------------------------

async function excludeSetFor(userId: string): Promise<Set<string>> {
  const s = await db.getSearch(userId);
  const exclude = new Set<string>([userId, ...s.passed, ...s.interested]);
  for (const b of await db.blockedPairIds(userId)) exclude.add(b);
  for (const m of await db.matchesForUser(userId)) {
    exclude.add(m.aId === userId ? m.bId : m.aId);
  }
  return exclude;
}

/** Pick (and remember) the next best candidate at the given challenge level.
 *  Availability is chosen per search and recorded on the profile so the matcher
 *  and the post-match rationale stay in sync. */
export async function nextCandidateFor(
  userId: string,
  challenge: number,
  availability?: User["availability"],
  availabilityMinutes?: number,
): Promise<Candidate | null> {
  await db.ensureSeeded();
  const viewer = await db.getUser(userId);
  if (!viewer) return null;

  let changed = false;
  if (availability && availability !== viewer.availability) {
    viewer.availability = availability;
    changed = true;
  }
  if (availability === "now" && availabilityMinutes !== undefined) {
    const mins = normalizeDurationMinutes(availabilityMinutes);
    if (viewer.availabilityMinutes !== mins) {
      viewer.availabilityMinutes = mins;
      changed = true;
    }
  }
  if (changed) await db.upsertUser(viewer);

  const search = await db.getSearch(userId);
  search.challenge = challenge;

  // Deterministic pass: applies the hard constraints (distance, exclusions) and
  // produces a sensible pre-ranking. This is both the AI shortlist and the
  // fallback when the model is disabled or unavailable.
  const everyone = await db.allUsers();
  // When demo profiles are disabled (real-user tests), never surface a bot —
  // even if some demo rows linger from an earlier run.
  const pool = db.seedDemoEnabled() ? everyone : everyone.filter((u) => !u.isDemo);
  const ranked = rankCandidates(
    viewer,
    pool,
    challenge,
    await excludeSetFor(userId),
  );

  // AI pass: let Claude actually score & rank the shortlist (and write the
  // rationale in one shot). Returns null if the model is off/unavailable.
  const AI_SHORTLIST = 12;
  const aiRanked = await aiRankCandidates(viewer, ranked.slice(0, AI_SHORTLIST), challenge);
  const finalRanked = aiRanked && aiRanked.length ? aiRanked : ranked;

  const top = finalRanked[0];
  search.currentCandidateId = top?.id;
  await db.setSearch(search);
  if (!top) return null;

  // Write the winner's "why you two" note + conversation starters with Claude
  // (no-op without a key, in which case the deterministic template stands). The
  // scorer only returns numbers, so this is the single place prose is generated.
  const cand = (await db.getUser(top.id))!;
  const ai = await enhanceRationale(
    viewer,
    cand,
    computeSignals(viewer, cand, challenge),
    challenge,
  );
  if (ai) {
    top.rationale = ai.note;
    top.conversationStarters = ai.topics;
  }
  return top;
}

// ---- mutual opt-in ------------------------------------------------------

// Deterministic, stable "does this demo person say yes back?" decision so the
// reveal flow is demonstrable with a single live user — and "keep looking"
// still means something when some say no.
function hashUnit(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}
function demoSaysYes(cand: User, viewer: User): boolean {
  return hashUnit(`${cand.id}->${viewer.id}`) < cand.openness;
}

/**
 * Suggest the closest *real*, public, curated place to the midpoint of the two
 * people. Prefers spots in their city; if neither city has any (e.g. someone is
 * outside our launch metros), falls back to the nearest spot anywhere. We never
 * invent a venue — a real place slightly farther beats a fake one next door.
 * The production upgrade is a places API (Google/Foursquare) keyed off the
 * midpoint, which returns real nearby cafes with the same `CoffeeSpot` shape.
 */
function chooseSpot(a: User, b: User): CoffeeSpot {
  const mid = midpoint(a.lat, a.lng, b.lat, b.lng);
  // Distance is the source of truth (coordinates), so scan every curated spot
  // and pick the closest to the midpoint — the `city` field can be stale for
  // users located via GPS, and a nearby real cafe is what actually matters.
  let best = COFFEE_SPOTS[0];
  let bestD = Infinity;
  for (const s of COFFEE_SPOTS) {
    const d = haversineMi(mid.lat, mid.lng, s.lat, s.lng);
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return best;
}

async function makeMatch(viewer: User, other: User, challenge: number): Promise<Match> {
  const existing = await db.existingMatchBetween(viewer.id, other.id);
  if (existing) return existing;
  const spot = chooseSpot(viewer, other);
  const now = Date.now();
  return db.createMatch({
    id: db.id("match"),
    aId: viewer.id,
    bId: other.id,
    createdAt: now,
    expiresAt: now + 24 * 60 * 60 * 1000,
    coffeeSpotId: spot.id,
    status: "active",
    met: {},
    challengeAtMatch: challenge,
  });
}

export interface MeetResult {
  matched: boolean;
  theyPassed: boolean;
  matchId?: string;
}

/** The viewer says "meet them". Returns whether it became a mutual match. */
export async function expressInterest(userId: string, candId: string): Promise<MeetResult> {
  const viewer = await db.getUser(userId);
  const cand = await db.getUser(candId);
  if (!viewer || !cand) return { matched: false, theyPassed: false };

  await db.recordInterest(userId, candId);

  let mutual: boolean;
  let theyPassed = false;
  if (cand.isDemo) {
    mutual = demoSaysYes(cand, viewer);
    if (mutual) {
      await db.recordInterest(candId, userId);
    } else {
      theyPassed = true;
      const s = await db.getSearch(userId);
      if (!s.passed.includes(candId)) s.passed.push(candId);
      s.currentCandidateId = undefined;
      await db.setSearch(s);
    }
  } else {
    mutual = await db.hasInterest(candId, userId);
  }

  if (mutual) {
    const challenge = (await db.getSearch(userId)).challenge;
    const m = await makeMatch(viewer, cand, challenge);
    const s = await db.getSearch(userId);
    s.currentCandidateId = undefined;
    await db.setSearch(s);
    // Let the other person know in real time (the actor sees the reveal now).
    publish(cand.id, {
      type: "match",
      matchId: m.id,
      withName: viewer.name,
      at: Date.now(),
    });
    return { matched: true, theyPassed: false, matchId: m.id };
  }
  return { matched: false, theyPassed };
}

/** The viewer skips this candidate — they won't be shown again. */
export async function passCandidate(userId: string, candId: string): Promise<void> {
  const s = await db.getSearch(userId);
  if (!s.passed.includes(candId)) s.passed.push(candId);
  if (s.currentCandidateId === candId) s.currentCandidateId = undefined;
  await db.setSearch(s);
}

// ---- safety -------------------------------------------------------------

export async function blockUser(userId: string, targetId: string): Promise<void> {
  await db.addBlock({ fromId: userId, targetId, at: Date.now() });
  const m = await db.existingMatchBetween(userId, targetId);
  if (m) {
    m.status = "closed";
    await db.updateMatch(m);
  }
}

export async function reportUser(
  userId: string,
  targetId: string,
  reason: string,
  context: string,
): Promise<void> {
  await db.addReport({
    id: db.id("report"),
    fromId: userId,
    targetId,
    reason,
    context,
    at: Date.now(),
  });
  await blockUser(userId, targetId); // reporting also blocks, like a dating app
}

// ---- share plans --------------------------------------------------------

export async function sharePlans(userId: string, matchId: string): Promise<string | null> {
  const m = await db.getMatch(matchId);
  if (!m || (m.aId !== userId && m.bId !== userId)) return null;
  const otherId = m.aId === userId ? m.bId : m.aId;
  const other = await db.getUser(otherId);
  const spot = getSpotById(m.coffeeSpotId);
  if (!other || !spot) return null;
  const when = new Date(m.expiresAt).toLocaleString("en-US", {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
  return (
    `justcoffee plan: I'm meeting ${other.name} (someone I matched with) ` +
    `at ${spot.name} — a public ${spot.kind}. ` +
    `If you don't hear from me by ${when}, check in on me.`
  );
}

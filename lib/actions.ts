import * as db from "./db";
import type { Candidate, CoffeeSpot, Match, User } from "./types";
import { rankCandidates, computeSignals } from "./matching";
import { enhanceRationale } from "./claude";
import { haversineMi, midpoint } from "./geo";

// ---- serialization views ------------------------------------------------

/** The signed-in user's own profile. */
export function selfView(u: User) {
  return {
    id: u.id,
    name: u.name,
    age: u.age,
    pseudonym: u.pseudonym,
    iAm: u.iAm,
    lookingTo: u.lookingTo,
    avatar: u.avatar,
    city: u.city,
    availability: u.availability,
  };
}

/** A confirmed match, from `userId`'s perspective (identities revealed). */
export function matchView(m: Match, userId: string) {
  const otherId = m.aId === userId ? m.bId : m.aId;
  const other = db.getUser(otherId);
  const spot = db.getSpot(m.coffeeSpotId);
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
          iAm: other.iAm,
          lookingTo: other.lookingTo,
          city: other.city,
        }
      : null,
  };
}

/** Client-facing shapes (types only — safe to import into client components). */
export type SelfViewData = ReturnType<typeof selfView>;
export type MatchViewData = ReturnType<typeof matchView>;

// ---- candidate search ---------------------------------------------------

function excludeSetFor(userId: string): Set<string> {
  const s = db.getSearch(userId);
  const exclude = new Set<string>([userId, ...s.passed, ...s.interested]);
  for (const b of db.blockedPairIds(userId)) exclude.add(b);
  for (const m of db.matchesForUser(userId)) {
    exclude.add(m.aId === userId ? m.bId : m.aId);
  }
  return exclude;
}

/** Pick (and remember) the next best candidate at the given challenge level. */
export async function nextCandidateFor(
  userId: string,
  challenge: number,
): Promise<Candidate | null> {
  const viewer = db.getUser(userId);
  if (!viewer) return null;

  const search = db.getSearch(userId);
  search.challenge = challenge;
  const ranked = rankCandidates(
    viewer,
    db.allUsers(),
    challenge,
    excludeSetFor(userId),
  );
  const top = ranked[0];
  search.currentCandidateId = top?.id;
  db.setSearch(search);
  if (!top) return null;

  // Optional: let Claude rewrite the rationale in justcoffee's voice.
  const cand = db.getUser(top.id)!;
  const ai = await enhanceRationale(
    viewer,
    cand,
    computeSignals(viewer, cand, challenge),
    challenge,
  );
  if (ai) top.rationale = ai;
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

function nearestSpot(a: User, b: User): CoffeeSpot {
  const mid = midpoint(a.lat, a.lng, b.lat, b.lng);
  const pool = db.spotsInCity(a.city);
  const candidates = pool.length ? pool : db.spotsInCity(b.city);
  let best = candidates[0];
  let bestD = Infinity;
  for (const s of candidates) {
    const d = haversineMi(mid.lat, mid.lng, s.lat, s.lng);
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return best;
}

function makeMatch(viewer: User, other: User, challenge: number): Match {
  const existing = db.existingMatchBetween(viewer.id, other.id);
  if (existing) return existing;
  const spot = nearestSpot(viewer, other);
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
export function expressInterest(userId: string, candId: string): MeetResult {
  const viewer = db.getUser(userId);
  const cand = db.getUser(candId);
  if (!viewer || !cand) return { matched: false, theyPassed: false };

  db.recordInterest(userId, candId);

  let mutual: boolean;
  let theyPassed = false;
  if (cand.isDemo) {
    mutual = demoSaysYes(cand, viewer);
    if (mutual) {
      db.recordInterest(candId, userId);
    } else {
      theyPassed = true;
      const s = db.getSearch(userId);
      if (!s.passed.includes(candId)) s.passed.push(candId);
      s.currentCandidateId = undefined;
      db.setSearch(s);
    }
  } else {
    mutual = db.hasInterest(candId, userId);
  }

  if (mutual) {
    const challenge = db.getSearch(userId).challenge;
    const m = makeMatch(viewer, cand, challenge);
    const s = db.getSearch(userId);
    s.currentCandidateId = undefined;
    db.setSearch(s);
    return { matched: true, theyPassed: false, matchId: m.id };
  }
  return { matched: false, theyPassed };
}

/** The viewer skips this candidate — they won't be shown again. */
export function passCandidate(userId: string, candId: string): void {
  const s = db.getSearch(userId);
  if (!s.passed.includes(candId)) s.passed.push(candId);
  if (s.currentCandidateId === candId) s.currentCandidateId = undefined;
  db.setSearch(s);
}

// ---- safety -------------------------------------------------------------

export function blockUser(userId: string, targetId: string): void {
  db.addBlock({ fromId: userId, targetId, at: Date.now() });
  const m = db.existingMatchBetween(userId, targetId);
  if (m) {
    m.status = "closed";
    db.updateMatch(m);
  }
}

export function reportUser(
  userId: string,
  targetId: string,
  reason: string,
  context: string,
): void {
  db.addReport({
    id: db.id("report"),
    fromId: userId,
    targetId,
    reason,
    context,
    at: Date.now(),
  });
  blockUser(userId, targetId); // reporting also blocks, like a dating app
}

// ---- share plans --------------------------------------------------------

export function sharePlans(userId: string, matchId: string): string | null {
  const m = db.getMatch(matchId);
  if (!m || (m.aId !== userId && m.bId !== userId)) return null;
  const otherId = m.aId === userId ? m.bId : m.aId;
  const other = db.getUser(otherId);
  const spot = db.getSpot(m.coffeeSpotId);
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

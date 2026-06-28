// Core domain types for justcoffee.
// Designed so the file-backed store can be swapped for Postgres/Supabase later
// without changing call sites.

export type AvailabilityWindow = "now" | "today" | "weekend";

export const AVAILABILITY_DURATIONS = [30, 60, 120] as const;
export type AvailabilityDuration = (typeof AVAILABILITY_DURATIONS)[number];
export const DEFAULT_AVAILABILITY_MINUTES: AvailabilityDuration = 60;

export const DURATION_LABELS: Record<AvailabilityDuration, string> = {
  30: "30 min",
  60: "1 hr",
  120: "2 hrs",
};

export const AVAILABILITY_LABELS: Record<AvailabilityWindow, string> = {
  now: "free right now",
  today: "free later today",
  weekend: "free this weekend",
};

export const AVAILABILITY_SHORT: Record<AvailabilityWindow, string> = {
  now: "right now",
  today: "today",
  weekend: "this weekend",
};

/** Short labels for the when-picker on the find page. */
export const AVAILABILITY_PICKER: Record<AvailabilityWindow, string> = {
  now: "right now",
  today: "today",
  weekend: "this weekend",
};

export function normalizeDurationMinutes(m: unknown): AvailabilityDuration {
  const n = Number(m);
  if (n === 30 || n === 60 || n === 120) return n;
  return DEFAULT_AVAILABILITY_MINUTES;
}

export function formatAvailabilityShort(
  window: AvailabilityWindow,
  minutes?: number,
): string {
  if (window === "now") {
    const m = normalizeDurationMinutes(minutes);
    return `${AVAILABILITY_SHORT.now} · ${DURATION_LABELS[m]}`;
  }
  return AVAILABILITY_SHORT[window];
}

export function formatAvailabilityLabel(
  window: AvailabilityWindow,
  minutes?: number,
): string {
  if (window === "now") {
    const m = normalizeDurationMinutes(minutes);
    return `free right now for ${DURATION_LABELS[m]}`;
  }
  return AVAILABILITY_LABELS[window];
}

export interface Avatar {
  // Deterministic, brand-colored geometric avatar. No external image hosting for MVP.
  hue: number; // index into a brand color ramp
  shape: number; // shape seed
}

export interface User {
  id: string;
  // Verified contact — used for magic-link sign-in. Never shown to other users.
  email?: string;
  // Real identity — revealed ONLY after a mutual match.
  name: string;
  age: number;
  // What strangers see before the reveal.
  pseudonym: string;
  iAm: string; // "I'm a ___"
  lookingTo: string; // "I'm looking to ___"
  avatar: Avatar;
  // Optional real photo (revealed ONLY after a mutual match, blurred before).
  photoUrl?: string;
  verified?: boolean; // completed the lightweight photo-verification step
  // Location
  city: string; // city key (see lib/cities)
  lat: number;
  lng: number;
  availability: AvailabilityWindow;
  /** How long the user is free when availability is "now". */
  availabilityMinutes?: AvailabilityDuration;
  // System
  isDemo: boolean;
  openness: number; // 0..1 — for demo users, how readily they say "yes" back
  createdAt: number;
}

/** Public, pre-reveal view of a candidate. No name, no crisp photo. */
export interface Candidate {
  id: string;
  pseudonym: string;
  age: number;
  iAm: string;
  lookingTo: string;
  avatar: Avatar;
  availability: AvailabilityWindow;
  availabilityMinutes?: AvailabilityDuration;
  distanceMi: number;
  challengeFit: number; // 0..1 how well this candidate matches the requested challenge dial
  score: number; // overall ranking score (debug / internal)
  rationale: string; // "why you two"
  sharedTopics: string[];
  conversationStarters: string[]; // 3-5 things they could actually talk about
  intentNote: string; // short complementarity note
}

export interface SearchState {
  userId: string;
  challenge: number; // 0 = someone like me, 1 = someone I'd never normally meet
  passed: string[]; // candidate ids the user has skipped
  interested: string[]; // candidate ids the user has said "meet" to (pending mutual)
  currentCandidateId?: string;
  updatedAt: number;
}

export interface Interest {
  fromId: string;
  toId: string;
  at: number;
}

export type MatchStatus = "active" | "expired" | "closed";

export interface Match {
  id: string;
  aId: string;
  bId: string;
  createdAt: number;
  expiresAt: number; // matches expire if logistics aren't coordinated
  coffeeSpotId: string;
  status: MatchStatus;
  // post-coffee "did you meet?" prompt, keyed by user id
  met: Record<string, "yes" | "no">;
  challengeAtMatch: number;
}

export interface Message {
  id: string;
  matchId: string;
  fromId: string;
  body: string;
  at: number;
}

export interface Report {
  id: string;
  fromId: string;
  targetId: string;
  reason: string;
  context: string;
  at: number;
}

export interface Block {
  fromId: string;
  targetId: string;
  at: number;
}

export type CoffeeSpotKind = "cafe" | "library" | "public";

export interface CoffeeSpot {
  id: string;
  name: string;
  kind: CoffeeSpotKind;
  city: string;
  lat: number;
  lng: number;
  blurb: string;
}

export interface DBShape {
  users: Record<string, User>;
  searches: Record<string, SearchState>;
  interests: Interest[];
  matches: Record<string, Match>;
  messages: Message[];
  reports: Report[];
  blocks: Block[];
  spots: CoffeeSpot[];
  seeded: boolean;
}

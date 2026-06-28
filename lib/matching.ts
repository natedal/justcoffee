import type { AvailabilityWindow, Candidate, User } from "./types";
import {
  DEFAULT_AVAILABILITY_MINUTES,
  formatAvailabilityLabel,
  formatAvailabilityShort,
} from "./types";
import { haversineMi, formatDistance } from "./geo";
import {
  detectIntent,
  detectTopics,
  intentCompatibility,
  tokenSimilarity,
  topicOverlap,
  TOPIC_LABEL,
  type Intent,
} from "./text";

const HARD_RADIUS_MI = 30; // keeps matches within the same metro
const clamp = (x: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, x));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const AVAIL_COMPAT: Record<AvailabilityWindow, Record<AvailabilityWindow, number>> = {
  now: { now: 1, today: 0.75, weekend: 0.3 },
  today: { now: 0.75, today: 1, weekend: 0.4 },
  weekend: { now: 0.3, today: 0.4, weekend: 1 },
};

function durationCompat(a: number, b: number): number {
  const overlap = Math.min(a, b);
  const max = Math.max(a, b);
  return max > 0 ? overlap / max : 1;
}

export interface MatchSignals {
  distanceMi: number;
  availability: number;
  background: number; // similarity of "I'm a ___"
  intentCompat: number;
  topicScore: number;
  sharedTopics: string[]; // topic keys
  challengeFit: number;
  viewerIntent: Intent;
  candIntent: Intent;
}

export function computeSignals(
  viewer: User,
  cand: User,
  challenge: number,
): MatchSignals {
  const distanceMi = haversineMi(viewer.lat, viewer.lng, cand.lat, cand.lng);
  let availability = AVAIL_COMPAT[viewer.availability][cand.availability];
  if (viewer.availability === "now" && cand.availability === "now") {
    const vMins = viewer.availabilityMinutes ?? DEFAULT_AVAILABILITY_MINUTES;
    const cMins = cand.availabilityMinutes ?? DEFAULT_AVAILABILITY_MINUTES;
    availability *= durationCompat(vMins, cMins);
  }

  const vTopics = detectTopics(`${viewer.iAm} ${viewer.lookingTo}`);
  const cTopics = detectTopics(`${cand.iAm} ${cand.lookingTo}`);
  const shared = topicOverlap(vTopics, cTopics);
  const topicScore =
    vTopics.length && cTopics.length
      ? shared.length / Math.sqrt(vTopics.length * cTopics.length)
      : 0;

  const background = tokenSimilarity(viewer.iAm, cand.iAm);

  const viewerIntent = detectIntent(viewer.lookingTo);
  const candIntent = detectIntent(cand.lookingTo);
  const intentCompat = intentCompatibility(viewerIntent, candIntent);

  // The dial: low challenge rewards similar backgrounds; high challenge rewards
  // *different* backgrounds that still share a topic (the safety valve so a
  // "surprise me" match never feels random).
  const simFit = background;
  const diffFit = (1 - background) * (0.5 + 0.5 * topicScore);
  const challengeFit = clamp(lerp(simFit, diffFit, challenge));

  return {
    distanceMi,
    availability,
    background,
    intentCompat,
    topicScore,
    sharedTopics: shared,
    challengeFit,
    viewerIntent,
    candIntent,
  };
}

function score(s: MatchSignals): number {
  const distanceScore = clamp(1 - s.distanceMi / 8);
  return (
    0.4 * s.challengeFit +
    0.22 * s.intentCompat +
    0.18 * s.availability +
    0.12 * distanceScore +
    0.08 * s.topicScore
  );
}

function intentPhrase(intent: Intent, who: "you" | "they", name: string): string {
  const t = who === "you";
  switch (intent) {
    case "debate":
      return t ? "you want a real argument" : `${name} wants a real argument`;
    case "learn":
      return t
        ? "you want to understand a different view"
        : `${name} wants to understand where you're coming from`;
    case "teach":
      return t ? "you want to share your perspective" : `${name} wants to share theirs`;
    case "vent":
      return t
        ? "you need to get something off your chest"
        : `${name} needs to get something off their chest`;
    case "listen":
      return t ? "you're happy to just listen" : `${name} is here to listen`;
    case "advice":
      return t ? "you're after some guidance" : `${name} is after some guidance`;
    case "befriend":
      return t ? "you're looking for a new friend" : `${name} is looking for a new friend`;
    default:
      return t ? "you're open to wherever it goes" : `${name} is open to wherever it goes`;
  }
}

function buildRationale(
  cand: User,
  s: MatchSignals,
  challenge: number,
): { rationale: string; intentNote: string; sharedLabels: string[] } {
  const name = cand.pseudonym;
  const sharedLabels = s.sharedTopics.map((t) => TOPIC_LABEL[t] ?? t).slice(0, 2);

  // Sentence 1 — logistics + common thread.
  const sameWindow = s.availability >= 0.99;
  const logistics = sameWindow
    ? `You're both ${formatAvailabilityLabel(
        cand.availability,
        cand.availability === "now" ? cand.availabilityMinutes : undefined,
      )}, ${formatDistance(s.distanceMi)}.`
    : `${name} is ${formatAvailabilityShort(
        cand.availability,
        cand.availability === "now" ? cand.availabilityMinutes : undefined,
      )}, ${formatDistance(s.distanceMi)}.`;

  // Sentence 2 — intent complementarity.
  const intent = `${cap(intentPhrase(s.viewerIntent, "you", name))}; ${intentPhrase(
    s.candIntent,
    "they",
    name,
  )}.`;

  // Sentence 3 — the challenge framing.
  let closer: string;
  if (challenge > 0.66) {
    closer = sharedLabels.length
      ? `Different worlds — but you both keep circling back to ${sharedLabels[0]}.`
      : `Not someone you'd normally cross paths with — that's the point.`;
  } else if (challenge < 0.34) {
    closer = sharedLabels.length
      ? `Same wavelength on ${sharedLabels.join(" and ")}. This should feel easy.`
      : `You're cut from similar cloth — this should feel easy.`;
  } else {
    closer = sharedLabels.length
      ? `Enough in common (${sharedLabels[0]}) to click, enough difference to keep it interesting.`
      : `Close enough to click, different enough to keep it interesting.`;
  }

  const intentNote = `${cap(intentPhrase(s.viewerIntent, "you", name))} · ${intentPhrase(
    s.candIntent,
    "they",
    name,
  )}`;

  return {
    rationale: `${logistics} ${intent} ${closer}`,
    intentNote,
    sharedLabels,
  };
}

export function toCandidate(
  viewer: User,
  cand: User,
  challenge: number,
): Candidate {
  const s = computeSignals(viewer, cand, challenge);
  const { rationale, intentNote, sharedLabels } = buildRationale(cand, s, challenge);
  return {
    id: cand.id,
    pseudonym: cand.pseudonym,
    age: cand.age,
    iAm: cand.iAm,
    lookingTo: cand.lookingTo,
    avatar: cand.avatar,
    availability: cand.availability,
    availabilityMinutes:
      cand.availability === "now" ? cand.availabilityMinutes : undefined,
    distanceMi: Math.round(s.distanceMi * 10) / 10,
    challengeFit: Math.round(s.challengeFit * 100) / 100,
    score: Math.round(score(s) * 1000) / 1000,
    rationale,
    sharedTopics: sharedLabels,
    conversationStarters: [], // filled by the AI layer (lib/claude) for the chosen candidate
    intentNote,
  };
}

/**
 * Rank everyone eligible for `viewer` at the given challenge level.
 * `exclude` covers self, passed, already-matched, and blocked ids.
 */
export function rankCandidates(
  viewer: User,
  pool: User[],
  challenge: number,
  exclude: Set<string>,
): Candidate[] {
  return pool
    .filter((u) => u.id !== viewer.id && !exclude.has(u.id))
    .map((u) => ({ u, mi: haversineMi(viewer.lat, viewer.lng, u.lat, u.lng) }))
    .filter((x) => x.mi <= HARD_RADIUS_MI)
    .map((x) => toCandidate(viewer, x.u, challenge))
    .sort((a, b) => b.score - a.score);
}

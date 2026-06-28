// Server-side product analytics. A thin wrapper over PostHog that is a complete
// no-op when `POSTHOG_API_KEY` is unset — exactly like the optional Claude layer
// in lib/claude.ts. Every call site depends only on `track`/`identify`, so the
// backend (PostHog Cloud today) is a single-module swap, and the same event
// names carry over to the eventual React Native app.
//
// PRIVACY: this product is anonymity-first (no names before the reveal, 18+,
// safety-sensitive). We therefore only ever send *structural* properties —
// never emails, names, the two free-text sentences, message bodies, or precise
// coordinates. The distinctId is the stable, opaque `user_xxx` id, which is not
// itself PII.

import { PostHog } from "posthog-node";

/** The core-loop funnel. Keep this list as the single source of truth so the
 *  web app and the native app emit identical events. */
export type AnalyticsEvent =
  | "signed_up"
  | "signed_in"
  | "onboarding_completed"
  | "profile_updated"
  | "search_started"
  | "candidate_passed"
  | "interest_sent"
  | "mutual_match"
  | "message_sent"
  | "marked_met"
  | "user_reported"
  | "user_blocked";

type Props = Record<string, string | number | boolean | null | undefined>;

const g = globalThis as unknown as { __jc_posthog?: PostHog | null };

/** Lazily build (and cache) the client. Returns null when analytics is off. */
function client(): PostHog | null {
  if (g.__jc_posthog !== undefined) return g.__jc_posthog;
  const key = process.env.POSTHOG_API_KEY;
  if (!key) {
    g.__jc_posthog = null; // analytics disabled — the app is identical without it
    return null;
  }
  g.__jc_posthog = new PostHog(key, {
    host: process.env.POSTHOG_HOST || "https://us.i.posthog.com",
    // Serverless-friendly: flush each event promptly rather than batching across
    // invocations that may be frozen before a timer fires.
    flushAt: 1,
    flushInterval: 0,
  });
  return g.__jc_posthog;
}

/** Record a funnel event for a user. Fire-and-forget; never throws. */
export function track(distinctId: string, event: AnalyticsEvent, properties: Props = {}): void {
  const ph = client();
  if (!ph) return;
  try {
    ph.capture({ distinctId, event, properties });
  } catch {
    /* analytics must never break a request */
  }
}

/** Attach durable, non-PII traits to a user (e.g. their launch city). */
export function identify(distinctId: string, properties: Props = {}): void {
  const ph = client();
  if (!ph) return;
  try {
    ph.identify({ distinctId, properties });
  } catch {
    /* noop */
  }
}

/** Bucket the 0..1 challenge dial so the funnel reads cleanly without leaking
 *  the exact slider value. */
export function challengeBucket(challenge: number): "low" | "medium" | "high" {
  if (challenge < 0.34) return "low";
  if (challenge < 0.67) return "medium";
  return "high";
}

/** True when analytics is configured. Handy for health checks / debugging. */
export function analyticsEnabled(): boolean {
  return Boolean(process.env.POSTHOG_API_KEY);
}

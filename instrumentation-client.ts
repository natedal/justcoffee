// Sentry — browser. Disabled unless NEXT_PUBLIC_SENTRY_DSN is set. Session replay
// is intentionally left out here: this app shows private conversations and the
// two free-text sentences, which we don't want recorded.
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  tracesSampleRate: 0.1,
  sendDefaultPii: false,
  environment: process.env.NODE_ENV,
});

// Instruments App Router client-side navigations.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

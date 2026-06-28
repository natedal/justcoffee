// Sentry — server (Node runtime). Disabled unless SENTRY_DSN is set, so dev and
// local builds are unaffected.
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  // Capture a sample of transactions for performance; tune down if volume grows.
  tracesSampleRate: 0.1,
  // Don't send the magic-link token or other query strings to Sentry.
  sendDefaultPii: false,
  environment: process.env.NODE_ENV,
});

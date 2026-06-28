import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};

// Sentry's build plugin. Source-map upload only happens when SENTRY_AUTH_TOKEN
// (+ org/project) are present, so local/CI builds without them are unaffected.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  disableLogger: true,
  // Route browser error/replay requests through your own domain to dodge ad
  // blockers. Safe to leave on.
  tunnelRoute: "/monitoring",
});

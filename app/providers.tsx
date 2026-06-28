"use client";

// Client-side product analytics (pageviews + autocapture + identify).
// Entirely inert unless `NEXT_PUBLIC_POSTHOG_KEY` is set, so the app is byte-for-
// byte identical in local/dev. Privacy-first defaults for an anonymity-focused,
// safety-sensitive product:
//   - session recording is OFF (chat + the two sentences must never be captured),
//   - all inputs are masked if recording is ever turned on,
//   - the person is identified by their opaque `user_xxx` id, never their email.

import { Suspense, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

if (typeof window !== "undefined" && KEY && !posthog.__loaded) {
  posthog.init(KEY, {
    api_host: HOST,
    capture_pageview: false, // captured manually below for the App Router
    capture_pageleave: true,
    autocapture: true,
    disable_session_recording: true,
    mask_all_text: false,
    mask_all_element_attributes: false,
    persistence: "localStorage+cookie",
  });
}

/** Manual pageview capture — the App Router doesn't fire a navigation the SDK
 *  can see, so we watch the path/query ourselves. */
function PageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!KEY) return;
    let url = window.origin + pathname;
    const qs = searchParams?.toString();
    if (qs) url += `?${qs}`;
    posthog.capture("$pageview", { $current_url: url });
  }, [pathname, searchParams]);

  return null;
}

/** Tie the anonymous browser session to the same id the server uses, so web and
 *  server events land on one person. */
function Identify() {
  useEffect(() => {
    if (!KEY) return;
    let cancelled = false;
    fetch("/api/session")
      .then((r) => r.json())
      .then((data) => {
        const id: string | undefined = data?.user?.id;
        if (!cancelled && id) {
          posthog.identify(id, { city: data.user.city });
        } else if (!cancelled && !id) {
          posthog.reset(); // signed out — go back to anonymous
        }
      })
      .catch(() => {
        /* analytics must never break the app */
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  if (!KEY) return <>{children}</>;
  return (
    <PHProvider client={posthog}>
      <Suspense fallback={null}>
        <PageView />
      </Suspense>
      <Identify />
      {children}
    </PHProvider>
  );
}

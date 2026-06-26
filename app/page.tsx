"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Logo, Wordmark } from "@/components/Logo";
import { jget } from "@/components/api";

export default function Landing() {
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  useEffect(() => {
    jget<{ user: unknown }>("/api/session").then((d) => setHasSession(!!d.user));
  }, []);

  return (
    <main className="frame items-center justify-center py-12 text-center">
      <div className="flex flex-1 flex-col items-center justify-center">
        <Logo size={108} />

        <p className="serif mt-8 text-lg text-espresso/70">have an hour to kill?</p>
        <h1 className="mt-2 text-5xl font-bold leading-[1.05] tracking-tight">
          meet a stranger
          <br />
          for coffee.
        </h1>
        <p className="mt-6 max-w-xs text-pretty text-ink/65">
          Tell us who you are and what you want to talk about. We pair you with
          someone nearby who&apos;s up for the same conversation.
        </p>

        <div className="mt-10 w-full max-w-xs">
          {hasSession === null ? (
            <div className="btn-primary w-full opacity-60">…</div>
          ) : hasSession ? (
            <Link href="/find" className="btn-primary w-full">
              find someone
            </Link>
          ) : (
            <Link href="/onboarding" className="btn-primary w-full">
              get started
            </Link>
          )}
          {hasSession && (
            <Link
              href="/matches"
              className="mt-3 block text-sm font-semibold text-teal hover:underline"
            >
              your matches
            </Link>
          )}
        </div>

        <p className="serif mt-10 text-sm text-espresso/55">
          no profiles to swipe. no &ldquo;hey&rdquo; into the void.
          <br />
          just talk. just coffee.
        </p>
      </div>

      <footer className="pb-6 pt-10">
        <Wordmark className="text-lg" />
      </footer>
    </main>
  );
}

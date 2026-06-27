"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Logo, Wordmark } from "@/components/Logo";
import { jpost } from "@/components/api";

function SignInInner() {
  const params = useSearchParams();
  const expired = params.get("error") === "expired";

  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState<{ delivered: boolean; link?: string } | null>(
    null,
  );

  async function requestLink() {
    setError("");
    setBusy(true);
    const res = await jpost<{
      ok?: boolean;
      delivered?: boolean;
      link?: string;
      error?: string;
    }>("/api/auth/request", { email });
    setBusy(false);
    if (res.ok) setSent({ delivered: Boolean(res.delivered), link: res.link });
    else setError(res.error ?? "something went wrong");
  }

  return (
    <main className="frame items-center justify-center py-12 text-center">
      <div className="flex flex-1 flex-col items-center justify-center">
        <Logo size={84} />
        <h1 className="mt-7 text-3xl font-bold tracking-tight">
          sign in to justcoffee
        </h1>
        <p className="serif mt-2 max-w-xs text-espresso/65">
          we&apos;ll email you a one-tap magic link — no passwords, ever.
        </p>

        {expired && !sent && (
          <p className="mt-5 w-full max-w-xs rounded-xl bg-terracotta/10 px-4 py-3 text-sm text-terracotta">
            that link expired. enter your email for a fresh one.
          </p>
        )}

        {!sent ? (
          <div className="mt-8 w-full max-w-xs space-y-3">
            <input
              className="field text-center"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && email && requestLink()}
              placeholder="you@example.com"
            />
            {error && <p className="text-sm text-terracotta">{error}</p>}
            <button
              className="btn-primary w-full"
              onClick={requestLink}
              disabled={busy || !email}
            >
              {busy ? "sending…" : "send me a link"}
            </button>
          </div>
        ) : (
          <div className="mt-8 w-full max-w-xs animate-fade-up space-y-4">
            <div className="card p-5">
              <p className="text-sm font-semibold">check your email ✉️</p>
              <p className="serif mt-1 text-sm text-espresso/65">
                we sent a magic link to <span className="font-semibold">{email}</span>.
                tap it to finish signing in.
              </p>
            </div>
            {/* No email provider in this build — surface the link directly. */}
            {sent.link && (
              <div className="rounded-2xl border border-dashed border-teal/40 bg-teal/[0.06] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-teal">
                  demo mode — no inbox needed
                </p>
                <a href={sent.link} className="btn-primary mt-3 w-full">
                  open your magic link
                </a>
              </div>
            )}
            <button
              className="text-sm font-semibold text-ink/50 hover:text-ink"
              onClick={() => setSent(null)}
            >
              use a different email
            </button>
          </div>
        )}
      </div>

      <footer className="pb-6 pt-10">
        <Link href="/">
          <Wordmark className="text-lg" />
        </Link>
      </footer>
    </main>
  );
}

export default function SignIn() {
  return (
    <Suspense
      fallback={
        <main className="frame items-center justify-center">
          <Logo size={64} />
        </main>
      }
    >
      <SignInInner />
    </Suspense>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Logo, Wordmark } from "@/components/Logo";
import { Avatar } from "@/components/Avatar";
import { MatchCard } from "@/components/MatchCard";
import { ChallengeSlider } from "@/components/ChallengeSlider";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { jget, jpost } from "@/components/api";
import type { Candidate, AvailabilityWindow, AvailabilityDuration } from "@/lib/types";
import {
  AVAILABILITY_DURATIONS,
  AVAILABILITY_PICKER,
  DEFAULT_AVAILABILITY_MINUTES,
  DURATION_LABELS,
} from "@/lib/types";
import type { SelfViewData, MatchViewData } from "@/lib/actions";

type Step = "idle" | "searching" | "card" | "empty" | "matched";

const AVAIL: AvailabilityWindow[] = ["now", "today", "weekend"];

export default function Find() {
  const router = useRouter();
  const [me, setMe] = useState<SelfViewData | null>(null);
  const [aiOn, setAiOn] = useState(false);
  const [challenge, setChallenge] = useState(0.5);
  const [availability, setAvailability] = useState<AvailabilityWindow>("now");
  const [availabilityMinutes, setAvailabilityMinutes] = useState<AvailabilityDuration>(
    DEFAULT_AVAILABILITY_MINUTES,
  );
  const [step, setStep] = useState<Step>("idle");
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [match, setMatch] = useState<MatchViewData | null>(null);
  const [toast, setToast] = useState("");
  const [reporting, setReporting] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    jget<{ user: SelfViewData | null; aiEnabled: boolean }>("/api/session").then((d) => {
      if (!d.user) router.replace("/signin");
      else if (!d.user.profileComplete) router.replace("/onboarding");
      else {
        setMe(d.user);
        setAvailability(d.user.availability);
        if (d.user.availabilityMinutes) {
          setAvailabilityMinutes(d.user.availabilityMinutes);
        }
        setAiOn(d.aiEnabled);
      }
    });
  }, [router]);

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 2600);
  }

  async function find() {
    setStep("searching");
    setCandidate(null);
    const d = await jpost<{ candidate: Candidate | null }>("/api/search", {
      challenge,
      availability,
      ...(availability === "now" ? { availabilityMinutes } : {}),
    });
    if (d.candidate) {
      setCandidate(d.candidate);
      setStep("card");
    } else {
      setStep("empty");
    }
  }

  async function pass() {
    if (!candidate) return;
    await jpost("/api/search/pass", { candidateId: candidate.id });
    find();
  }

  async function meet() {
    if (!candidate) return;
    setBusy(true);
    const d = await jpost<{ matched: boolean; theyPassed?: boolean; match?: MatchViewData }>(
      "/api/search/meet",
      { candidateId: candidate.id },
    );
    setBusy(false);
    if (d.matched && d.match) {
      setMatch(d.match);
      setStep("matched");
    } else {
      flash(
        d.theyPassed
          ? "not this time — they passed. plenty more people."
          : "you said yes. if they say yes back, you'll match.",
      );
      find();
    }
  }

  async function confirmReport(action: "report" | "block") {
    if (!candidate) return;
    setReporting(false);
    await jpost("/api/safety", { targetId: candidate.id, action });
    flash(action === "report" ? "reported and blocked." : "blocked.");
    find();
  }

  if (!me) {
    return (
      <main className="frame items-center justify-center">
        <Logo size={64} />
      </main>
    );
  }

  return (
    <main className="frame py-6">
      <header className="flex items-center justify-between">
        <Link href="/">
          <Wordmark className="text-xl" />
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/matches" className="text-sm font-semibold text-teal hover:underline">
            matches
          </Link>
          <Link href="/onboarding" aria-label="edit your card" title="edit your card">
            <Avatar avatar={me.avatar} photoUrl={me.photoUrl} size={34} revealed />
          </Link>
        </div>
      </header>

      {/* ---------- IDLE: pick challenge + search ---------- */}
      {step === "idle" && (
        <div className="flex flex-1 animate-fade-in flex-col">
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <Logo size={92} />
            <h1 className="mt-6 text-3xl font-bold tracking-tight">
              who do you want
              <br />
              to meet today?
            </h1>
            <p className="serif mt-2 text-espresso/65">
              set when &amp; the dial, then we&apos;ll find someone nearby.
            </p>
          </div>
          <div className="space-y-4 pb-2">
            <div className="card p-5">
              <span className="text-sm font-semibold text-ink/70">when are you free?</span>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {AVAIL.map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setAvailability(a)}
                    className={`rounded-2xl border px-2 py-3 text-sm font-semibold transition ${
                      availability === a
                        ? "border-teal bg-teal text-paper"
                        : "border-tan/60 bg-white/50 text-ink/70 hover:bg-tan/15"
                    }`}
                  >
                    {AVAILABILITY_PICKER[a]}
                  </button>
                ))}
              </div>
              {availability === "now" && (
                <div className="mt-4">
                  <span className="text-sm font-semibold text-ink/70">
                    how long do you have?
                  </span>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {AVAILABILITY_DURATIONS.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setAvailabilityMinutes(m)}
                        className={`rounded-2xl border px-2 py-2.5 text-sm font-semibold transition ${
                          availabilityMinutes === m
                            ? "border-teal bg-teal/10 text-teal"
                            : "border-tan/60 bg-white/50 text-ink/70 hover:bg-tan/15"
                        }`}
                      >
                        {DURATION_LABELS[m]}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <ChallengeSlider value={challenge} onChange={setChallenge} />
            <button className="btn-primary w-full" onClick={find}>
              find someone
            </button>
            <p className="text-center text-xs text-ink/40">
              {aiOn ? "matching powered by Claude" : "smart matching on every search"}
            </p>
          </div>
        </div>
      )}

      {/* ---------- SEARCHING ---------- */}
      {step === "searching" && (
        <div className="flex flex-1 animate-fade-in flex-col items-center justify-center text-center">
          <div className="animate-pulse">
            <Logo size={96} />
          </div>
          <p className="serif mt-6 text-espresso/70">finding someone for you…</p>
        </div>
      )}

      {/* ---------- CANDIDATE CARD ---------- */}
      {step === "card" && candidate && (
        <div className="flex flex-1 animate-fade-in flex-col">
          <button
            onClick={() => setStep("idle")}
            className="mb-3 mt-2 self-start text-sm font-semibold text-ink/50 hover:text-ink"
          >
            ← change the vibe
          </button>
          <MatchCard candidate={candidate} onReport={() => setReporting(true)} />
          <div className="mt-auto grid grid-cols-2 gap-3 pt-6">
            <button className="btn-ghost" onClick={pass} disabled={busy}>
              keep looking
            </button>
            <button className="btn-primary" onClick={meet} disabled={busy}>
              {busy ? "…" : "meet them"}
            </button>
          </div>
          <p className="mt-2 text-center text-xs text-ink/40">
            no names or messages until you both say yes.
          </p>
        </div>
      )}

      {/* ---------- EMPTY ---------- */}
      {step === "empty" && (
        <div className="flex flex-1 animate-fade-in flex-col items-center justify-center text-center">
          <Logo size={84} steam={false} />
          <h2 className="mt-6 text-2xl font-bold">no one around right now</h2>
          <p className="serif mt-2 max-w-xs text-espresso/65">
            you&apos;ve seen everyone nearby for this search. try widening the dial,
            or check back when more people are free.
          </p>
          <div className="mt-8 w-full max-w-xs space-y-3">
            <button className="btn-primary w-full" onClick={() => setStep("idle")}>
              adjust &amp; search again
            </button>
            <Link href="/matches" className="btn-ghost w-full">
              see your matches
            </Link>
          </div>
        </div>
      )}

      {/* ---------- MATCHED / REVEAL ---------- */}
      {step === "matched" && match?.other && (
        <div className="flex flex-1 animate-fade-up flex-col items-center justify-center text-center">
          <Logo size={84} />
          <p className="serif mt-5 text-espresso/70">you both said yes.</p>
          <div className="mt-5 flex items-center justify-center">
            <Avatar
              avatar={me.avatar}
              photoUrl={me.photoUrl}
              size={84}
              revealed
              className="ring-2 ring-paper"
            />
            <Avatar
              avatar={match.other.avatar}
              photoUrl={match.other.photoUrl}
              size={84}
              revealed
              className="-ml-5 ring-2 ring-paper"
            />
          </div>
          <h1 className="mt-5 flex items-center justify-center gap-2 text-3xl font-bold tracking-tight">
            meet {match.other.name}
            {match.other.verified && <VerifiedBadge />}
          </h1>
          <p className="mt-1 text-ink/70">{match.other.iAm}</p>

          {match.spot && (
            <div className="card mt-6 w-full p-5 text-left">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-teal">
                suggested spot — public &amp; nearby
              </p>
              <p className="mt-1 text-lg font-bold">{match.spot.name}</p>
              <p className="serif text-sm text-espresso/65">{match.spot.blurb}</p>
            </div>
          )}

          <div className="mt-6 w-full space-y-3">
            <button
              className="btn-primary w-full"
              onClick={() => router.push(`/matches/${match.id}`)}
            >
              say hi &amp; plan it
            </button>
            <button
              className="btn-ghost w-full"
              onClick={() => {
                setMatch(null);
                setStep("idle");
              }}
            >
              keep finding people
            </button>
          </div>
        </div>
      )}

      {/* ---------- toast ---------- */}
      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 flex justify-center px-6">
          <div className="animate-sheet-up rounded-full bg-ink px-5 py-3 text-sm font-medium text-paper shadow-card">
            {toast}
          </div>
        </div>
      )}

      {/* ---------- report sheet ---------- */}
      {reporting && candidate && (
        <div
          className="fixed inset-0 z-20 flex animate-fade-in items-end justify-center bg-ink/40 p-4"
          onClick={() => setReporting(false)}
        >
          <div
            className="card w-full max-w-md animate-sheet-up p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold">not feeling safe?</h3>
            <p className="serif mt-1 text-sm text-espresso/65">
              you can do this any time — even before names are shared. they
              won&apos;t be told.
            </p>
            <div className="mt-4 space-y-2">
              <button
                className="btn-dark w-full"
                onClick={() => confirmReport("report")}
              >
                report &amp; block {candidate.pseudonym}
              </button>
              <button
                className="btn-ghost w-full"
                onClick={() => confirmReport("block")}
              >
                just block them
              </button>
              <button
                className="w-full py-2 text-sm font-semibold text-ink/50"
                onClick={() => setReporting(false)}
              >
                cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

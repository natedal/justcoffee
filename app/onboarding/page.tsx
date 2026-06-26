"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/Logo";
import { Avatar } from "@/components/Avatar";
import { jpost } from "@/components/api";
import { CITIES } from "@/lib/cities";
import { AVAILABILITY_LABELS, type AvailabilityWindow } from "@/lib/types";

const AVAIL: AvailabilityWindow[] = ["now", "today", "weekend"];

export default function Onboarding() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [city, setCity] = useState("austin");
  const [iAm, setIAm] = useState("");
  const [lookingTo, setLookingTo] = useState("");
  const [availability, setAvailability] = useState<AvailabilityWindow>("today");
  const [hue, setHue] = useState(0);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [located, setLocated] = useState<"idle" | "ok" | "deny">("idle");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const shape = useMemo(() => Math.floor(Math.random() * 5), []);

  function useMyLocation() {
    if (!navigator.geolocation) return setLocated("deny");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocated("ok");
      },
      () => setLocated("deny"),
      { timeout: 8000 },
    );
  }

  async function submit() {
    setError("");
    setBusy(true);
    const res = await jpost<{ user?: unknown; error?: string }>("/api/profile", {
      name,
      age: Number(age),
      city,
      iAm,
      lookingTo,
      availability,
      avatarHue: hue,
      avatarShape: shape,
      ...(coords ?? {}),
    });
    setBusy(false);
    if (res.user) router.push("/find");
    else setError(res.error ?? "something went wrong");
  }

  return (
    <main className="frame py-8">
      <div className="flex items-center gap-3">
        <Logo size={40} steam={false} />
        <h1 className="text-2xl font-bold tracking-tight">set up your card</h1>
      </div>
      <p className="serif mt-1 text-espresso/65">
        two sentences is all it takes. takes about a minute.
      </p>

      <div className="mt-6 flex flex-col gap-5">
        <div className="flex items-end gap-4">
          <div className="flex-1">
            <label className="label">first name</label>
            <input
              className="field"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="what should we call you?"
              maxLength={40}
            />
          </div>
          <div className="w-24">
            <label className="label">age</label>
            <input
              className="field"
              value={age}
              onChange={(e) => setAge(e.target.value.replace(/\D/g, "").slice(0, 3))}
              inputMode="numeric"
              placeholder="18+"
            />
          </div>
        </div>

        <div>
          <label className="label">I&apos;m a…</label>
          <input
            className="field"
            value={iAm}
            onChange={(e) => setIAm(e.target.value)}
            placeholder="e.g. a burned-out nurse who loves sci-fi"
            maxLength={140}
          />
          <p className="mt-1 text-xs text-ink/45">one sentence about who you are.</p>
        </div>

        <div>
          <label className="label">I&apos;m looking to…</label>
          <input
            className="field"
            value={lookingTo}
            onChange={(e) => setLookingTo(e.target.value)}
            placeholder="e.g. argue politics with someone who'll hear me out"
            maxLength={140}
          />
          <p className="mt-1 text-xs text-ink/45">
            one sentence about what you want from the conversation.
          </p>
        </div>

        <div>
          <label className="label">when are you free?</label>
          <div className="grid grid-cols-3 gap-2">
            {AVAIL.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setAvailability(a)}
                className={`rounded-2xl border px-2 py-3 text-sm font-semibold capitalize transition ${
                  availability === a
                    ? "border-teal bg-teal text-paper"
                    : "border-tan/60 bg-white/50 text-ink/70"
                }`}
              >
                {a === "now" ? "next 2 hrs" : a === "today" ? "today" : "this weekend"}
              </button>
            ))}
          </div>
          <p className="serif mt-2 text-xs text-espresso/55">
            you&apos;re {AVAILABILITY_LABELS[availability]}.
          </p>
        </div>

        <div>
          <label className="label">where are you?</label>
          <div className="flex gap-2">
            <select
              className="field flex-1"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            >
              {CITIES.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={useMyLocation}
              className="btn-ghost whitespace-nowrap px-4 py-3 text-sm"
            >
              {located === "ok" ? "located ✓" : "use my location"}
            </button>
          </div>
          {located === "deny" && (
            <p className="mt-1 text-xs text-terracotta">
              couldn&apos;t get your location — we&apos;ll use the city above.
            </p>
          )}
        </div>

        <div>
          <label className="label">pick a look</label>
          <div className="flex items-center gap-4">
            <Avatar avatar={{ hue, shape }} size={64} revealed />
            <div className="flex flex-wrap gap-2">
              {[0, 1, 2, 3, 4, 5].map((h) => (
                <button
                  key={h}
                  type="button"
                  aria-label={`avatar color ${h + 1}`}
                  onClick={() => setHue(h)}
                  className={`h-9 w-9 overflow-hidden rounded-full ring-2 transition ${
                    hue === h ? "ring-teal" : "ring-transparent"
                  }`}
                >
                  <Avatar avatar={{ hue: h, shape }} size={36} revealed />
                </button>
              ))}
            </div>
          </div>
          <p className="mt-2 text-xs text-ink/45">
            strangers see this blurred until you both say yes.
          </p>
        </div>

        {error && (
          <p className="rounded-xl bg-terracotta/10 px-4 py-3 text-sm text-terracotta">
            {error}
          </p>
        )}

        <button className="btn-primary w-full" onClick={submit} disabled={busy}>
          {busy ? "setting up…" : "start finding people"}
        </button>
        <p className="text-center text-xs text-ink/45">
          18+ only. by continuing you agree to meet in public places.
        </p>
      </div>
    </main>
  );
}

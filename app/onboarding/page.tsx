"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/Logo";
import { Avatar } from "@/components/Avatar";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { jget, jpost } from "@/components/api";
import { CITIES } from "@/lib/cities";
import type { SelfViewData } from "@/lib/actions";

export default function Onboarding() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [city, setCity] = useState("champaign");
  const [iAm, setIAm] = useState("");
  const [lookingTo, setLookingTo] = useState("");
  const [hue, setHue] = useState(0);
  const [shape, setShape] = useState(() => Math.floor(Math.random() * 5));
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [located, setLocated] = useState<"idle" | "ok" | "deny">("idle");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [editing, setEditing] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Onboarding requires a verified session (via the magic link). Send anyone
  // who isn't signed in to /signin, and prefill the form when editing.
  useEffect(() => {
    jget<{ user: SelfViewData | null }>("/api/session").then((d) => {
      if (!d.user) {
        router.replace("/signin");
        return;
      }
      const u = d.user;
      setAuthEmail(u.email);
      setEditing(u.profileComplete);
      if (u.profileComplete) {
        setName(u.name);
        setAge(String(u.age));
        setIAm(u.iAm);
        setLookingTo(u.lookingTo);
      }
      setCity(u.city);
      setHue(u.avatar.hue);
      setShape(u.avatar.shape);
      setPhotoUrl(u.photoUrl);
      setVerified(u.verified);
      setChecking(false);
    });
  }, [router]);

  async function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!f) return;
    setError("");
    setUploading(true);
    const fd = new FormData();
    fd.append("photo", f);
    const r = await fetch("/api/photo", { method: "POST", body: fd });
    const d = (await r.json()) as { user?: SelfViewData; error?: string };
    setUploading(false);
    if (d.user) {
      setPhotoUrl(d.user.photoUrl);
      setVerified(d.user.verified);
    } else {
      setError(d.error ?? "couldn't upload that image");
    }
  }

  async function verifyPhoto() {
    setError("");
    setVerifying(true);
    const d = await jpost<{ user?: SelfViewData; error?: string }>("/api/verify");
    setVerifying(false);
    if (d.user) setVerified(d.user.verified);
    else setError(d.error ?? "verification didn't go through");
  }

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
      avatarHue: hue,
      avatarShape: shape,
      ...(coords ?? {}),
    });
    setBusy(false);
    if (res.user) router.push("/find");
    else setError(res.error ?? "something went wrong");
  }

  if (checking) {
    return (
      <main className="frame items-center justify-center">
        <Logo size={64} />
      </main>
    );
  }

  return (
    <main className="frame py-8">
      <div className="flex items-center gap-3">
        <Logo size={40} steam={false} />
        <h1 className="text-2xl font-bold tracking-tight">
          {editing ? "edit your card" : "set up your card"}
        </h1>
      </div>
      <p className="serif mt-1 text-espresso/65">
        {editing
          ? "tweak anything — you choose when you're free at each search."
          : "two sentences is all it takes. takes about a minute."}
      </p>
      {authEmail && (
        <p className="mt-1 text-xs text-ink/45">signed in as {authEmail}</p>
      )}

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
          <label className="label">your photo (optional)</label>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={onPickPhoto}
          />
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="relative rounded-full ring-2 ring-transparent transition hover:ring-teal/40"
              aria-label="upload a photo"
            >
              <Avatar avatar={{ hue, shape }} photoUrl={photoUrl} size={72} revealed />
              {verified && (
                <span className="absolute -bottom-1 -right-1">
                  <VerifiedBadge size={22} className="ring-2 ring-paper" />
                </span>
              )}
            </button>
            <div className="flex-1">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="btn-ghost px-4 py-2 text-sm"
                disabled={uploading}
              >
                {uploading ? "uploading…" : photoUrl ? "change photo" : "add a photo"}
              </button>
              {photoUrl && !verified && (
                <button
                  type="button"
                  onClick={verifyPhoto}
                  className="ml-2 text-sm font-semibold text-teal hover:underline disabled:opacity-50"
                  disabled={verifying}
                >
                  {verifying ? "verifying…" : "verify it →"}
                </button>
              )}
              {verified ? (
                <p className="serif mt-2 text-xs text-teal">
                  photo verified — matches will see a verified badge.
                </p>
              ) : (
                <p className="mt-2 text-xs text-ink/45">
                  blurred until you both say yes. verifying adds a trust badge.
                </p>
              )}
            </div>
          </div>
        </div>

        <div>
          <label className="label">{photoUrl ? "or pick a fallback look" : "pick a look"}</label>
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
          {editing
            ? busy
              ? "saving…"
              : "save changes"
            : busy
              ? "setting up…"
              : "start finding people"}
        </button>
        {editing && (
          <button
            type="button"
            className="w-full py-1 text-center text-sm font-semibold text-ink/50 hover:text-ink"
            onClick={() => router.push("/find")}
          >
            cancel
          </button>
        )}
        <p className="text-center text-xs text-ink/45">
          18+ only. by continuing you agree to meet in public places.
        </p>
      </div>
    </main>
  );
}

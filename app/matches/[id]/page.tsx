"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { Avatar } from "@/components/Avatar";
import { jget, jpost } from "@/components/api";
import type { MatchViewData } from "@/lib/actions";

type Msg = { id: string; mine: boolean; body: string; at: number };

function timeLeft(expiresAt: number): string {
  const ms = expiresAt - Date.now();
  if (ms <= 0) return "expired";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m to plan it` : `${m}m to plan it`;
}

export default function MatchDetail() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [match, setMatch] = useState<MatchViewData | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [shareText, setShareText] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [reporting, setReporting] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const loadMessages = useCallback(async () => {
    const d = await jget<{ messages: Msg[]; error?: string }>(
      `/api/matches/${id}/messages`,
    );
    if (d.messages) setMessages(d.messages);
  }, [id]);

  useEffect(() => {
    jget<{ match?: MatchViewData; error?: string }>(`/api/matches/${id}`).then((d) => {
      if (d.match) setMatch(d.match);
      else setNotFound(true);
    });
    loadMessages();
    const t = setInterval(loadMessages, 4000);
    return () => clearInterval(t);
  }, [id, loadMessages]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    const body = input.trim();
    if (!body) return;
    setInput("");
    const res = await jpost<{ messages: Msg[] }>(`/api/matches/${id}/messages`, { body });
    if (res.messages) setMessages(res.messages);
  }

  async function setMet(met: boolean) {
    const d = await jpost<{ match: MatchViewData }>(`/api/matches/${id}/met`, { met });
    if (d.match) setMatch(d.match);
  }

  async function openShare() {
    const d = await jget<{ text?: string }>(`/api/matches/${id}/share`);
    setShareText(d.text ?? "couldn't build a share message.");
  }

  async function copyShare() {
    if (!shareText) return;
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable */
    }
  }

  async function block() {
    if (!match?.other) return;
    await jpost("/api/safety", { targetId: match.other.id, action: "block" });
    router.push("/matches");
  }

  if (notFound) {
    return (
      <main className="frame items-center justify-center text-center">
        <Logo size={64} steam={false} />
        <p className="serif mt-4 text-espresso/70">this match isn&apos;t available.</p>
        <Link href="/matches" className="btn-primary mt-6">
          back to matches
        </Link>
      </main>
    );
  }

  if (!match?.other) {
    return (
      <main className="frame items-center justify-center">
        <Logo size={56} />
      </main>
    );
  }

  const closed = match.status === "closed";
  const expired = match.status === "expired";

  return (
    <main className="mx-auto flex h-[100dvh] w-full max-w-md flex-col">
      {/* header */}
      <header className="flex items-center gap-3 border-b border-tan/40 px-5 py-3">
        <Link href="/matches" className="text-ink/50 hover:text-ink">
          ‹
        </Link>
        <Avatar avatar={match.other.avatar} size={40} revealed />
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold leading-tight">{match.other.name}</p>
          <p className="truncate text-xs text-ink/50">
            {expired ? "match expired" : closed ? "closed" : timeLeft(match.expiresAt)}
          </p>
        </div>
        <button
          onClick={() => setReporting(true)}
          className="rounded-full px-2 py-1 text-sm text-ink/40 hover:text-terracotta"
          aria-label="safety options"
        >
          ⚑
        </button>
      </header>

      {/* scrollable body */}
      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
        {/* coffee spot */}
        {match.spot && (
          <div className="card p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-teal">
              your spot — public &amp; nearby
            </p>
            <p className="mt-1 text-lg font-bold">{match.spot.name}</p>
            <p className="serif text-sm text-espresso/65">{match.spot.blurb}</p>
            <button
              onClick={openShare}
              className="mt-3 text-sm font-semibold text-teal hover:underline"
            >
              share your plans with a friend →
            </button>
          </div>
        )}

        {/* post-coffee prompt */}
        {match.youSaidMet === null && !closed ? (
          <div className="card flex items-center justify-between gap-3 p-4">
            <p className="text-sm font-semibold">have you two met up?</p>
            <div className="flex gap-2">
              <button className="btn-ghost px-4 py-2 text-sm" onClick={() => setMet(false)}>
                not yet
              </button>
              <button className="btn-primary px-4 py-2 text-sm" onClick={() => setMet(true)}>
                we met!
              </button>
            </div>
          </div>
        ) : match.youSaidMet === "yes" ? (
          <p className="serif text-center text-sm text-espresso/60">
            glad you two actually met. that&apos;s the whole point. ☕
          </p>
        ) : match.youSaidMet === "no" ? (
          <p className="serif text-center text-sm text-espresso/55">
            no worries — there&apos;s always next time.
          </p>
        ) : null}

        {/* intro line */}
        <p className="serif text-center text-xs text-espresso/50">
          you matched on coffee — keep it to planning the meet-up.
        </p>

        {/* messages */}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.mine ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-[15px] ${
                m.mine
                  ? "rounded-br-md bg-teal text-paper"
                  : "rounded-bl-md bg-white text-ink ring-1 ring-tan/50"
              }`}
            >
              {m.body}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {/* composer */}
      <div className="border-t border-tan/40 px-4 py-3">
        {closed ? (
          <p className="py-2 text-center text-sm text-ink/50">this conversation is closed.</p>
        ) : (
          <div className="flex items-end gap-2">
            <input
              className="field flex-1"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="when works for coffee?"
              maxLength={1000}
            />
            <button
              className="btn-primary px-5 py-3"
              onClick={send}
              disabled={!input.trim()}
            >
              send
            </button>
          </div>
        )}
      </div>

      {/* share sheet */}
      {shareText !== null && (
        <div
          className="fixed inset-0 z-20 flex items-end justify-center bg-ink/40 p-4"
          onClick={() => setShareText(null)}
        >
          <div className="card w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold">share your plans</h3>
            <p className="serif mt-1 text-sm text-espresso/65">
              send this to someone you trust before you head out.
            </p>
            <p className="mt-4 rounded-2xl bg-white/70 p-4 text-sm text-ink ring-1 ring-tan/50">
              {shareText}
            </p>
            <div className="mt-4 flex gap-2">
              <button className="btn-primary flex-1" onClick={copyShare}>
                {copied ? "copied ✓" : "copy"}
              </button>
              <button className="btn-ghost flex-1" onClick={() => setShareText(null)}>
                done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* safety sheet */}
      {reporting && (
        <div
          className="fixed inset-0 z-20 flex items-end justify-center bg-ink/40 p-4"
          onClick={() => setReporting(false)}
        >
          <div className="card w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold">safety</h3>
            <p className="serif mt-1 text-sm text-espresso/65">
              block {match.other.name} and close this conversation. always meet in
              public.
            </p>
            <div className="mt-4 space-y-2">
              <button className="btn-dark w-full" onClick={block}>
                block &amp; close
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

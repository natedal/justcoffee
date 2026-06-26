"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Logo, Wordmark } from "@/components/Logo";
import { Avatar } from "@/components/Avatar";
import { jget } from "@/components/api";
import type { MatchViewData } from "@/lib/actions";

export default function Matches() {
  const [matches, setMatches] = useState<MatchViewData[] | null>(null);

  useEffect(() => {
    jget<{ matches: MatchViewData[] }>("/api/matches").then((d) => setMatches(d.matches));
  }, []);

  return (
    <main className="frame py-6">
      <header className="flex items-center justify-between">
        <Link href="/find">
          <Wordmark className="text-xl" />
        </Link>
        <Link href="/find" className="text-sm font-semibold text-teal hover:underline">
          find someone
        </Link>
      </header>

      <h1 className="mt-6 text-3xl font-bold tracking-tight">your matches</h1>
      <p className="serif mt-1 text-espresso/65">
        people who said yes to coffee, too.
      </p>

      <div className="mt-6 flex-1 space-y-3">
        {matches === null && (
          <div className="flex justify-center py-16 opacity-60">
            <Logo size={56} />
          </div>
        )}

        {matches?.length === 0 && (
          <div className="card flex flex-col items-center p-8 text-center">
            <Logo size={64} steam={false} />
            <p className="serif mt-4 text-espresso/70">
              no matches yet. go find someone for coffee.
            </p>
            <Link href="/find" className="btn-primary mt-5">
              find someone
            </Link>
          </div>
        )}

        {matches?.map((m) =>
          m.other ? (
            <Link
              key={m.id}
              href={`/matches/${m.id}`}
              className="card flex items-center gap-4 p-4 transition hover:shadow-lift"
            >
              <Avatar avatar={m.other.avatar} size={56} revealed />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-lg font-bold">{m.other.name}</p>
                  {m.status === "expired" && (
                    <span className="chip border-terracotta/40 text-terracotta">
                      expired
                    </span>
                  )}
                  {m.status === "closed" && (
                    <span className="chip">closed</span>
                  )}
                </div>
                <p className="truncate text-sm text-ink/55">
                  {m.spot ? `meet at ${m.spot.name}` : m.other.iAm}
                </p>
              </div>
              <span className="text-ink/30">›</span>
            </Link>
          ) : null,
        )}
      </div>
    </main>
  );
}

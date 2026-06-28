import type { Candidate } from "@/lib/types";
import { formatAvailabilityShort } from "@/lib/types";
import { Avatar } from "./Avatar";

export function MatchCard({
  candidate,
  onReport,
}: {
  candidate: Candidate;
  onReport?: () => void;
}) {
  return (
    <div className="card animate-fade-up p-6">
      <div className="flex items-start gap-4">
        <Avatar avatar={candidate.avatar} size={72} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-xl font-bold">
              {candidate.pseudonym}
              <span className="ml-1 font-normal text-ink/50">{candidate.age}</span>
            </h2>
            {onReport && (
              <button
                onClick={onReport}
                aria-label="report or block"
                className="ml-auto rounded-full px-2 py-1 text-xs text-ink/35 hover:text-terracotta"
              >
                ⚑
              </button>
            )}
          </div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <span className="chip">{candidate.distanceMi} mi away</span>
            <span className="chip capitalize">
              free{" "}
              {formatAvailabilityShort(
                candidate.availability,
                candidate.availabilityMinutes,
              )}
            </span>
          </div>
        </div>
      </div>

      <dl className="mt-5 space-y-3">
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-ink/40">
            they are
          </dt>
          <dd className="text-[17px] leading-snug">{candidate.iAm}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-ink/40">
            they want
          </dt>
          <dd className="text-[17px] leading-snug">{candidate.lookingTo}</dd>
        </div>
      </dl>

      <div className="mt-5 rounded-2xl border border-teal/20 bg-teal/[0.06] p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-teal">
          why you two
        </p>
        <p className="serif mt-1 text-[15px] leading-relaxed text-espresso/85">
          {candidate.rationale}
        </p>
        {candidate.sharedTopics.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {candidate.sharedTopics.map((t) => (
              <span key={t} className="chip border-teal/30 bg-white/60">
                {t}
              </span>
            ))}
          </div>
        )}
        {candidate.conversationStarters.length > 0 && (
          <div className="mt-4 border-t border-teal/15 pt-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-teal">
              things you could get into
            </p>
            <ul className="serif mt-1.5 space-y-1 text-[15px] leading-snug text-espresso/85">
              {candidate.conversationStarters.map((t) => (
                <li key={t} className="flex gap-2">
                  <span aria-hidden className="select-none text-teal/60">
                    ·
                  </span>
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

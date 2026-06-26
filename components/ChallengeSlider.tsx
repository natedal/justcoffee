"use client";

// The challenge dial. Lets the user choose, before each search, how far outside
// their bubble they want to go — from "someone like me" to "someone I'd never
// normally meet". This drives the similar↔different weighting in the matcher.

function caption(v: number): { title: string; sub: string } {
  if (v < 0.2)
    return { title: "someone on your wavelength", sub: "shared ground, easy rapport" };
  if (v < 0.4)
    return { title: "mostly familiar", sub: "a little stretch, not a leap" };
  if (v < 0.6)
    return { title: "open", sub: "a real conversation, not an echo" };
  if (v < 0.8)
    return { title: "a different vantage point", sub: "someone who sees it another way" };
  return { title: "someone you'd never normally meet", sub: "different world, same curiosity" };
}

export function ChallengeSlider({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const pct = Math.round(value * 100);
  const { title, sub } = caption(value);

  return (
    <div className="card p-5">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-semibold text-ink/70">how challenging?</span>
        <span className="serif text-sm text-espresso/70">{title}</span>
      </div>

      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label="How challenging should the conversation be"
        className="mt-4 h-2 w-full cursor-pointer appearance-none rounded-full
          [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:w-6
          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full
          [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-paper
          [&::-webkit-slider-thumb]:bg-teal [&::-webkit-slider-thumb]:shadow-lift
          [&::-moz-range-thumb]:h-6 [&::-moz-range-thumb]:w-6 [&::-moz-range-thumb]:rounded-full
          [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-paper
          [&::-moz-range-thumb]:bg-teal"
        style={{
          background: `linear-gradient(90deg, #C2A883 0%, #C2A883 ${pct}%, rgba(40,26,18,0.12) ${pct}%, rgba(40,26,18,0.12) 100%)`,
        }}
      />

      <div className="mt-2 flex justify-between text-[11px] font-medium uppercase tracking-wide text-ink/45">
        <span>like me</span>
        <span>open</span>
        <span>surprise me</span>
      </div>
      <p className="serif mt-3 text-center text-sm text-espresso/60">{sub}</p>
    </div>
  );
}

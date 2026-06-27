import type { Avatar as AvatarT } from "@/lib/types";

// Deterministic, brand-colored geometric avatars stand in for photos in the MVP.
// Before a mutual match they render blurred + muted (you don't see who it is);
// after the reveal they render crisp.

const RAMP: { bg: string; fg: string }[] = [
  { bg: "#15625C", fg: "#F0E7D5" },
  { bg: "#C2613B", fg: "#F0E7D5" },
  { bg: "#C2A883", fg: "#2E1F15" },
  { bg: "#2E1F15", fg: "#C2A883" },
  { bg: "#2C7C75", fg: "#F0E7D5" },
  { bg: "#9C4A2A", fg: "#F0E7D5" },
];

function Motif({ shape, fg }: { shape: number; fg: string }) {
  switch (((shape % 5) + 5) % 5) {
    case 0:
      return (
        <g fill="none" stroke={fg} strokeWidth={6} opacity={0.85}>
          <circle cx="50" cy="50" r="13" />
          <circle cx="50" cy="50" r="26" />
        </g>
      );
    case 1:
      return (
        <g fill={fg} opacity={0.85}>
          <circle cx="38" cy="44" r="11" />
          <circle cx="64" cy="56" r="16" />
        </g>
      );
    case 2:
      return <path d="M50 28 L72 70 L28 70 Z" fill={fg} opacity={0.85} />;
    case 3:
      return (
        <g stroke={fg} strokeWidth={7} strokeLinecap="round" opacity={0.85}>
          <path d="M30 64 Q50 30 70 64" fill="none" />
          <circle cx="50" cy="40" r="2.5" fill={fg} />
        </g>
      );
    default:
      return (
        <g fill={fg} opacity={0.85}>
          <rect x="28" y="44" width="44" height="12" rx="6" transform="rotate(-20 50 50)" />
        </g>
      );
  }
}

export function Avatar({
  avatar,
  photoUrl,
  size = 72,
  revealed = false,
  className = "",
}: {
  avatar: AvatarT;
  photoUrl?: string | null;
  size?: number;
  revealed?: boolean;
  className?: string;
}) {
  const c = RAMP[((avatar.hue % 6) + 6) % 6];
  // Pre-reveal we blur whatever's shown so identity stays hidden; the same
  // treatment applies to a real photo or the geometric stand-in.
  const obscure = {
    filter: revealed ? "none" : "blur(7px) saturate(0.7) brightness(0.97)",
    transform: revealed ? "none" : "scale(1.15)",
    transition: "filter .5s ease, transform .5s ease",
  } as const;

  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-full ring-1 ring-ink/10 ${className}`}
      style={{ width: size, height: size }}
    >
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoUrl}
          alt=""
          width={size}
          height={size}
          className="h-full w-full object-cover"
          style={obscure}
        />
      ) : (
        <svg
          viewBox="0 0 100 100"
          width={size}
          height={size}
          style={obscure}
          aria-hidden="true"
        >
          <rect width="100" height="100" fill={c.bg} />
          <Motif shape={avatar.shape} fg={c.fg} />
        </svg>
      )}
      {!revealed && <div className="absolute inset-0 bg-paper/10" />}
    </div>
  );
}

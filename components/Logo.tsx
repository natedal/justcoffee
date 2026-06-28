// The signature device: two overlapping rings (you + someone) with steam
// rising from the shared space. Matches the campaign reference.

export function Logo({
  size = 56,
  variant = "light",
  steam = true,
  className = "",
}: {
  size?: number;
  variant?: "light" | "dark";
  steam?: boolean;
  className?: string;
}) {
  const left = variant === "dark" ? "#C2A883" : "#281A12";
  const right = "#15625C";
  const steamColor = variant === "dark" ? "#C2A883" : "#C2A883";

  return (
    <svg
      width={size}
      height={(size * 150) / 140}
      viewBox="0 0 140 150"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      {steam && (
        <g
          stroke={steamColor}
          strokeWidth={3}
          strokeLinecap="round"
          fill="none"
          opacity={0.85}
        >
          <path className="animate-steam" style={{ animationDelay: "0s" }}
            d="M62 50 C57 42 67 38 62 30 C57 22 67 18 62 12" />
          <path className="animate-steam" style={{ animationDelay: "0.5s" }}
            d="M78 50 C73 42 83 38 78 30 C73 22 83 18 78 12" />
        </g>
      )}
      {/* faint echo rings */}
      <circle cx="52" cy="98" r="36" stroke={left} strokeWidth={5} opacity={0.12}
        transform="translate(-3 3)" />
      <circle cx="88" cy="98" r="36" stroke={right} strokeWidth={5} opacity={0.12}
        transform="translate(3 3)" />
      {/* main rings */}
      <circle cx="52" cy="98" r="36" stroke={left} strokeWidth={5} />
      <circle cx="88" cy="98" r="36" stroke={right} strokeWidth={5} />
    </svg>
  );
}

export function Wordmark({
  className = "",
  tone = "teal",
}: {
  className?: string;
  tone?: "teal" | "paper" | "ink";
}) {
  const color =
    tone === "paper" ? "text-paper" : tone === "ink" ? "text-ink" : "text-teal";
  return (
    <span className={`font-sans font-bold tracking-tight ${color} ${className}`}>
      justcoffee
    </span>
  );
}

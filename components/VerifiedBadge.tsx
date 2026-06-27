// Small "verified" mark shown next to a revealed name when the person has
// completed photo verification.
export function VerifiedBadge({
  size = 18,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <span
      title="photo verified"
      aria-label="photo verified"
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-teal text-paper ${className}`}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 24 24" width={size * 0.66} height={size * 0.66} aria-hidden="true">
        <path
          d="M20 6L9 17l-5-5"
          fill="none"
          stroke="currentColor"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

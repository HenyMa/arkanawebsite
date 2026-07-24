/**
 * The Arkana mark — an alchemical triangle inside a ring. Inherits
 * `currentColor` so it can sit on light or dark ground without a variant.
 */
export function Mark({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
      className={className}
      stroke="currentColor"
    >
      <circle cx="24" cy="24" r="21" strokeWidth="1.5" opacity="0.5" />
      <path d="M24 11 L36 33 H12 Z" strokeWidth="1.75" strokeLinejoin="round" />
      <path d="M17 27 H31" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span
      className={`font-display text-[1.05rem] leading-none tracking-[0.28em] sm:text-[1.35rem] sm:tracking-[0.42em] ${className}`}
    >
      ARKANA
    </span>
  );
}

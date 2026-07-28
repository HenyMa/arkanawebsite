import Link from "next/link";

/**
 * Button treatments used across the site: a solid graphite `primary` and a
 * hairline `outline`, plus `*OnDark` counterparts for the graphite sections.
 * All share the same uppercase tracked label.
 *
 * Colours belong in a variant, never in a caller's `className`. Tailwind
 * emits every utility at the same specificity, so which one wins depends on
 * the order of the generated stylesheet, not the order of the class attribute
 * — an override like `text-bone` on top of `text-graphite` silently loses.
 */
const BASE =
  "inline-flex items-center justify-center gap-2 px-8 py-3.5 text-[0.7rem] font-medium uppercase tracking-[0.22em] transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-45";

const VARIANTS = {
  primary:
    "bg-graphite text-bone hover:bg-gold-deep",
  outline:
    "border border-tan text-graphite hover:border-gold hover:bg-linen",
  ghost:
    "text-slate hover:text-graphite",
  primaryOnDark:
    "bg-gold text-graphite hover:bg-gold-soft",
  outlineOnDark:
    "border border-white/25 text-bone hover:border-gold-soft hover:bg-white/5",
} as const;

export type Variant = keyof typeof VARIANTS;

export function Button({
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button className={`${BASE} ${VARIANTS[variant]} ${className}`} {...props} />
  );
}

export function ButtonLink({
  variant = "primary",
  className = "",
  href,
  children,
}: {
  variant?: Variant;
  className?: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className={`${BASE} ${VARIANTS[variant]} ${className}`}>
      {children}
    </Link>
  );
}

import Link from "next/link";

/**
 * Button treatments used across the site: a solid graphite `primary` and a
 * hairline `outline`, plus `*OnDark` counterparts for the graphite sections,
 * and a `link` variant that is nothing but tracked text over a rule.
 *
 * Everything is squared off, set in the same micro uppercase as the rest of
 * the interface, and sized generously — a call to action here is a line of
 * type with room around it, not a filled pill.
 *
 * Colours belong in a variant, never in a caller's `className`. Tailwind
 * emits every utility at the same specificity, so which one wins depends on
 * the order of the generated stylesheet, not the order of the class attribute
 * — an override like `text-bone` on top of `text-graphite` silently loses.
 */
const BASE =
  "inline-flex items-center justify-center gap-2 text-[0.625rem] font-normal uppercase tracking-[0.3em] transition-all duration-500 disabled:cursor-not-allowed disabled:opacity-40";

const PADDED = `${BASE} px-10 py-4`;

const VARIANTS = {
  primary: `${PADDED} bg-graphite text-bone hover:bg-graphite/85`,
  outline: `${PADDED} border border-graphite text-graphite hover:bg-graphite hover:text-bone`,
  ghost: `${PADDED} border border-parchment text-slate hover:border-graphite hover:text-graphite`,
  primaryOnDark: `${PADDED} bg-bone text-graphite hover:bg-sand`,
  outlineOnDark: `${PADDED} border border-bone/40 text-bone hover:border-bone hover:bg-bone hover:text-graphite`,
  /** Text-only call to action sitting on a hairline. */
  link: `${BASE} link-rule text-graphite`,
  linkOnDark: `${BASE} link-rule text-bone`,
} as const;

export type Variant = keyof typeof VARIANTS;

export function Button({
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button className={`${VARIANTS[variant]} ${className}`} {...props} />;
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
    <Link href={href} className={`${VARIANTS[variant]} ${className}`}>
      {children}
    </Link>
  );
}

import Link from "next/link";

/**
 * Two button treatments used across the site: a solid graphite `primary` and a
 * hairline `outline`. Both share the same uppercase tracked label.
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
} as const;

type Variant = keyof typeof VARIANTS;

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

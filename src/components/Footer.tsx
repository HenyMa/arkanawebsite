import Link from "next/link";
import { Mark, Wordmark } from "./Logo";
import { CATEGORIES, categoryPath } from "@/lib/products";
import { SHIPPING_SUMMARY } from "@/lib/shipping";

const COLUMNS = [
  {
    heading: "Shop",
    links: [
      ...CATEGORIES.map((category) => ({
        href: categoryPath(category.slug),
        label: category.name,
      })),
      { href: "/cart", label: "Cart" },
      { href: "/search", label: "Search" },
    ],
  },
  {
    heading: "Account",
    links: [
      { href: "/login", label: "Sign in" },
      { href: "/signup", label: "Create an account" },
      { href: "/account", label: "Orders & points" },
      { href: "/account", label: "Start a return" },
    ],
  },
  {
    heading: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/rewards", label: "The Arkana Circle" },
      { href: "/shipping", label: "Shipping & returns" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="mt-24 bg-graphite text-mist">
      <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
        <div className="grid gap-12 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <div className="flex items-center gap-2.5 text-bone">
              <Mark className="h-7 w-7 text-gold-soft" />
              <Wordmark />
            </div>
            <p className="mt-5 max-w-xs font-display text-lg leading-relaxed text-sand/80">
              Heavyweight essentials, made in small batches. Fewer pieces, made
              properly.
            </p>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.heading}>
              <h3 className="eyebrow text-gold-soft">{col.heading}</h3>
              <ul className="mt-5 space-y-3">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-mist transition-colors hover:text-bone"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 border-t border-white/10 pt-8">
          <ul className="flex flex-wrap gap-x-8 gap-y-2 text-xs text-ash">
            {SHIPPING_SUMMARY.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p className="mt-6 text-xs text-ash">
            © {new Date().getFullYear()} Arkana. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

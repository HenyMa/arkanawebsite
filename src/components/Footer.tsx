import Link from "next/link";
import { Wordmark } from "./Logo";
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

/**
 * A light footer rather than a dark slab: the page keeps the same bone ground
 * from the header to the last line, and hairlines do the dividing. Every label
 * is micro-caps, so the footer reads as a directory instead of a panel.
 */
export function Footer() {
  return (
    <footer className="mt-32 border-t border-parchment px-5 sm:px-10">
      <div className="mx-auto max-w-[110rem]">
        <div className="grid gap-14 py-20 md:grid-cols-[1.6fr_repeat(3,1fr)]">
          <div>
            <Wordmark className="text-graphite" />
            <p className="mt-8 max-w-[15rem] text-xs leading-relaxed text-slate">
              Heavyweight essentials, made in small batches in northern
              Portugal. Fewer pieces, made properly.
            </p>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.heading}>
              <h3 className="eyebrow text-graphite">{col.heading}</h3>
              <ul className="mt-7 space-y-4">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="eyebrow text-slate transition-opacity hover:opacity-55"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-5 border-t border-parchment py-10 sm:flex-row sm:items-center sm:justify-between">
          <ul className="flex flex-wrap gap-x-8 gap-y-2">
            {SHIPPING_SUMMARY.map((line) => (
              <li key={line} className="eyebrow text-ash">
                {line}
              </li>
            ))}
          </ul>
          <p className="eyebrow shrink-0 text-ash">
            © {new Date().getFullYear()} Arkana
          </p>
        </div>
      </div>
    </footer>
  );
}

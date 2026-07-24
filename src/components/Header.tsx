"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useCart } from "@/lib/cart";
import { createClient } from "@/lib/supabase/client";
import { Mark, Wordmark } from "./Logo";

const NAV = [
  { href: "/hoodies", label: "Hoodies" },
  { href: "/rewards", label: "The Circle" },
  { href: "/about", label: "About" },
];

export function Header() {
  const { count, ready } = useCart();
  const pathname = usePathname();
  const [signedIn, setSignedIn] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Track auth so the account link reflects state without a full reload.
  useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;

    supabase.auth.getUser().then(({ data }) => setSignedIn(Boolean(data.user)));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) =>
      setSignedIn(Boolean(session?.user)),
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the mobile menu whenever the route changes.
  useEffect(() => setMenuOpen(false), [pathname]);

  return (
    <header className="sticky top-0 z-50">
      <div className="bg-graphite text-center text-[0.7rem] tracking-[0.18em] text-sand/90 uppercase">
        <p className="px-4 py-2.5">
          Complimentary standard shipping over $200 ·{" "}
          <Link href="/rewards" className="text-gold-soft link-underline">
            Join the Arkana Circle
          </Link>
        </p>
      </div>

      <div
        className={`border-b transition-colors duration-300 ${
          scrolled
            ? "border-parchment bg-bone/95 backdrop-blur-sm"
            : "border-transparent bg-bone"
        }`}
      >
        <nav className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-5 py-4 sm:gap-6 sm:px-8">
          {/* Desktop: left nav. Mobile: menu toggle. */}
          <div className="flex flex-1 items-center gap-7">
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              className="text-slate hover:text-graphite md:hidden"
              aria-expanded={menuOpen}
              aria-label="Toggle navigation menu"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                {menuOpen ? (
                  <path d="M6 6 L18 18 M18 6 L6 18" strokeLinecap="round" />
                ) : (
                  <path d="M3 7h18M3 12h18M3 17h18" strokeLinecap="round" />
                )}
              </svg>
            </button>

            <ul className="hidden items-center gap-7 md:flex">
              {NAV.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`eyebrow link-underline pb-0.5 transition-colors ${
                      pathname.startsWith(item.href)
                        ? "text-graphite"
                        : "text-slate hover:text-graphite"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <Link
            href="/"
            className="flex shrink-0 items-center gap-2.5 text-graphite"
            aria-label="Arkana — home"
          >
            <Mark className="h-6 w-6 text-gold" />
            <Wordmark />
          </Link>

          <div className="flex flex-1 items-center justify-end gap-4 sm:gap-6">
            <Link
              href={signedIn ? "/account" : "/login"}
              className="eyebrow link-underline whitespace-nowrap pb-0.5 text-slate transition-colors hover:text-graphite"
            >
              {signedIn ? "Account" : "Sign in"}
            </Link>
            <Link
              href="/cart"
              className="eyebrow link-underline whitespace-nowrap pb-0.5 text-slate transition-colors hover:text-graphite"
            >
              Cart
              <span className="ml-1 tabular-nums text-gold">
                ({ready ? count : 0})
              </span>
            </Link>
          </div>
        </nav>

        {menuOpen && (
          <ul className="border-t border-parchment bg-bone px-5 pb-4 md:hidden">
            {NAV.map((item) => (
              <li key={item.href} className="border-b border-linen last:border-0">
                <Link
                  href={item.href}
                  className="block py-3.5 font-display text-xl text-graphite"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </header>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useCart } from "@/lib/cart";
import { useSignedIn } from "@/lib/useSignedIn";
import { WELCOME_DISCOUNT_PERCENT } from "@/lib/rewards";
import { Wordmark } from "./Logo";
import { SearchOverlay } from "./SearchOverlay";

const NAV = [
  { href: "/shop", label: "Shop" },
  { href: "/rewards", label: "The Circle" },
  { href: "/about", label: "About" },
];

export function Header() {
  const { count, ready } = useCart();
  const pathname = usePathname();
  // Tracks auth so the account link reflects state without a full reload.
  const { signedIn } = useSignedIn();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  /*
    On the home page the header floats over the full-bleed hero rather than
    sitting on a bar of its own, and only takes a background once the page
    scrolls under it. Every other route gets an opaque sticky header.
  */
  const overlay = pathname === "/";
  const solid = scrolled || !overlay;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the mobile menu whenever the route changes.
  useEffect(() => setMenuOpen(false), [pathname]);

  // The full-screen menu covers the page, so stop the page behind it scrolling.
  useEffect(() => {
    if (!menuOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [menuOpen]);

  return (
    <header
      className={`${overlay ? "fixed" : "sticky"} inset-x-0 top-0 z-50 transition-colors duration-500 ${
        solid ? "bg-bone/95 backdrop-blur-sm" : "bg-transparent"
      }`}
    >
      <div
        className={`overflow-hidden transition-all duration-500 ${
          scrolled ? "max-h-0 opacity-0" : "max-h-12 opacity-100"
        }`}
      >
        <p className="px-5 py-3 text-center text-[0.625rem] uppercase tracking-[0.24em] text-clay">
          Free shipping worldwide · Members take {WELCOME_DISCOUNT_PERCENT}% off
          their first order ·{" "}
          <Link href="/rewards" className="link-underline text-graphite">
            Join the Circle
          </Link>
        </p>
      </div>

      <nav
        className={`mx-auto flex max-w-[110rem] items-center gap-3 px-5 pb-5 transition-all duration-500 sm:gap-6 sm:px-10 ${
          scrolled ? "pt-5" : "pt-1"
        }`}
      >
        {/* Desktop: left nav. Mobile: menu toggle. */}
        <div className="flex flex-1 items-center gap-8">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="eyebrow text-graphite transition-opacity hover:opacity-55 md:hidden"
            aria-expanded={menuOpen}
            aria-label="Open navigation menu"
          >
            Menu
          </button>

          <ul className="hidden items-center gap-8 md:flex">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`eyebrow transition-opacity hover:opacity-55 ${
                    pathname.startsWith(item.href)
                      ? "text-graphite"
                      : "text-slate"
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
          className="shrink-0 text-graphite transition-opacity hover:opacity-70"
          aria-label="Arkana — home"
        >
          <Wordmark />
        </Link>

        <div className="flex flex-1 items-center justify-end gap-5 sm:gap-8">
          <SearchOverlay />
          <Link
            href={signedIn ? "/account" : "/login"}
            className="eyebrow hidden whitespace-nowrap text-slate transition-opacity hover:opacity-55 sm:block"
          >
            {signedIn ? "Account" : "Sign in"}
          </Link>
          <Link
            href="/cart"
            className="eyebrow whitespace-nowrap text-graphite transition-opacity hover:opacity-55"
          >
            Cart <span className="tabular-nums">({ready ? count : 0})</span>
          </Link>
        </div>
      </nav>

      {/* Hairline that only appears once the header has a background. */}
      <div
        className={`h-px bg-parchment transition-opacity duration-500 ${
          solid && scrolled ? "opacity-100" : "opacity-0"
        }`}
      />

      {menuOpen && (
        <div className="animate-fade fixed inset-0 z-50 bg-bone md:hidden">
          <div className="flex items-center justify-between px-5 py-5">
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              className="eyebrow text-graphite"
              aria-label="Close navigation menu"
            >
              Close
            </button>
            <Wordmark />
            <span className="eyebrow invisible">Close</span>
          </div>

          <ul className="mt-10 px-5">
            {[
              ...NAV,
              { href: signedIn ? "/account" : "/login", label: signedIn ? "Account" : "Sign in" },
              { href: "/cart", label: "Cart" },
            ].map((item) => (
              <li key={item.label}>
                <Link
                  href={item.href}
                  className="display-line-sm block py-4 text-graphite"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </header>
  );
}

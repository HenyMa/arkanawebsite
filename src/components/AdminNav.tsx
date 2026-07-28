"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/returns", label: "Returns" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/members", label: "Members" },
];

export function AdminNav({ email }: { email: string | null }) {
  const pathname = usePathname();

  return (
    <div className="bg-graphite">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-8 gap-y-3 px-5 py-3.5 sm:px-8">
        <div className="flex flex-wrap items-center gap-x-7 gap-y-2">
          <span className="eyebrow text-gold-soft">Studio</span>
          <nav className="flex flex-wrap gap-x-6 gap-y-2">
            {LINKS.map((link) => {
              // /admin would otherwise light up on every child route.
              const active =
                link.href === "/admin"
                  ? pathname === "/admin"
                  : pathname.startsWith(link.href);

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`eyebrow transition-colors ${
                    active ? "text-bone" : "text-mist hover:text-bone"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-5">
          {email && <span className="text-xs text-ash">{email}</span>}
          <Link
            href="/"
            className="eyebrow text-mist transition-colors hover:text-bone"
          >
            Storefront ↗
          </Link>
        </div>
      </div>
    </div>
  );
}

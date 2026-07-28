import type { Metadata } from "next";
import Link from "next/link";
import { ProductCard } from "@/components/ProductCard";
import {
  CATEGORIES,
  PRODUCTS,
  categoryPath,
  formatPrice,
} from "@/lib/products";

export const metadata: Metadata = {
  title: "Shop",
  description:
    "A hoodie, a sweatshirt, a sweatpant, and a zip-up jacket in garment-dyed cotton, made in small batches in Portugal.",
};

export default function ShopPage() {
  return (
    <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8">
      <header className="max-w-2xl">
        <p className="eyebrow text-clay">The Collection</p>
        <h1 className="mt-3 font-display text-5xl font-light text-graphite sm:text-6xl">
          Shop
        </h1>
        <p className="mt-6 text-[0.95rem] leading-relaxed text-slate">
          Four garments, one of each. Every piece is garment-dyed after
          construction, so colour settles into the seams and softens with wear.
          Batches are small and never restocked in exactly the same tone.
        </p>
      </header>

      {/* One price per garment type, stated plainly rather than hidden on the
          product page. */}
      <nav className="mt-12 grid gap-px border border-parchment bg-parchment sm:grid-cols-2 lg:grid-cols-4">
        {CATEGORIES.map((category) => (
          <Link
            key={category.slug}
            href={categoryPath(category.slug)}
            className="bg-bone px-6 py-7 transition-colors hover:bg-linen"
          >
            <p className="font-display text-2xl text-graphite">{category.name}</p>
            <p className="mt-2 text-sm tabular-nums text-gold-deep">
              {formatPrice(category.priceCents)}
            </p>
            <p className="mt-3 text-xs leading-relaxed text-ash">
              {category.tagline}
            </p>
          </Link>
        ))}
      </nav>

      <div className="rule-gold mt-16" />

      {/*
        A single grid rather than a section per category: with one piece in each,
        four headings above four lone cards would be all chrome and no catalogue.
        Category pages still exist for anyone who wants to narrow down.
      */}
      <div className="mt-14 grid gap-x-8 gap-y-16 sm:grid-cols-2 lg:grid-cols-4">
        {PRODUCTS.map((product) => (
          <ProductCard key={product.slug} product={product} />
        ))}
      </div>

      <p className="mt-20 text-center text-sm text-ash">
        Free shipping on every order. Free returns within 30 days.
      </p>
    </div>
  );
}

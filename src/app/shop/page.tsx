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
    <div className="px-5 py-20 sm:px-10 sm:py-28">
      <div className="mx-auto max-w-[110rem]">
        <header className="text-center">
          <h1 className="section-title text-graphite">The Collection</h1>
          <p className="mx-auto mt-7 max-w-md text-sm leading-relaxed text-slate">
            Four garments, one of each. Every piece is garment-dyed after
            construction, so colour settles into the seams and softens with
            wear. Batches are small and never restocked in exactly the same
            tone.
          </p>
        </header>

        {/* One price per garment type, stated plainly as a filter row rather
            than hidden on the product page. */}
        <nav className="mt-16 border-y border-parchment">
          <ul className="mx-auto flex flex-wrap items-center justify-center gap-x-12 gap-y-4 py-6">
            {CATEGORIES.map((category) => (
              <li key={category.slug}>
                <Link
                  href={categoryPath(category.slug)}
                  className="eyebrow text-graphite transition-opacity hover:opacity-55"
                >
                  {category.name}
                  <span className="ml-3 tabular-nums text-mist">
                    {formatPrice(category.priceCents)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/*
          A single grid rather than a section per category: with one piece in
          each, four headings above four lone tiles would be all chrome and no
          catalogue. Category pages still exist for anyone who wants to narrow
          down.
        */}
        <div className="mt-20 grid gap-x-10 gap-y-20 sm:grid-cols-2 lg:grid-cols-4">
          {PRODUCTS.map((product) => (
            <ProductCard key={product.slug} product={product} />
          ))}
        </div>

        <p className="eyebrow mt-28 text-center text-ash">
          Free shipping on every order · Free returns within 30 days
        </p>
      </div>
    </div>
  );
}

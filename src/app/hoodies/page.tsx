import type { Metadata } from "next";
import { ProductCard } from "@/components/ProductCard";
import { PRODUCTS } from "@/lib/products";

export const metadata: Metadata = {
  title: "Hoodies",
  description:
    "Three heavyweight hoodies in garment-dyed cotton, made in small batches in Portugal.",
};

export default function HoodiesPage() {
  return (
    <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8">
      <header className="max-w-2xl">
        <p className="eyebrow text-clay">The Collection</p>
        <h1 className="mt-3 font-display text-5xl font-light text-graphite sm:text-6xl">
          Hoodies
        </h1>
        <p className="mt-6 text-[0.95rem] leading-relaxed text-slate">
          Every piece is garment-dyed after construction, so colour settles into
          the seams and softens with wear. Batches are small and never restocked
          in exactly the same tone.
        </p>
      </header>

      <div className="rule-gold mt-12" />

      <div className="mt-14 grid gap-x-8 gap-y-16 sm:grid-cols-2 lg:grid-cols-3">
        {PRODUCTS.map((product) => (
          <ProductCard key={product.slug} product={product} />
        ))}
      </div>

      <p className="mt-20 text-center text-sm text-ash">
        More categories are on the way. Hoodies first — properly.
      </p>
    </div>
  );
}

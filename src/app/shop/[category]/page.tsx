import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductCard } from "@/components/ProductCard";
import {
  CATEGORIES,
  categoryPath,
  formatPrice,
  getCategory,
  productsInCategory,
} from "@/lib/products";

type Params = { params: Promise<{ category: string }> };

export function generateStaticParams() {
  return CATEGORIES.map((c) => ({ category: c.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const category = getCategory((await params).category);
  if (!category) return { title: "Not found" };
  return {
    title: category.name,
    description: category.description,
  };
}

export default async function CategoryPage({ params }: Params) {
  const category = getCategory((await params).category);
  if (!category) notFound();

  const products = productsInCategory(category.slug);
  const others = CATEGORIES.filter((c) => c.slug !== category.slug);

  return (
    <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8">
      <nav className="text-xs text-ash">
        <Link href="/shop" className="hover:text-slate">
          Shop
        </Link>
        <span className="mx-2">/</span>
        <span className="text-slate">{category.name}</span>
      </nav>

      <header className="mt-8 max-w-2xl">
        <p className="eyebrow text-clay">The Collection</p>
        <h1 className="mt-3 font-display text-5xl font-light text-graphite sm:text-6xl">
          {category.name}
        </h1>
        <p className="mt-5 text-lg tabular-nums text-gold-deep">
          {formatPrice(category.priceCents)}
          <span className="ml-3 text-sm text-ash">
            every {category.singular.toLowerCase()}, free shipping
          </span>
        </p>
        <p className="mt-6 text-[0.95rem] leading-relaxed text-slate">
          {category.description}
        </p>
      </header>

      <div className="rule-gold mt-12" />

      <div className="mt-14 grid gap-x-8 gap-y-16 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => (
          <ProductCard key={product.slug} product={product} />
        ))}
      </div>

      <nav className="mt-24 border-t border-parchment pt-10">
        <p className="eyebrow text-clay">Also in the collection</p>
        <ul className="mt-6 flex flex-wrap gap-x-10 gap-y-3">
          {others.map((other) => (
            <li key={other.slug}>
              <Link
                href={categoryPath(other.slug)}
                className="font-display text-2xl text-graphite link-underline pb-1"
              >
                {other.name}
                <span className="ml-3 text-sm tabular-nums text-ash">
                  {formatPrice(other.priceCents)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

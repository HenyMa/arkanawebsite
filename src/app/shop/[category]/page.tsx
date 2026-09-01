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
    <div className="px-5 py-20 sm:px-10 sm:py-28">
      <div className="mx-auto max-w-[110rem]">
        <nav className="eyebrow text-ash">
          <Link href="/shop" className="transition-opacity hover:opacity-55">
            Shop
          </Link>
          <span className="mx-3">/</span>
          <span className="text-slate">{category.name}</span>
        </nav>

        <header className="mt-16 text-center">
          <h1 className="section-title text-graphite">{category.name}</h1>
          <p className="eyebrow mt-5 tabular-nums text-slate">
            {formatPrice(category.priceCents)} · every{" "}
            {category.singular.toLowerCase()}
          </p>
          <p className="mx-auto mt-7 max-w-md text-sm leading-relaxed text-slate">
            {category.description}
          </p>
        </header>

        <div className="mt-20 grid gap-x-10 gap-y-20 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <ProductCard key={product.slug} product={product} />
          ))}
        </div>

        <nav className="mt-32 border-t border-parchment pt-10">
          <p className="eyebrow text-center text-ash">
            Also in the collection
          </p>
          <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-12 gap-y-4">
            {others.map((other) => (
              <li key={other.slug}>
                <Link
                  href={categoryPath(other.slug)}
                  className="eyebrow text-graphite transition-opacity hover:opacity-55"
                >
                  {other.name}
                  <span className="ml-3 tabular-nums text-mist">
                    {formatPrice(other.priceCents)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ProductGallery } from "@/components/ProductGallery";
import { ProductPurchase } from "@/components/ProductPurchase";
import { ProductCard } from "@/components/ProductCard";
import {
  PRODUCTS,
  categoryPath,
  formatPrice,
  getCategory,
  getProduct,
  productPath,
  productsInCategory,
} from "@/lib/products";
import { SHIPPING_SUMMARY } from "@/lib/shipping";
import { POINTS_PER_DOLLAR } from "@/lib/rewards";
import { RETURN_WINDOW_DAYS } from "@/lib/returns";

type Params = { params: Promise<{ category: string; slug: string }> };

export function generateStaticParams() {
  return PRODUCTS.map((p) => ({ category: p.category, slug: p.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const product = getProduct((await params).slug);
  if (!product) return { title: "Not found" };
  return {
    title: product.name,
    description: product.description,
    openGraph: {
      title: `${product.name} — Arkana`,
      description: product.tagline,
      images: [product.images[0]],
    },
  };
}

export default async function ProductPage({ params }: Params) {
  const { category: categorySlug, slug } = await params;

  const product = getProduct(slug);
  if (!product) notFound();

  // Slugs are unique across the catalogue, so a product reached under the wrong
  // category is a stale link rather than a 404 — send it to the canonical URL.
  if (product.category !== categorySlug) redirect(productPath(product));

  const category = getCategory(product.category);
  if (!category) notFound();

  const others = productsInCategory(product.category).filter(
    (p) => p.slug !== product.slug,
  );
  const pointsEarned = Math.floor(
    (product.priceCents / 100) * POINTS_PER_DOLLAR,
  );

  return (
    <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8">
      <nav className="text-xs text-ash">
        <Link href="/shop" className="hover:text-slate">
          Shop
        </Link>
        <span className="mx-2">/</span>
        <Link href={categoryPath(category.slug)} className="hover:text-slate">
          {category.name}
        </Link>
        <span className="mx-2">/</span>
        <span className="text-slate">{product.name}</span>
      </nav>

      <div className="mt-8 grid gap-12 lg:grid-cols-[1.15fr_1fr] lg:gap-20">
        <ProductGallery
          images={product.images}
          alt={`${product.name} in ${product.colorway}`}
        />

        <div className="lg:sticky lg:top-32 lg:self-start">
          <p className="eyebrow text-clay">{product.colorway}</p>
          <h1 className="mt-3 font-display text-4xl font-light text-graphite sm:text-5xl">
            {product.name}
          </h1>
          <p className="mt-4 text-lg tabular-nums text-slate">
            {formatPrice(product.priceCents)}
          </p>

          <p className="mt-7 text-[0.95rem] leading-relaxed text-slate">
            {product.description}
          </p>

          <div className="mt-9">
            <ProductPurchase product={product} />
          </div>

          <p className="mt-5 text-center text-xs text-ash">
            Earns {pointsEarned} points ·{" "}
            <Link href="/rewards" className="text-gold-deep link-underline">
              The Arkana Circle
            </Link>
          </p>

          <div className="mt-10 border-t border-parchment pt-8">
            <h2 className="eyebrow text-clay">Details</h2>
            <ul className="mt-4 space-y-2.5 text-sm text-slate">
              {product.details.map((detail) => (
                <li key={detail} className="flex gap-3">
                  <span
                    className="mt-2 h-px w-4 shrink-0 bg-tan"
                    aria-hidden="true"
                  />
                  {detail}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-8 border-t border-parchment pt-8">
            <h2 className="eyebrow text-clay">Shipping &amp; returns</h2>
            <ul className="mt-4 space-y-2 text-sm text-slate">
              {SHIPPING_SUMMARY.map((line) => (
                <li key={line}>{line}</li>
              ))}
              <li>
                Free returns within {RETURN_WINDOW_DAYS} days, unworn with tags
                attached —{" "}
                <Link href="/shipping" className="text-gold-deep link-underline">
                  how returns work
                </Link>
                .
              </li>
            </ul>
          </div>
        </div>
      </div>

      {others.length > 0 && (
        <section className="mt-28">
          <div className="rule-gold" />
          <h2 className="mt-10 font-display text-3xl font-light text-graphite">
            More {category.name.toLowerCase()}
          </h2>
          <div className="mt-8 grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {others.map((p) => (
              <ProductCard key={p.slug} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

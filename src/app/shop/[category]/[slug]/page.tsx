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
    <div className="px-5 py-10 sm:px-10">
      <nav className="eyebrow text-ash">
        <Link href="/shop" className="transition-opacity hover:opacity-55">
          Shop
        </Link>
        <span className="mx-3">/</span>
        <Link
          href={categoryPath(category.slug)}
          className="transition-opacity hover:opacity-55"
        >
          {category.name}
        </Link>
        <span className="mx-3">/</span>
        <span className="text-slate">{product.name}</span>
      </nav>

      <div className="mt-10 grid gap-14 lg:grid-cols-[1.4fr_1fr] lg:gap-24">
        <ProductGallery
          images={product.images}
          alt={`${product.name} in ${product.colorway}`}
        />

        {/* The buy column stays put while the image stack scrolls past it. */}
        <div className="lg:sticky lg:top-28 lg:self-start lg:pt-10">
          <h1 className="section-title text-graphite">{product.name}</h1>
          <p className="eyebrow mt-4 tabular-nums text-slate">
            {formatPrice(product.priceCents)}
          </p>
          <p className="eyebrow mt-2 text-mist">{product.colorway}</p>

          <p className="mt-9 max-w-md text-sm leading-relaxed text-slate">
            {product.description}
          </p>

          <div className="mt-11">
            <ProductPurchase product={product} />
          </div>

          <p className="eyebrow mt-6 text-ash">
            Earns {pointsEarned} points ·{" "}
            <Link href="/rewards" className="link-underline text-slate">
              The Arkana Circle
            </Link>
          </p>

          {/*
            Details and shipping are collapsed by default. Native <details>
            keeps this a server component and works without JavaScript.
          */}
          <div className="mt-14">
            <details className="group border-t border-parchment">
              <summary className="eyebrow flex cursor-pointer list-none items-center justify-between py-5 text-graphite marker:content-none">
                Details
                <span
                  aria-hidden="true"
                  className="text-ash transition-transform duration-300 group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <ul className="space-y-3 pb-7 text-xs leading-relaxed text-slate">
                {product.details.map((detail) => (
                  <li key={detail}>{detail}</li>
                ))}
              </ul>
            </details>

            <details className="group border-y border-parchment">
              <summary className="eyebrow flex cursor-pointer list-none items-center justify-between py-5 text-graphite marker:content-none">
                Shipping &amp; returns
                <span
                  aria-hidden="true"
                  className="text-ash transition-transform duration-300 group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <ul className="space-y-3 pb-7 text-xs leading-relaxed text-slate">
                {SHIPPING_SUMMARY.map((line) => (
                  <li key={line}>{line}</li>
                ))}
                <li>
                  Free returns within {RETURN_WINDOW_DAYS} days, unworn with
                  tags attached —{" "}
                  <Link href="/shipping" className="link-underline text-graphite">
                    how returns work
                  </Link>
                  .
                </li>
              </ul>
            </details>
          </div>
        </div>
      </div>

      {others.length > 0 && (
        <section className="mt-32 border-t border-parchment pt-20">
          <h2 className="section-title text-center text-graphite">
            More {category.name.toLowerCase()}
          </h2>
          <div className="mt-16 grid gap-x-10 gap-y-20 sm:grid-cols-2 lg:grid-cols-3">
            {others.map((p) => (
              <ProductCard key={p.slug} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

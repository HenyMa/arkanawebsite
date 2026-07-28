import type { Metadata } from "next";
import Link from "next/link";
import { ButtonLink } from "@/components/Button";
import { ProductCard } from "@/components/ProductCard";
import { SearchResultRow } from "@/components/SearchResultRow";
import { CATEGORIES, PRODUCTS, categoryPath, formatPrice } from "@/lib/products";
import { SUGGESTED_QUERIES, search } from "@/lib/search";

export const metadata: Metadata = {
  title: "Search",
  robots: { index: false },
};

type Props = { searchParams: Promise<{ q?: string }> };

const MAX_RESULTS = 20;

/**
 * Full search results.
 *
 * A plain server-rendered page reading `?q=` — the header overlay is a
 * convenience on top of this, not a replacement for it, so search still works
 * with JavaScript off and every result set has a URL worth sharing.
 */
export default async function SearchPage({ searchParams }: Props) {
  const query = ((await searchParams).q ?? "").trim();
  const { results, relaxed } = search(query, MAX_RESULTS);

  return (
    <div className="mx-auto max-w-3xl px-5 py-20 sm:px-8">
      <p className="eyebrow text-clay">Search</p>
      <h1 className="mt-3 font-display text-5xl font-light text-graphite">
        {query ? <>&ldquo;{query}&rdquo;</> : "Search"}
      </h1>

      {/* GET form: no JavaScript needed, and the results stay linkable. */}
      <form action="/search" method="get" className="mt-9">
        <label htmlFor="q" className="sr-only">
          Search Arkana
        </label>
        <div className="flex border border-sand focus-within:border-gold">
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={query}
            placeholder="Hoodie, sweatpants, returns…"
            autoComplete="off"
            className="w-full bg-bone px-4 py-3.5 text-sm text-graphite placeholder:text-mist focus:outline-none"
          />
          <button
            type="submit"
            className="shrink-0 bg-graphite px-7 text-[0.7rem] font-medium uppercase tracking-[0.22em] text-bone transition-colors hover:bg-gold-deep"
          >
            Search
          </button>
        </div>
      </form>

      <div className="rule-gold mt-10" />

      {!query ? (
        <EmptyState />
      ) : results.length === 0 ? (
        <NoResults query={query} />
      ) : (
        <section className="mt-10">
          <p className="text-xs text-ash">
            {relaxed ? (
              <>
                Nothing matched everything you typed. Here&apos;s the closest we
                have.
              </>
            ) : (
              <>
                {results.length} result{results.length === 1 ? "" : "s"}
              </>
            )}
          </p>

          <div className="mt-6 border border-parchment">
            {results.map((result) => (
              <SearchResultRow key={`${result.kind}-${result.id}`} result={result} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/** Nothing typed yet — show the whole (small) catalogue rather than a blank page. */
function EmptyState() {
  return (
    <section className="mt-10">
      <p className="eyebrow text-clay">Try</p>
      <ul className="mt-4 flex flex-wrap gap-3">
        {SUGGESTED_QUERIES.map((suggestion) => (
          <li key={suggestion}>
            <Link
              href={`/search?q=${encodeURIComponent(suggestion)}`}
              className="border border-sand px-4 py-2 text-sm text-graphite transition-colors hover:border-gold hover:bg-linen"
            >
              {suggestion}
            </Link>
          </li>
        ))}
      </ul>

      <p className="eyebrow mt-12 text-clay">Everything we make</p>
      <div className="mt-6 grid gap-x-8 gap-y-12 sm:grid-cols-2">
        {PRODUCTS.map((product) => (
          <ProductCard key={product.slug} product={product} />
        ))}
      </div>
    </section>
  );
}

function NoResults({ query }: { query: string }) {
  return (
    <section className="mt-10">
      <p className="text-[0.95rem] leading-relaxed text-slate">
        Nothing here matches <span className="text-graphite">{query}</span>. The
        range is deliberately short — four garments, one of each.
      </p>

      <ul className="mt-8 grid gap-px border border-parchment bg-parchment sm:grid-cols-2">
        {CATEGORIES.map((category) => (
          <li key={category.slug}>
            <Link
              href={categoryPath(category.slug)}
              className="block bg-bone px-6 py-6 transition-colors hover:bg-linen"
            >
              <p className="font-display text-xl text-graphite">
                {category.name}
              </p>
              <p className="mt-1.5 text-sm tabular-nums text-gold-deep">
                {formatPrice(category.priceCents)}
              </p>
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-10 flex flex-wrap gap-4">
        <ButtonLink href="/shop">Shop everything</ButtonLink>
        <ButtonLink href="/shipping" variant="outline">
          Shipping &amp; returns
        </ButtonLink>
      </div>
    </section>
  );
}

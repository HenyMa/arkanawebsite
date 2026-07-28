import Image from "next/image";
import Link from "next/link";
import { formatPrice } from "@/lib/products";
import type { SearchResult } from "@/lib/search";

const KIND_LABEL: Record<SearchResult["kind"], string> = {
  product: "Product",
  category: "Collection",
  page: "Page",
};

/**
 * One search hit. Shared by /search and the header overlay so a result looks
 * and reads the same wherever it is found.
 */
export function SearchResultRow({
  result,
  active = false,
}: {
  result: SearchResult;
  active?: boolean;
}) {
  return (
    <Link
      href={result.href}
      data-active={active || undefined}
      /* The active row is keyboard-driven, so it needs a marker that survives
         a glance — linen on bone alone is too close to read as "selected". */
      className={`flex items-center gap-5 border-b border-parchment border-l-2 px-4 py-4 transition-colors last:border-b-0 ${
        active
          ? "border-l-gold bg-linen"
          : "border-l-transparent hover:bg-linen/60"
      }`}
    >
      {result.image ? (
        <div className="relative aspect-[4/5] w-12 shrink-0 overflow-hidden bg-linen">
          <Image
            src={result.image}
            alt=""
            fill
            sizes="48px"
            className="object-cover"
          />
        </div>
      ) : (
        <div className="flex aspect-[4/5] w-12 shrink-0 items-center justify-center bg-linen">
          <span className="h-px w-4 bg-tan" aria-hidden="true" />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-lg text-graphite">
          {result.title}
        </p>
        <p className="mt-0.5 truncate text-xs text-ash">{result.subtitle}</p>
      </div>

      <div className="shrink-0 text-right">
        {result.priceCents !== undefined ? (
          <p className="text-sm tabular-nums text-slate">
            {formatPrice(result.priceCents)}
          </p>
        ) : (
          <p className="text-[0.65rem] uppercase tracking-[0.18em] text-ash">
            {KIND_LABEL[result.kind]}
          </p>
        )}
      </div>
    </Link>
  );
}

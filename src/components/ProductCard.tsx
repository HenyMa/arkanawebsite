import Image from "next/image";
import Link from "next/link";
import { formatPrice, productPath, type Product } from "@/lib/products";

export function ProductCard({ product }: { product: Product }) {
  const soldOut = product.inStock.length === 0;

  return (
    <Link href={productPath(product)} className="group block">
      <div className="relative aspect-[4/5] overflow-hidden bg-linen">
        <Image
          src={product.images[0]}
          alt={`${product.name} in ${product.colorway}`}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          className="object-cover transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.04]"
        />
        {/* Second image cross-fades in on hover for a catalogue feel. */}
        {product.images[1] && (
          <Image
            src={product.images[1]}
            alt=""
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="object-cover opacity-0 transition-opacity duration-500 group-hover:opacity-100"
          />
        )}
        {soldOut && (
          <span className="absolute left-4 top-4 bg-graphite px-3 py-1.5 text-[0.65rem] uppercase tracking-[0.2em] text-bone">
            Sold out
          </span>
        )}
      </div>

      <div className="mt-5 flex items-baseline justify-between gap-4">
        <h3 className="font-display text-xl text-graphite">{product.name}</h3>
        <p className="text-sm tabular-nums text-slate">
          {formatPrice(product.priceCents)}
        </p>
      </div>
      <p className="mt-1 text-sm text-ash">
        {product.colorway} · {product.tagline}
      </p>
    </Link>
  );
}

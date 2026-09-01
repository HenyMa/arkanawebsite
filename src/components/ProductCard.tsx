import Image from "next/image";
import Link from "next/link";
import { formatPrice, productPath, type Product } from "@/lib/products";

/**
 * A catalogue tile: image, then a centred micro-caps caption. No border, no
 * card, no shadow — the image sits directly on the page and the whitespace
 * around it does the separating. The second shot cross-fades in on hover in
 * place of a zoom, so the grid stays perfectly still as the cursor moves.
 */
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
          className={`object-cover transition-opacity duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            /* Only fade the first shot out if there is a second to reveal. */
            product.images[1] ? "group-hover:opacity-0" : ""
          }`}
        />
        {product.images[1] && (
          <Image
            src={product.images[1]}
            alt=""
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="object-cover opacity-0 transition-opacity duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:opacity-100"
          />
        )}
      </div>

      <div className="mt-6 text-center">
        <h3 className="eyebrow text-graphite">{product.name}</h3>
        <p className="eyebrow mt-2 tabular-nums text-slate">
          {formatPrice(product.priceCents)}
        </p>
        <p className="eyebrow mt-2 text-mist">
          {soldOut ? "Sold out" : product.colorway}
        </p>
      </div>
    </Link>
  );
}

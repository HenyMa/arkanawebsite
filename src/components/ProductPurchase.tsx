"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "./Button";
import { useCart } from "@/lib/cart";
import { SIZES, type Product, type Size } from "@/lib/products";

/** Fit notes differ by garment type, so they live with the categories. */
const FIT_NOTES: Record<string, string> = {
  hoodies:
    "Cut boxy. Between sizes? Take the smaller for a cropped fit or the larger for a relaxed drape.",
  sweatshirts:
    "Cut boxy, on the same block as the hoodies. Between sizes, take the smaller — there is no hood to pull the body back.",
  sweatpants:
    "Straight through the thigh with a taper below the knee. Take your usual waist; the ribbed waistband has give.",
  "zip-ups":
    "Cut to layer over a hoodie or a tee. Between sizes, take the larger if you plan to wear one underneath.",
};

export function ProductPurchase({ product }: { product: Product }) {
  const { add } = useCart();
  const [size, setSize] = useState<Size | null>(null);
  const [error, setError] = useState(false);
  const [added, setAdded] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

  // Clear the "Added" confirmation after a beat.
  useEffect(() => {
    if (!added) return;
    const t = setTimeout(() => setAdded(false), 3500);
    return () => clearTimeout(t);
  }, [added]);

  const soldOut = product.inStock.length === 0;

  function handleAdd() {
    if (!size) {
      setError(true);
      return;
    }
    add(product.slug, size);
    setError(false);
    setAdded(true);
  }

  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <p className="eyebrow text-clay">Size</p>
        <button
          type="button"
          className="text-xs text-ash underline underline-offset-4 hover:text-slate"
          onClick={() => setGuideOpen((o) => !o)}
          aria-expanded={guideOpen}
        >
          Size guide
        </button>
      </div>

      {guideOpen && (
        <p className="animate-rise mt-3 border-l border-tan pl-4 text-xs leading-relaxed text-slate">
          {FIT_NOTES[product.category] ??
            "Between sizes? Take the smaller for a closer fit, the larger for a relaxed one."}
        </p>
      )}

      <div className="mt-3 grid grid-cols-5 gap-2">
        {SIZES.map((s) => {
          const available = product.inStock.includes(s);
          const selected = size === s;
          return (
            <button
              key={s}
              type="button"
              disabled={!available}
              onClick={() => {
                setSize(s);
                setError(false);
              }}
              aria-pressed={selected}
              className={`border py-3 text-xs tracking-[0.12em] transition-colors ${
                selected
                  ? "border-graphite bg-graphite text-bone"
                  : available
                    ? "border-sand text-graphite hover:border-gold"
                    : "cursor-not-allowed border-linen text-mist line-through"
              }`}
            >
              {s}
            </button>
          );
        })}
      </div>

      {error && (
        <p className="mt-3 text-xs text-gold-deep">Choose a size to continue.</p>
      )}

      <div className="mt-7 flex flex-col gap-3">
        <Button onClick={handleAdd} disabled={soldOut} className="w-full">
          {soldOut ? "Sold out" : "Add to cart"}
        </Button>

        {added && (
          <p className="animate-rise text-center text-xs text-slate">
            Added to your cart ·{" "}
            <Link href="/cart" className="text-gold-deep link-underline">
              Check out
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}

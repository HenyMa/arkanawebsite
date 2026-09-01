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
        <p className="eyebrow text-graphite">Size</p>
        <button
          type="button"
          className="eyebrow text-ash transition-opacity hover:opacity-55"
          onClick={() => setGuideOpen((o) => !o)}
          aria-expanded={guideOpen}
        >
          Size guide
        </button>
      </div>

      {guideOpen && (
        <p className="animate-rise mt-4 text-xs leading-relaxed text-slate">
          {FIT_NOTES[product.category] ??
            "Between sizes? Take the smaller for a closer fit, the larger for a relaxed one."}
        </p>
      )}

      {/* Hairline row of sizes: one shared grid, borders collapsed by a gap of
          a single pixel over a parchment ground. */}
      <div className="mt-5 grid grid-cols-5 gap-px bg-parchment">
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
              className={`py-4 text-[0.625rem] uppercase tracking-[0.2em] transition-colors duration-300 ${
                selected
                  ? "bg-graphite text-bone"
                  : available
                    ? "bg-bone text-graphite hover:bg-linen"
                    : "cursor-not-allowed bg-bone text-mist line-through"
              }`}
            >
              {s}
            </button>
          );
        })}
      </div>

      {error && (
        <p className="eyebrow mt-4 text-clay">Choose a size to continue.</p>
      )}

      <div className="mt-8 flex flex-col gap-4">
        <Button onClick={handleAdd} disabled={soldOut} className="w-full">
          {soldOut ? "Sold out" : "Add to cart"}
        </Button>

        {added && (
          <p className="eyebrow animate-rise text-center text-slate">
            Added to your cart ·{" "}
            <Link href="/cart" className="link-underline text-graphite">
              Check out
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}

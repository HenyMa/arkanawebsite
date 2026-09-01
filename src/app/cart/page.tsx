"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Button, ButtonLink } from "@/components/Button";
import { useCart } from "@/lib/cart";
import { useSignedIn } from "@/lib/useSignedIn";
import { formatPrice, productPathBySlug } from "@/lib/products";
import { SHIPPING_SUMMARY } from "@/lib/shipping";
import { POINTS_PER_DOLLAR, WELCOME_DISCOUNT_PERCENT } from "@/lib/rewards";
import { RETURN_WINDOW_DAYS } from "@/lib/returns";

export default function CartPage() {
  const { resolved, subtotalCents, setQuantity, remove, ready } = useCart();
  const { signedIn } = useSignedIn();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function checkout() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lines: resolved.map((l) => ({
            slug: l.slug,
            size: l.size,
            quantity: l.quantity,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }
      // Hand off to Stripe. The cart is cleared on the success page so it
      // survives a customer backing out of Checkout.
      window.location.href = data.url;
    } catch {
      setError("Could not reach the checkout service. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!ready) {
    return <div className="mx-auto max-w-6xl px-5 py-24 sm:px-10" />;
  }

  if (resolved.length === 0) {
    return (
      <div className="mx-auto max-w-md px-5 py-40 text-center sm:px-10">
        <h1 className="section-title text-graphite">Your cart is empty</h1>
        <p className="mt-7 text-sm leading-relaxed text-slate">
          Hoodies, sweatshirts, sweatpants, and zip-ups — made in small batches.
          Start there.
        </p>
        <div className="mt-11">
          <ButtonLink href="/shop" variant="link">
            Shop the collection
          </ButtonLink>
        </div>
      </div>
    );
  }

  const pointsEarned = Math.floor((subtotalCents / 100) * POINTS_PER_DOLLAR);

  return (
    <div className="mx-auto max-w-6xl px-5 py-16 sm:px-10">
      <h1 className="section-title text-center text-graphite">Cart</h1>

      <div className="mt-16 grid gap-16 lg:grid-cols-[1.6fr_1fr]">
        <ul className="divide-y divide-parchment border-y border-parchment">
          {resolved.map((line) => (
            <li key={`${line.slug}-${line.size}`} className="flex gap-6 py-8">
              <Link
                href={productPathBySlug(line.slug)}
                className="relative aspect-[4/5] w-24 shrink-0 overflow-hidden bg-linen sm:w-28"
              >
                <Image
                  src={line.image}
                  alt={line.name}
                  fill
                  sizes="112px"
                  className="object-cover"
                />
              </Link>

              <div className="flex flex-1 flex-col justify-between">
                <div className="flex justify-between gap-4">
                  <div>
                    <Link
                      href={productPathBySlug(line.slug)}
                      className="eyebrow text-graphite transition-opacity hover:opacity-55"
                    >
                      {line.name}
                    </Link>
                    <p className="eyebrow mt-3 text-mist">
                      {line.colorway} · Size {line.size}
                    </p>
                  </div>
                  <p className="eyebrow tabular-nums text-slate">
                    {formatPrice(line.lineTotalCents)}
                  </p>
                </div>

                <div className="mt-4 flex items-center justify-between gap-4">
                  <div className="flex items-center border border-parchment">
                    <button
                      type="button"
                      onClick={() =>
                        setQuantity(line.slug, line.size, line.quantity - 1)
                      }
                      className="px-3 py-1.5 text-slate hover:text-graphite"
                      aria-label={`Decrease quantity of ${line.name}`}
                    >
                      −
                    </button>
                    <span className="w-8 text-center text-sm tabular-nums">
                      {line.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setQuantity(line.slug, line.size, line.quantity + 1)
                      }
                      className="px-3 py-1.5 text-slate hover:text-graphite"
                      aria-label={`Increase quantity of ${line.name}`}
                    >
                      +
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => remove(line.slug, line.size)}
                    className="eyebrow text-ash underline underline-offset-4 transition-opacity hover:opacity-55"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>

        {/* ------------------------------------------------------------ Summary */}
        <aside className="h-fit border-t border-parchment pt-8 lg:sticky lg:top-32">
          <h2 className="eyebrow text-graphite">Summary</h2>

          <dl className="mt-8 space-y-4">
            <div className="flex justify-between">
              <dt className="eyebrow text-slate">Subtotal</dt>
              <dd className="eyebrow tabular-nums text-graphite">
                {formatPrice(subtotalCents)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="eyebrow text-slate">Standard shipping</dt>
              <dd className="eyebrow text-graphite">Free</dd>
            </div>
          </dl>

          {/* The discount is applied by the checkout route, which is the only
              place that can tell whether this member is still eligible. */}
          <p className="mt-8 border-t border-parchment pt-6 text-xs leading-relaxed text-slate">
            Members take {WELCOME_DISCOUNT_PERCENT}% off their first order — it
            comes off at checkout automatically.
            {!signedIn && (
              <>
                {" "}
                <Link href="/signup" className="link-underline text-graphite">
                  Join the Circle
                </Link>
                .
              </>
            )}
          </p>

          <p className="mt-2 text-xs text-ash">
            Earns {pointsEarned} points before any discount
          </p>

          <Button onClick={checkout} disabled={busy} className="mt-9 w-full">
            {busy ? "Redirecting…" : "Checkout"}
          </Button>

          {error && (
            <p className="mt-5 border-l border-clay pl-4 text-xs leading-relaxed text-graphite">
              {error}
            </p>
          )}

          <ul className="mt-9 space-y-2 border-t border-parchment pt-6 text-xs text-ash">
            {SHIPPING_SUMMARY.map((line) => (
              <li key={line}>{line}</li>
            ))}
            <li>
              Free returns within {RETURN_WINDOW_DAYS} days ·{" "}
              <Link href="/shipping" className="link-underline text-slate">
                how it works
              </Link>
            </li>
          </ul>
        </aside>
      </div>
    </div>
  );
}

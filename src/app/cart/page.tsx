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
    return <div className="mx-auto max-w-6xl px-5 py-24 sm:px-8" />;
  }

  if (resolved.length === 0) {
    return (
      <div className="mx-auto max-w-md px-5 py-32 text-center sm:px-8">
        <h1 className="font-display text-4xl font-light text-graphite">
          Your cart is empty
        </h1>
        <p className="mt-4 text-sm text-slate">
          Hoodies, sweatshirts, sweatpants, and zip-ups — made in small batches.
          Start there.
        </p>
        <ButtonLink href="/shop" className="mt-9">
          Shop the collection
        </ButtonLink>
      </div>
    );
  }

  const pointsEarned = Math.floor((subtotalCents / 100) * POINTS_PER_DOLLAR);

  return (
    <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
      <h1 className="font-display text-4xl font-light text-graphite sm:text-5xl">
        Cart
      </h1>
      <div className="rule-gold mt-8" />

      <div className="mt-10 grid gap-14 lg:grid-cols-[1.6fr_1fr]">
        <ul className="divide-y divide-parchment">
          {resolved.map((line) => (
            <li key={`${line.slug}-${line.size}`} className="flex gap-6 py-7">
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
                      className="font-display text-xl text-graphite"
                    >
                      {line.name}
                    </Link>
                    <p className="mt-1 text-sm text-ash">
                      {line.colorway} · Size {line.size}
                    </p>
                  </div>
                  <p className="text-sm tabular-nums text-slate">
                    {formatPrice(line.lineTotalCents)}
                  </p>
                </div>

                <div className="mt-4 flex items-center justify-between gap-4">
                  <div className="flex items-center border border-sand">
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
                    className="text-xs text-ash underline underline-offset-4 hover:text-slate"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>

        {/* ------------------------------------------------------------ Summary */}
        <aside className="h-fit border border-parchment bg-linen/60 p-7 lg:sticky lg:top-32">
          <h2 className="eyebrow text-clay">Summary</h2>

          <dl className="mt-6 space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate">Subtotal</dt>
              <dd className="tabular-nums text-graphite">
                {formatPrice(subtotalCents)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate">Standard shipping</dt>
              <dd className="text-gold-deep">Free</dd>
            </div>
          </dl>

          {/* The discount is applied by the checkout route, which is the only
              place that can tell whether this member is still eligible. */}
          <p className="mt-5 border-t border-parchment pt-5 text-xs leading-relaxed text-slate">
            Members take {WELCOME_DISCOUNT_PERCENT}% off their first order — it
            comes off at checkout automatically.
            {!signedIn && (
              <>
                {" "}
                <Link href="/signup" className="link-underline text-gold-deep">
                  Join the Circle
                </Link>
                .
              </>
            )}
          </p>

          <p className="mt-2 text-xs text-ash">
            Earns {pointsEarned} points before any discount
          </p>

          <Button onClick={checkout} disabled={busy} className="mt-7 w-full">
            {busy ? "Redirecting…" : "Checkout"}
          </Button>

          {error && (
            <p className="mt-4 border border-tan bg-parchment/60 p-3 text-xs leading-relaxed text-graphite">
              {error}
            </p>
          )}

          <ul className="mt-7 space-y-1.5 border-t border-parchment pt-5 text-xs text-ash">
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

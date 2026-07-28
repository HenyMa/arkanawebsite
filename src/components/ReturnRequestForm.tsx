"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button } from "./Button";
import { formatPrice } from "@/lib/products";
import { RETURN_REASONS, refundableCents, type ReturnReason } from "@/lib/returns";

export type ReturnableItem = {
  slug: string;
  name: string;
  colorway: string;
  size: string;
  image: string;
  unit_price_cents: number;
  /** How many of this line are still returnable, after any earlier request. */
  returnable: number;
};

type Props = {
  orderId: string;
  items: ReturnableItem[];
  orderSubtotalCents: number;
  orderDiscountCents: number;
};

const lineKey = (item: { slug: string; size: string }) =>
  `${item.slug}::${item.size}`;

export function ReturnRequestForm({
  orderId,
  items,
  orderSubtotalCents,
  orderDiscountCents,
}: Props) {
  const router = useRouter();

  // Selected quantity per line; absent means "not returning this one".
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [reason, setReason] = useState<ReturnReason | "">("");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chosen = useMemo(
    () => items.filter((item) => (selected[lineKey(item)] ?? 0) > 0),
    [items, selected],
  );

  // Mirrors the server's arithmetic so the member sees the real number before
  // committing. The API recalculates it and its answer is the one that counts.
  const estimatedRefund = useMemo(() => {
    const itemsTotal = chosen.reduce(
      (sum, item) => sum + item.unit_price_cents * (selected[lineKey(item)] ?? 0),
      0,
    );
    return refundableCents(itemsTotal, orderSubtotalCents, orderDiscountCents);
  }, [chosen, selected, orderSubtotalCents, orderDiscountCents]);

  function toggle(item: ReturnableItem) {
    setSelected((prev) => {
      const key = lineKey(item);
      const next = { ...prev };
      if (next[key]) delete next[key];
      else next[key] = 1;
      return next;
    });
    setError(null);
  }

  function setQuantity(item: ReturnableItem, quantity: number) {
    setSelected((prev) => ({
      ...prev,
      [lineKey(item)]: Math.min(item.returnable, Math.max(1, quantity)),
    }));
  }

  async function submit() {
    if (chosen.length === 0) {
      setError("Choose at least one item to return.");
      return;
    }
    if (!reason) {
      setError("Let us know why it's coming back.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          reason,
          comment: comment.trim() || undefined,
          items: chosen.map((item) => ({
            slug: item.slug,
            size: item.size,
            quantity: selected[lineKey(item)],
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }

      router.push("/account?return=opened");
      router.refresh();
    } catch {
      setError("Could not reach the returns service. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-10 grid gap-14 lg:grid-cols-[1.6fr_1fr]">
      <div>
        <h2 className="eyebrow text-clay">What&apos;s coming back?</h2>

        <ul className="mt-6 divide-y divide-parchment border-y border-parchment">
          {items.map((item) => {
            const key = lineKey(item);
            const quantity = selected[key] ?? 0;
            const checked = quantity > 0;

            return (
              <li key={key} className="py-6">
                <div className="flex gap-5">
                  <input
                    type="checkbox"
                    id={`item-${key}`}
                    checked={checked}
                    onChange={() => toggle(item)}
                    className="mt-1.5 h-4 w-4 shrink-0 accent-[var(--color-gold)]"
                  />

                  <div className="relative aspect-[4/5] w-16 shrink-0 overflow-hidden bg-linen">
                    <Image
                      src={item.image}
                      alt={item.name}
                      fill
                      sizes="64px"
                      className="object-cover"
                    />
                  </div>

                  <div className="flex-1">
                    <label
                      htmlFor={`item-${key}`}
                      className="font-display text-xl text-graphite"
                    >
                      {item.name}
                    </label>
                    <p className="mt-1 text-xs text-ash">
                      {item.colorway} · Size {item.size} ·{" "}
                      {formatPrice(item.unit_price_cents)}
                    </p>

                    {checked && item.returnable > 1 && (
                      <div className="mt-4 flex items-center gap-3">
                        <span className="text-xs text-slate">Quantity</span>
                        <div className="flex items-center border border-sand">
                          <button
                            type="button"
                            onClick={() => setQuantity(item, quantity - 1)}
                            className="px-3 py-1 text-slate hover:text-graphite"
                            aria-label={`Return fewer ${item.name}`}
                          >
                            −
                          </button>
                          <span className="w-8 text-center text-sm tabular-nums">
                            {quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => setQuantity(item, quantity + 1)}
                            className="px-3 py-1 text-slate hover:text-graphite"
                            aria-label={`Return more ${item.name}`}
                          >
                            +
                          </button>
                        </div>
                        <span className="text-xs text-ash">
                          of {item.returnable}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        <div className="mt-10">
          <h2 className="eyebrow text-clay">Why is it coming back?</h2>
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            {RETURN_REASONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setReason(option.value);
                  setError(null);
                }}
                aria-pressed={reason === option.value}
                className={`border px-4 py-3 text-left text-sm transition-colors ${
                  reason === option.value
                    ? "border-graphite bg-graphite text-bone"
                    : "border-sand text-graphite hover:border-gold"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-10">
          <label
            htmlFor="return-comment"
            className="eyebrow text-clay"
          >
            Anything else? <span className="text-ash">(optional)</span>
          </label>
          <textarea
            id="return-comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={4}
            maxLength={1000}
            placeholder="Tell us what happened — it helps us cut better next time."
            className="mt-4 w-full border border-sand bg-bone px-4 py-3 text-sm text-graphite placeholder:text-mist focus:border-gold focus:outline-none"
          />
        </div>
      </div>

      {/* ------------------------------------------------------------ Summary */}
      <aside className="h-fit border border-parchment bg-linen/60 p-7 lg:sticky lg:top-32">
        <h2 className="eyebrow text-clay">Your return</h2>

        {chosen.length === 0 ? (
          <p className="mt-6 text-sm text-slate">
            Choose the pieces you&apos;d like to send back.
          </p>
        ) : (
          <ul className="mt-6 space-y-3 text-sm">
            {chosen.map((item) => (
              <li key={lineKey(item)} className="flex justify-between gap-4">
                <span className="text-slate">
                  {item.name}
                  <span className="text-ash">
                    {" "}
                    · {item.size}
                    {(selected[lineKey(item)] ?? 1) > 1 &&
                      ` · ×${selected[lineKey(item)]}`}
                  </span>
                </span>
                <span className="tabular-nums text-graphite">
                  {formatPrice(
                    item.unit_price_cents * (selected[lineKey(item)] ?? 0),
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}

        <dl className="mt-6 space-y-3 border-t border-parchment pt-5 text-sm">
          <div className="flex justify-between">
            <dt className="text-slate">Estimated refund</dt>
            <dd className="tabular-nums text-graphite">
              {formatPrice(estimatedRefund)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate">Return postage</dt>
            <dd className="text-gold-deep">Free</dd>
          </div>
        </dl>

        {orderDiscountCents > 0 && chosen.length > 0 && (
          <p className="mt-4 text-xs leading-relaxed text-ash">
            This order was discounted, so each returned piece refunds its share
            of what you actually paid.
          </p>
        )}

        <Button onClick={submit} disabled={busy} className="mt-7 w-full">
          {busy ? "Sending…" : "Request return"}
        </Button>

        {error && (
          <p className="mt-4 border border-tan bg-parchment/60 p-3 text-xs leading-relaxed text-graphite">
            {error}
          </p>
        )}

        <p className="mt-6 text-xs leading-relaxed text-ash">
          We&apos;ll email a prepaid label within one business day. Refunds are
          issued to your original payment method once the parcel reaches us.
        </p>
      </aside>
    </div>
  );
}

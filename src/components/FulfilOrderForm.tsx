"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "./Button";
import { CARRIERS, carrierName, trackingUrl } from "@/lib/orders";

/**
 * Marks one order shipped, or puts it back in the queue.
 *
 * Shown collapsed once an order is fulfilled — the queue is the thing worth
 * scanning, and a shipped order only needs to justify itself in one line.
 */
export function FulfilOrderForm({
  orderId,
  fulfilledAt,
  carrier,
  trackingNumber,
}: {
  orderId: string;
  fulfilledAt: string | null;
  carrier: string | null;
  trackingNumber: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selectedCarrier, setSelectedCarrier] = useState(carrier ?? CARRIERS[0].id);
  const [tracking, setTracking] = useState(trackingNumber ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(action: "ship" | "unship") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          action,
          carrier: selectedCarrier,
          trackingNumber: tracking.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "That didn't work.");
        return;
      }

      setOpen(false);
      router.refresh();
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setBusy(false);
    }
  }

  if (fulfilledAt && !open) {
    const url = trackingUrl(carrier, trackingNumber);
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ash">
        <span className="text-slate">
          Shipped{" "}
          {new Date(fulfilledAt).toLocaleDateString("en-US", {
            dateStyle: "medium",
          })}
        </span>
        {carrierName(carrier) && <span>· {carrierName(carrier)}</span>}
        {trackingNumber &&
          (url ? (
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="link-underline text-slate"
            >
              {trackingNumber}
            </a>
          ) : (
            <span className="text-slate">{trackingNumber}</span>
          ))}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="link-underline text-ash transition-colors hover:text-graphite"
        >
          Edit
        </button>
      </div>
    );
  }

  return (
    <div className="border border-parchment bg-linen/40 p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label
            htmlFor={`carrier-${orderId}`}
            className="eyebrow block text-clay"
          >
            Carrier
          </label>
          <select
            id={`carrier-${orderId}`}
            value={selectedCarrier}
            onChange={(e) => setSelectedCarrier(e.target.value)}
            className="mt-2 border border-parchment bg-bone px-3 py-2 text-sm text-graphite focus:border-graphite focus:outline-none"
          >
            {CARRIERS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-[12rem] flex-1">
          <label
            htmlFor={`tracking-${orderId}`}
            className="eyebrow block text-clay"
          >
            Tracking <span className="text-ash">(optional)</span>
          </label>
          <input
            id={`tracking-${orderId}`}
            value={tracking}
            onChange={(e) => setTracking(e.target.value)}
            maxLength={64}
            placeholder="Paste the number from the label"
            className="mt-2 w-full border border-parchment bg-bone px-3 py-2 text-sm text-graphite placeholder:text-mist focus:border-graphite focus:outline-none"
          />
        </div>

        <Button onClick={() => send("ship")} disabled={busy}>
          {busy ? "Saving…" : fulfilledAt ? "Update" : "Mark shipped"}
        </Button>

        {fulfilledAt && (
          <Button
            onClick={() => send("unship")}
            disabled={busy}
            variant="outline"
          >
            Back to queue
          </Button>
        )}
      </div>

      {error && (
        <p className="mt-3 border-l border-clay p-3 text-xs leading-relaxed text-graphite">
          {error}
        </p>
      )}
    </div>
  );
}

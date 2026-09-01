/**
 * Order helpers shared by the studio and the account page.
 *
 * Fulfilment is deliberately a separate axis from `orders.status`, which tracks
 * money and is written only by the Stripe webhook. An order can be refunded and
 * shipped, or paid and unshipped; conflating the two would lose that.
 */

/**
 * The shape Stripe stores in `orders.shipping`.
 *
 * Typed as `unknown` at the call site and narrowed here, because it is a jsonb
 * column: nothing in the database guarantees it, and orders taken before
 * shipping collection was switched on have null.
 */
type ShippingDetails = {
  name?: string | null;
  address?: {
    line1?: string | null;
    line2?: string | null;
    city?: string | null;
    state?: string | null;
    postal_code?: string | null;
    country?: string | null;
  } | null;
} | null;

/**
 * A postal address as the lines you'd write on a label, name first.
 *
 * Returns an empty array rather than throwing when the address is missing or
 * malformed, so a single bad row can't take down a page listing fifty orders.
 */
export function formatAddress(shipping: unknown): string[] {
  const s = shipping as ShippingDetails;
  if (!s?.address) return [];
  const a = s.address;
  return [
    s.name,
    a.line1,
    a.line2,
    [a.city, a.state, a.postal_code].filter(Boolean).join(" "),
    a.country,
  ].filter((line): line is string => Boolean(line && line.trim()));
}

/**
 * Carriers offered when marking an order shipped.
 *
 * `track` builds a public tracking URL so the member's account page can link
 * the number rather than just printing it. Kept to the carriers actually used
 * for the countries in src/lib/shipping.ts.
 */
export const CARRIERS = [
  { id: "usps", name: "USPS", track: (n: string) => `https://tools.usps.com/go/TrackConfirmAction?tLabels=${n}` },
  { id: "ups", name: "UPS", track: (n: string) => `https://www.ups.com/track?tracknum=${n}` },
  { id: "fedex", name: "FedEx", track: (n: string) => `https://www.fedex.com/fedextrack/?trknbr=${n}` },
  { id: "dhl", name: "DHL", track: (n: string) => `https://www.dhl.com/en/express/tracking.html?AWB=${n}` },
  { id: "royalmail", name: "Royal Mail", track: (n: string) => `https://www.royalmail.com/track-your-item#/tracking-results/${n}` },
  { id: "other", name: "Other", track: () => null },
] as const;

export type CarrierId = (typeof CARRIERS)[number]["id"];

export function isCarrierId(value: unknown): value is CarrierId {
  return CARRIERS.some((c) => c.id === value);
}

export function carrierName(id: string | null | undefined): string | null {
  return CARRIERS.find((c) => c.id === id)?.name ?? null;
}

/**
 * A tracking link, or null when the carrier doesn't publish one — "Other"
 * exists precisely so a number can still be recorded for a courier we can't
 * deep-link into.
 */
export function trackingUrl(
  carrier: string | null | undefined,
  number: string | null | undefined,
): string | null {
  if (!number?.trim()) return null;
  const entry = CARRIERS.find((c) => c.id === carrier);
  return entry?.track(encodeURIComponent(number.trim())) ?? null;
}

import type Stripe from "stripe";
import { tierFor } from "./rewards";

/**
 * Flat-rate shipping. Stripe collects the address at checkout and applies the
 * rate the customer picks; we buy and print labels manually from the order.
 *
 * Rates are built per-session rather than created in the Stripe dashboard so
 * that member perks (free shipping by tier) can be applied without maintaining
 * a matrix of shipping-rate objects upstream.
 */

export const FREE_STANDARD_THRESHOLD_CENTS = 20000;

export const COUNTRIES: Stripe.Checkout.SessionCreateParams.ShippingAddressCollection.AllowedCountry[] =
  ["US", "CA", "GB", "IE", "AU", "NZ", "DE", "FR", "NL", "ES", "IT", "PT", "SE", "DK", "NO"];

const STANDARD_CENTS = 700;
const EXPRESS_CENTS = 1800;

type Rate = {
  label: string;
  cents: number;
  minDays: number;
  maxDays: number;
};

const STANDARD: Rate = {
  label: "Standard",
  cents: STANDARD_CENTS,
  minDays: 3,
  maxDays: 7,
};

const EXPRESS: Rate = {
  label: "Express",
  cents: EXPRESS_CENTS,
  minDays: 1,
  maxDays: 3,
};

/** Copy shown on the product page and in the cart, kept in sync with the rates above. */
export const SHIPPING_SUMMARY = [
  `Standard $${(STANDARD_CENTS / 100).toFixed(2)} · ${STANDARD.minDays}–${STANDARD.maxDays} business days`,
  `Express $${(EXPRESS_CENTS / 100).toFixed(2)} · ${EXPRESS.minDays}–${EXPRESS.maxDays} business days`,
  `Free standard shipping over $${FREE_STANDARD_THRESHOLD_CENTS / 100}`,
];

function toStripeRate(
  rate: Rate,
  overrideCents?: number,
): Stripe.Checkout.SessionCreateParams.ShippingOption {
  const amount = overrideCents ?? rate.cents;
  return {
    shipping_rate_data: {
      type: "fixed_amount",
      fixed_amount: { amount, currency: "usd" },
      display_name: amount === 0 ? `${rate.label} — complimentary` : rate.label,
      delivery_estimate: {
        minimum: { unit: "business_day", value: rate.minDays },
        maximum: { unit: "business_day", value: rate.maxDays },
      },
    },
  };
}

/**
 * Builds the shipping options for a checkout session.
 *
 * Standard is free above the order threshold, and free outright for Adept and
 * Oracle members. Oracle members get express free as well — these are the
 * perks advertised on /rewards, enforced here.
 */
export function shippingOptionsFor(
  subtotalCents: number,
  lifetimeSpendCents: number | null,
): Stripe.Checkout.SessionCreateParams.ShippingOption[] {
  const tier = lifetimeSpendCents === null ? null : tierFor(lifetimeSpendCents);

  const standardFree =
    subtotalCents >= FREE_STANDARD_THRESHOLD_CENTS ||
    tier?.name === "Adept" ||
    tier?.name === "Oracle";
  const expressFree = tier?.name === "Oracle";

  return [
    toStripeRate(STANDARD, standardFree ? 0 : undefined),
    toStripeRate(EXPRESS, expressFree ? 0 : undefined),
  ];
}

import type Stripe from "stripe";
import { tierFor } from "./rewards";

/**
 * Shipping rates. Stripe collects the address at checkout and applies the rate
 * the customer picks; we buy and print labels manually from the order.
 *
 * Standard shipping is free on every order, for everyone — there is no minimum.
 * Express stays a paid upgrade, complimentary for Oracle members.
 *
 * Rates are built per-session rather than created in the Stripe dashboard so
 * that member perks can be applied without maintaining a matrix of
 * shipping-rate objects upstream.
 */

export const COUNTRIES: Stripe.Checkout.SessionCreateParams.ShippingAddressCollection.AllowedCountry[] =
  ["US", "CA", "GB", "IE", "AU", "NZ", "DE", "FR", "NL", "ES", "IT", "PT", "SE", "DK", "NO"];

const STANDARD_CENTS = 0;
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
  `Free standard shipping on every order · ${STANDARD.minDays}–${STANDARD.maxDays} business days`,
  `Express $${(EXPRESS_CENTS / 100).toFixed(2)} · ${EXPRESS.minDays}–${EXPRESS.maxDays} business days`,
  "No minimum, no threshold, anywhere we ship",
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
 * Standard is always free. Oracle members get express free as well — the perk
 * advertised on /rewards, enforced here.
 *
 * Takes a member's standing (see `standingCents`), not raw lifetime spend, so
 * an Oracle who bought the tier is served the same as one who spent into it.
 */
export function shippingOptionsFor(
  standing: number | null,
): Stripe.Checkout.SessionCreateParams.ShippingOption[] {
  const tier = standing === null ? null : tierFor(standing);
  const expressFree = tier?.name === "Oracle";

  return [
    toStripeRate(STANDARD),
    toStripeRate(EXPRESS, expressFree ? 0 : undefined),
  ];
}

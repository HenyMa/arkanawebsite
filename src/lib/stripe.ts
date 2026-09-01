import Stripe from "stripe";

/**
 * Lazily constructed Stripe client.
 *
 * Returns null when the secret key is absent so the storefront still renders
 * before keys are configured — callers surface a "checkout not configured yet"
 * message rather than throwing at module load and taking down the whole route.
 */
let cached: Stripe | null = null;

export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  if (!cached) {
    // No explicit apiVersion: the SDK pins the version its types were built
    // against, so upgrading the package can't silently desync the two.
    cached = new Stripe(key);
  }
  return cached;
}

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

/**
 * A member discount, as a reusable Stripe coupon.
 *
 * Created on first use under a fixed id and reused forever after, rather than
 * minting a throwaway coupon per checkout — otherwise the Stripe dashboard
 * fills with one coupon per order. `duration: "once"` means it applies to the
 * single payment it is attached to; eligibility is enforced by us, in the
 * checkout route, not by the coupon. The coupons themselves are unrestricted,
 * so none of them may ever be exposed as a promotion code.
 *
 * A coupon's rate is fixed when it is created and `retrieve` never updates it,
 * so every id below carries its rate. Changing a rate in rewards.ts therefore
 * means a new id, not an edit — otherwise the site would advertise one figure
 * and Stripe would take off another.
 */
const coupons = new Map<string, Promise<Stripe.Coupon>>();

function getCoupon(
  stripe: Stripe,
  id: string,
  percentOff: number,
  name: string,
): Promise<Stripe.Coupon> {
  const cached = coupons.get(id);
  if (cached) return cached;

  const pending = stripe.coupons
    .retrieve(id)
    .catch(() =>
      stripe.coupons.create({ id, percent_off: percentOff, duration: "once", name }),
    )
    .catch((err) => {
      // Don't cache a rejection: a transient failure here should not disable
      // the discount for the lifetime of the process.
      coupons.delete(id);
      throw err;
    });

  coupons.set(id, pending);
  return pending;
}

/**
 * The welcome discount on a member's first order.
 *
 * The id is the original, unsuffixed one rather than a rate-derived one like
 * the coupon below: it is already live in Stripe against real orders, and
 * renaming it would strand that reporting behind a second coupon meaning the
 * same thing. It still has to change if WELCOME_DISCOUNT_PERCENT ever does.
 */
export function getWelcomeCoupon(
  stripe: Stripe,
  percentOff: number,
): Promise<Stripe.Coupon> {
  return getCoupon(
    stripe,
    "arkana-welcome-20",
    percentOff,
    `Arkana Circle — ${percentOff}% welcome`,
  );
}

/**
 * The one-time discount on a member's second order.
 *
 * Two rates are in play (the base one and the higher Adept/Oracle one), so this
 * resolves to two distinct coupons — which also means the Stripe dashboard
 * reports on them separately.
 */
export function getSecondOrderCoupon(
  stripe: Stripe,
  percentOff: number,
): Promise<Stripe.Coupon> {
  return getCoupon(
    stripe,
    `arkana-second-order-${percentOff}pct`,
    percentOff,
    `Arkana Circle — ${percentOff}% second order`,
  );
}

/** Absolute site origin, used to build Checkout success and cancel URLs. */
export function siteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
  );
}

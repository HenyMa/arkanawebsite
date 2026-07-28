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
 * The member welcome discount, as a reusable Stripe coupon.
 *
 * Created on first use under a fixed id and reused forever after, rather than
 * minting a throwaway coupon per checkout — otherwise the Stripe dashboard
 * fills with one coupon per order. `duration: "once"` means it applies to the
 * single payment it is attached to; eligibility is enforced by us, in the
 * checkout route, not by the coupon.
 */
const WELCOME_COUPON_ID = "arkana-welcome-20";

let welcomeCoupon: Promise<Stripe.Coupon> | null = null;

export function getWelcomeCoupon(
  stripe: Stripe,
  percentOff: number,
): Promise<Stripe.Coupon> {
  if (!welcomeCoupon) {
    welcomeCoupon = stripe.coupons
      .retrieve(WELCOME_COUPON_ID)
      .catch(() =>
        stripe.coupons.create({
          id: WELCOME_COUPON_ID,
          percent_off: percentOff,
          duration: "once",
          name: `Arkana Circle — ${percentOff}% welcome`,
        }),
      )
      .catch((err) => {
        // Don't cache a rejection: a transient failure here should not disable
        // the discount for the lifetime of the process.
        welcomeCoupon = null;
        throw err;
      });
  }
  return welcomeCoupon;
}

/**
 * The Adept/Oracle discount, as a reusable Stripe coupon.
 *
 * Same reasoning as the welcome coupon: one fixed coupon reused forever rather
 * than one per checkout. Eligibility is decided in the checkout route — the
 * coupon itself is unrestricted, so it must never be exposed as a promotion
 * code.
 *
 * A coupon's rate is fixed when it is created and `retrieve` never updates it,
 * so changing MEMBER_DISCOUNT_PERCENT means changing this id too. Otherwise the
 * site would advertise one figure and Stripe would take off another.
 */
const MEMBER_COUPON_ID = "arkana-member-10pct";

let memberCoupon: Promise<Stripe.Coupon> | null = null;

export function getMemberCoupon(
  stripe: Stripe,
  percentOff: number,
): Promise<Stripe.Coupon> {
  if (!memberCoupon) {
    memberCoupon = stripe.coupons
      .retrieve(MEMBER_COUPON_ID)
      .catch(() =>
        stripe.coupons.create({
          id: MEMBER_COUPON_ID,
          percent_off: percentOff,
          duration: "once",
          name: `Arkana Circle — ${percentOff}% member`,
        }),
      )
      .catch((err) => {
        memberCoupon = null;
        throw err;
      });
  }
  return memberCoupon;
}

/** Absolute site origin, used to build Checkout success and cancel URLs. */
export function siteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
  );
}

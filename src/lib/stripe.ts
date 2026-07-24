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

/** Absolute site origin, used to build Checkout success and cancel URLs. */
export function siteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
  );
}

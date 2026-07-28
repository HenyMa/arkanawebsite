import { NextResponse } from "next/server";
import type Stripe from "stripe";
import {
  getMemberCoupon,
  getWelcomeCoupon,
  getStripe,
  siteUrl,
} from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { SIZES, getProduct, type Size } from "@/lib/products";
import { COUNTRIES, shippingOptionsFor } from "@/lib/shipping";
import {
  MEMBER_DISCOUNT_PERCENT,
  WELCOME_DISCOUNT_PERCENT,
  memberDiscountCents,
  standingCents,
  welcomeDiscountCents,
} from "@/lib/rewards";

export const runtime = "nodejs";

type IncomingLine = { slug?: unknown; size?: unknown; quantity?: unknown };

const MAX_QTY = 10;
/** Stripe caps metadata values at 500 characters. */
const METADATA_LIMIT = 500;

type ProfileRow = {
  lifetime_spend_cents: number | null;
  welcome_discount_used_at: string | null;
  purchased_tier?: string | null;
};

/**
 * Reads the bits of a profile that decide perks.
 *
 * `purchased_tier` arrived with paid memberships, so a database that hasn't had
 * supabase/schema.sql re-run yet doesn't have it. 42703 (undefined_column) is
 * retried without it rather than left to fail: the welcome discount and points
 * predate memberships and must keep working while the schema catches up.
 */
async function loadProfile(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  userId: string,
) {
  const full = await supabase
    .from("profiles")
    .select("lifetime_spend_cents, welcome_discount_used_at, purchased_tier")
    .eq("id", userId)
    .single<ProfileRow>();

  if (!full.error || full.error.code !== "42703") return full;

  console.warn(
    "[checkout] profiles.purchased_tier is missing; re-run supabase/schema.sql.",
  );
  return supabase
    .from("profiles")
    .select("lifetime_spend_cents, welcome_discount_used_at")
    .eq("id", userId)
    .single<ProfileRow>();
}

export async function POST(request: Request) {
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json(
      {
        error:
          "Checkout isn't connected yet. Add STRIPE_SECRET_KEY to .env.local to take payments.",
      },
      { status: 503 },
    );
  }

  let body: { lines?: IncomingLine[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  if (!Array.isArray(body.lines) || body.lines.length === 0) {
    return NextResponse.json({ error: "Your cart is empty." }, { status: 400 });
  }

  /*
   * Prices come from the server-side catalogue, never from the request body —
   * the client only gets to say *what* and *how many*. Anything unrecognised
   * or out of stock is rejected outright rather than silently dropped, so a
   * customer never pays for an order missing a line they expected.
   */
  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];
  const compact: { s: string; z: string; q: number }[] = [];
  let subtotalCents = 0;

  for (const raw of body.lines) {
    if (typeof raw.slug !== "string" || typeof raw.size !== "string") {
      return NextResponse.json({ error: "Invalid cart contents." }, { status: 400 });
    }

    const product = getProduct(raw.slug);
    if (!product) {
      return NextResponse.json(
        { error: "One of the items is no longer available." },
        { status: 400 },
      );
    }

    const size = raw.size as Size;
    if (!SIZES.includes(size) || !product.inStock.includes(size)) {
      return NextResponse.json(
        { error: `${product.name} is sold out in size ${raw.size}.` },
        { status: 400 },
      );
    }

    const quantity = Math.min(
      MAX_QTY,
      Math.max(1, Math.floor(Number(raw.quantity) || 1)),
    );

    subtotalCents += product.priceCents * quantity;
    compact.push({ s: product.slug, z: size, q: quantity });

    lineItems.push({
      quantity,
      price_data: {
        currency: "usd",
        unit_amount: product.priceCents,
        product_data: {
          name: `${product.name} — ${product.colorway}`,
          description: `Size ${size}`,
          images: [`${siteUrl()}${product.images[0]}`],
        },
      },
    });
  }

  // Signed-in members get their tier's perks and have the order attributed to
  // them by the webhook.
  const supabase = await createClient();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;

  let standing = 0;
  let welcomeEligible = false;

  if (supabase && user) {
    const [{ data: profile }, { count: priorOrders }] = await Promise.all([
      loadProfile(supabase, user.id),
      supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id),
    ]);

    // Tier follows spend *or* a bought membership, whichever is higher.
    standing = standingCents(
      profile?.lifetime_spend_cents,
      profile?.purchased_tier,
    );

    /*
     * "First order as a member" is read strictly: the perk is burned once the
     * discount has been used, and it is never offered to an account that has
     * already ordered — including accounts that predate the perk existing.
     *
     * The flag is only set once payment succeeds, so abandoning this checkout
     * leaves the discount intact for next time. And a profile we couldn't read
     * is treated as ineligible: failing closed risks giving 20% away twice,
     * failing open risks giving it away twice *and* charging the wrong amount.
     */
    welcomeEligible =
      Boolean(profile) &&
      !profile?.welcome_discount_used_at &&
      (priorOrders ?? 0) === 0;
  }

  /*
   * Stripe Checkout takes at most one coupon per session, so the two member
   * discounts compete rather than stack: whichever is worth more on this basket
   * wins. Compared in cents rather than by rate so the rule keeps holding if
   * either discount ever changes shape.
   *
   * Ties go to the recurring discount, because it comes back on the next order
   * — the welcome discount does not, so it is worth saving. As the rates stand
   * (20% against 10%) the welcome discount always wins a member's first order,
   * and the member discount takes over from the second.
   */
  const welcomeCents = welcomeEligible ? welcomeDiscountCents(subtotalCents) : 0;
  const memberCents = memberDiscountCents(standing, subtotalCents);

  const useMember = memberCents > 0 && memberCents >= welcomeCents;
  const useWelcome = !useMember && welcomeCents > 0;

  let discounts: Stripe.Checkout.SessionCreateParams.Discount[] | undefined;
  let welcomeDiscount = false;

  if (useWelcome) {
    try {
      const coupon = await getWelcomeCoupon(stripe, WELCOME_DISCOUNT_PERCENT);
      discounts = [{ coupon: coupon.id }];
      welcomeDiscount = true;
    } catch (err) {
      // Better to sell at full price than to fail the checkout outright — and
      // the perk survives, because nothing has been marked as used.
      console.error("[checkout] Welcome discount unavailable:", err);
    }
  } else if (useMember) {
    try {
      const coupon = await getMemberCoupon(stripe, MEMBER_DISCOUNT_PERCENT);
      discounts = [{ coupon: coupon.id }];
    } catch (err) {
      console.error("[checkout] Member discount unavailable:", err);
    }
  }

  const itemsJson = JSON.stringify(compact);

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: lineItems,
      // Stripe collects and validates the shipping address for us.
      shipping_address_collection: { allowed_countries: COUNTRIES },
      shipping_options: shippingOptionsFor(standing),
      // Stripe rejects a session that both carries a discount and invites a
      // promotion code, so the welcome discount takes precedence.
      ...(discounts ? { discounts } : { allow_promotion_codes: true }),
      phone_number_collection: { enabled: false },
      ...(user?.email ? { customer_email: user.email } : {}),
      client_reference_id: user?.id,
      metadata: {
        // Read back by the webhook to record the order and mint points.
        user_id: user?.id ?? "",
        // Gross, before any discount. The webhook subtracts what Stripe reports
        // as actually discounted, so promo codes and the welcome discount are
        // handled the same way.
        subtotal_cents: String(subtotalCents),
        welcome_discount: welcomeDiscount ? "1" : "",
        items: itemsJson.length <= METADATA_LIMIT ? itemsJson : "",
      },
      success_url: `${siteUrl()}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl()}/cart`,
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Stripe did not return a checkout URL." },
        { status: 502 },
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[checkout] Stripe session creation failed:", err);
    return NextResponse.json(
      { error: "We couldn't start checkout. Please try again in a moment." },
      { status: 502 },
    );
  }
}

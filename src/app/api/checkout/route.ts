import { NextResponse } from "next/server";
import type Stripe from "stripe";
import {
  getSecondOrderCoupon,
  getWelcomeCoupon,
  getStripe,
  siteUrl,
} from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { SIZES, getProduct, type Size } from "@/lib/products";
import { COUNTRIES, shippingOptionsFor } from "@/lib/shipping";
import {
  WELCOME_DISCOUNT_PERCENT,
  secondOrderDiscountPercent,
  standingCents,
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
  second_order_discount_used_at?: string | null;
};

/**
 * Reads the bits of a profile that decide perks.
 *
 * `purchased_tier` arrived with paid memberships and
 * `second_order_discount_used_at` with the second-order discount, so a database
 * that hasn't had supabase/schema.sql re-run yet has neither. 42703
 * (undefined_column) is retried without them rather than left to fail: the
 * welcome discount and points predate both and must keep working while the
 * schema catches up.
 *
 * The retry drops the newer columns, which leaves them undefined — and every
 * rule below reads undefined as "no tier, perk not available". An un-migrated
 * database therefore under-grants rather than over-grants, which is the right
 * way round: we can always honour a missed discount by hand.
 */
async function loadProfile(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  userId: string,
) {
  const full = await supabase
    .from("profiles")
    .select(
      "lifetime_spend_cents, welcome_discount_used_at, purchased_tier, second_order_discount_used_at",
    )
    .eq("id", userId)
    .single<ProfileRow>();

  if (!full.error || full.error.code !== "42703") return full;

  console.warn(
    "[checkout] profiles is missing purchased_tier or second_order_discount_used_at; re-run supabase/schema.sql.",
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
  let secondOrderEligible = false;

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

    const ordersSoFar = priorOrders ?? 0;

    /*
     * Both perks are read strictly by order number: the first is offered only
     * to an account that has never ordered, the second only to one that has
     * ordered exactly once — including accounts that predate either perk
     * existing, which get neither.
     *
     * Each is also gated on its own burn flag, which is only set once payment
     * succeeds. So abandoning this checkout leaves the discount intact for next
     * time, and an order that went through without its coupon (Stripe was down,
     * say) doesn't silently consume the perk.
     *
     * A profile we couldn't read is treated as ineligible for both: failing
     * closed risks giving a discount away late, failing open risks giving it
     * away twice *and* charging the wrong amount.
     */
    welcomeEligible =
      Boolean(profile) && !profile?.welcome_discount_used_at && ordersSoFar === 0;

    secondOrderEligible =
      Boolean(profile) &&
      !profile?.second_order_discount_used_at &&
      ordersSoFar === 1;
  }

  /*
   * The two perks are mutually exclusive by construction — one is offered on
   * order zero and the other on order one — so there is nothing to compare and
   * nothing to stack, which suits Stripe Checkout's one-coupon-per-session
   * limit. The branches below are ordered to match, not to prioritise.
   */
  let discounts: Stripe.Checkout.SessionCreateParams.Discount[] | undefined;
  let welcomeDiscount = false;
  let secondOrderDiscount = false;

  if (welcomeEligible) {
    try {
      const coupon = await getWelcomeCoupon(stripe, WELCOME_DISCOUNT_PERCENT);
      discounts = [{ coupon: coupon.id }];
      welcomeDiscount = true;
    } catch (err) {
      // Better to sell at full price than to fail the checkout outright — and
      // the perk survives, because nothing has been marked as used.
      console.error("[checkout] Welcome discount unavailable:", err);
    }
  } else if (secondOrderEligible) {
    try {
      const coupon = await getSecondOrderCoupon(
        stripe,
        secondOrderDiscountPercent(standing),
      );
      discounts = [{ coupon: coupon.id }];
      secondOrderDiscount = true;
    } catch (err) {
      console.error("[checkout] Second-order discount unavailable:", err);
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
      // promotion code, so an automatic member perk takes precedence and the
      // promo box only appears when there is no perk to apply.
      ...(discounts ? { discounts } : { allow_promotion_codes: true }),
      /*
       * Collected for the carrier — several want a contact number on an
       * international label, and this site ships to fifteen countries.
       *
       * Explicitly *not* a marketing opt-in: a number given so a parcel can be
       * delivered is not consent to be texted about drops. That is asked for
       * separately on /success and verified by code, and this number is never
       * copied into `profiles.phone`.
       */
      phone_number_collection: { enabled: true },
      ...(user?.email ? { customer_email: user.email } : {}),
      client_reference_id: user?.id,
      metadata: {
        // Read back by the webhook to record the order and mint points.
        user_id: user?.id ?? "",
        // Gross, before any discount. The webhook subtracts what Stripe reports
        // as actually discounted, so promo codes and the welcome discount are
        // handled the same way.
        subtotal_cents: String(subtotalCents),
        // Which one-time perk to burn once this session is paid for. At most
        // one is ever set, and only when the coupon actually made it onto the
        // session.
        welcome_discount: welcomeDiscount ? "1" : "",
        second_order_discount: secondOrderDiscount ? "1" : "",
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

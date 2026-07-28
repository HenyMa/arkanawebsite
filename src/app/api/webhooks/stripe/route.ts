import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProduct } from "@/lib/products";
import {
  isPurchasableTier,
  pointsForOrder,
  pointsToReverse,
  standingCents,
} from "@/lib/rewards";
import { ACTIVE_RETURN_STATUSES } from "@/lib/returns";

export const runtime = "nodejs";
/** Signature verification needs the exact bytes Stripe sent, so no caching. */
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripe || !secret) {
    console.warn("[webhook] Stripe is not configured; ignoring event.");
    return NextResponse.json({ received: true });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature." }, { status: 400 });
  }

  const payload = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, secret);
  } catch (err) {
    // An unverified payload is either a misconfigured secret or a forgery.
    console.error("[webhook] Signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        // Two very different things arrive on this event: a basket of clothes,
        // and someone buying their way into a tier.
        if (session.metadata?.kind === "membership") {
          await recordMembership(session);
        } else {
          await recordOrder(session);
        }
        break;
      }
      // Refunds are issued from the Stripe dashboard once a return is checked
      // in; this is how the site finds out and squares up points and returns.
      case "charge.refunded":
        await recordRefund(event.data.object as Stripe.Charge);
        break;
    }
  } catch (err) {
    // Returning 500 makes Stripe retry with backoff, which is what we want for
    // a transient database problem. Both handlers are idempotent, so retries
    // are safe.
    console.error(`[webhook] Failed to handle ${event.type}:`, err);
    return NextResponse.json({ error: "Processing failed." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function recordOrder(session: Stripe.Checkout.Session) {
  const supabase = createAdminClient();
  if (!supabase) {
    console.warn(
      "[webhook] SUPABASE_SERVICE_ROLE_KEY is not set; order not persisted.",
    );
    return;
  }

  // Only paid sessions count. Async payment methods land here as "unpaid" and
  // are confirmed later by checkout.session.async_payment_succeeded.
  if (session.payment_status !== "paid") return;

  const userId = session.metadata?.user_id || null;

  /*
   * `subtotal_cents` is the gross value of the garments, before discounts.
   * Stripe reports what was actually taken off — the welcome discount, a promo
   * code, or both — so netting them here handles every case identically.
   *
   * Gross is stored because it is what the line items add up to, which is what
   * a partial return needs to pro-rate against. Points are minted on the net.
   */
  const grossSubtotalCents =
    Number(session.metadata?.subtotal_cents) || session.amount_subtotal || 0;
  const discountCents = session.total_details?.amount_discount ?? 0;
  const netSubtotalCents = Math.max(0, grossSubtotalCents - discountCents);

  const items = parseItems(session.metadata?.items);

  const { data: order, error: insertError } = await supabase
    .from("orders")
    .insert({
      user_id: userId,
      stripe_session_id: session.id,
      stripe_payment_intent:
        typeof session.payment_intent === "string" ? session.payment_intent : null,
      email: session.customer_details?.email ?? null,
      amount_subtotal_cents: grossSubtotalCents,
      discount_cents: discountCents,
      amount_total_cents: session.amount_total ?? 0,
      currency: session.currency ?? "usd",
      status: "paid",
      items,
      shipping: shippingFrom(session),
    })
    .select("id")
    .single();

  if (insertError) {
    // 23505 = unique violation on stripe_session_id: Stripe redelivered an
    // event we already processed. Nothing left to do, and crucially we must
    // not award points a second time.
    if (insertError.code === "23505") return;
    throw insertError;
  }

  if (!userId) return; // Guest checkout — recorded, but no points to award.

  // Burn the welcome discount now that it has actually been paid for. Only ever
  // set, never cleared, and only if it isn't already set — so a member who
  // somehow lands two discounted checkouts keeps the earlier timestamp.
  if (session.metadata?.welcome_discount === "1") {
    const { error: burnError } = await supabase
      .from("profiles")
      .update({ welcome_discount_used_at: new Date().toISOString() })
      .eq("id", userId)
      .is("welcome_discount_used_at", null);

    if (burnError) throw burnError;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("lifetime_spend_cents, purchased_tier")
    .eq("id", userId)
    .single();

  // A bought tier multiplies points exactly like an earned one.
  const points = pointsForOrder(
    netSubtotalCents,
    standingCents(profile?.lifetime_spend_cents, profile?.purchased_tier),
  );

  const { error: awardError } = await supabase.rpc("award_points", {
    p_user_id: userId,
    p_points: points,
    p_spend: netSubtotalCents,
    p_order_id: order.id,
    p_reason: "Order reward",
  });

  if (awardError) throw awardError;

  await supabase
    .from("orders")
    .update({ points_awarded: points })
    .eq("id", order.id);
}

/**
 * Grants a tier someone has paid for.
 *
 * Deliberately not recorded as an order: a membership isn't a garment, so it
 * earns no points, doesn't move lifetime spend, and can't be returned. Keeping
 * it out of `orders` also keeps returns and refund pro-rating honest, since
 * every row there is expected to have items behind it.
 *
 * Idempotency and the never-downgrade rule both live in the RPC, so a
 * redelivered event is a no-op and an Oracle who later buys Adept stays Oracle.
 */
async function recordMembership(session: Stripe.Checkout.Session) {
  const supabase = createAdminClient();
  if (!supabase) {
    console.warn(
      "[webhook] SUPABASE_SERVICE_ROLE_KEY is not set; membership not granted.",
    );
    return;
  }

  if (session.payment_status !== "paid") return;

  const userId = session.metadata?.user_id || null;
  const tier = session.metadata?.tier;

  if (!userId || !isPurchasableTier(tier)) {
    // Nothing to grant and nobody to grant it to. Logged rather than thrown:
    // retrying can't add the metadata that isn't there.
    console.warn(
      `[webhook] Membership session ${session.id} has no usable user or tier.`,
    );
    return;
  }

  const { error } = await supabase.rpc("grant_membership", {
    p_user_id: userId,
    p_tier: tier,
    p_session_id: session.id,
    p_payment_intent:
      typeof session.payment_intent === "string" ? session.payment_intent : null,
    p_amount_cents: session.amount_total ?? 0,
  });

  if (error) throw error;
}

/**
 * Squares the books after a refund.
 *
 * Stripe sends the charge's *cumulative* `amount_refunded`, so the delta
 * against what we've already recorded is the new money — which makes a
 * redelivered event a no-op and a second partial refund correct.
 */
async function recordRefund(charge: Stripe.Charge) {
  const supabase = createAdminClient();
  if (!supabase) {
    console.warn(
      "[webhook] SUPABASE_SERVICE_ROLE_KEY is not set; refund not recorded.",
    );
    return;
  }

  const paymentIntent =
    typeof charge.payment_intent === "string" ? charge.payment_intent : null;
  if (!paymentIntent) return;

  const { data: order } = await supabase
    .from("orders")
    .select(
      "id, user_id, amount_subtotal_cents, discount_cents, refunded_cents, points_awarded",
    )
    .eq("stripe_payment_intent", paymentIntent)
    .single();

  if (!order) {
    // A refund on a charge we never recorded — a manual payment, or an order
    // taken before this site was live. Nothing to reconcile.
    console.warn(`[webhook] No order for payment intent ${paymentIntent}.`);
    return;
  }

  const alreadyRefunded = order.refunded_cents ?? 0;
  const deltaCents = (charge.amount_refunded ?? 0) - alreadyRefunded;
  if (deltaCents <= 0) return;

  // Points were minted on the net subtotal, so they have to be clawed back
  // against the same base. Taking the difference of two cumulative reversals
  // keeps the total consistent no matter how the refunds are split up.
  const netSubtotalCents = Math.max(
    0,
    (order.amount_subtotal_cents ?? 0) - (order.discount_cents ?? 0),
  );
  const awarded = order.points_awarded ?? 0;
  const points =
    pointsToReverse(awarded, alreadyRefunded + deltaCents, netSubtotalCents) -
    pointsToReverse(awarded, alreadyRefunded, netSubtotalCents);

  // Attach the refund to the oldest return still open on this order, so the
  // member sees their request close out rather than a bare status change.
  const { data: openReturn } = await supabase
    .from("returns")
    .select("id")
    .eq("order_id", order.id)
    .in("status", ACTIVE_RETURN_STATUSES.filter((s) => s !== "refunded"))
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.rpc("record_refund", {
    p_order_id: order.id,
    p_user_id: order.user_id,
    p_refund_cents: deltaCents,
    p_points: Math.max(0, points),
    p_return_id: openReturn?.id ?? null,
  });

  if (error) throw error;
}

/**
 * Reads the shipping address off a session.
 *
 * Stripe moved this from `session.shipping_details` to
 * `collected_information.shipping_details` in the 2025 API versions. Reading
 * both keeps the webhook working across an SDK or API-version upgrade.
 */
function shippingFrom(session: Stripe.Checkout.Session) {
  const s = session as unknown as {
    shipping_details?: unknown;
    collected_information?: { shipping_details?: unknown } | null;
  };
  return s.collected_information?.shipping_details ?? s.shipping_details ?? null;
}

/**
 * Expands the compact `[{s,z,q}]` metadata written at checkout back into
 * readable line items for the account page. Falls back to an empty list rather
 * than failing the whole webhook if the metadata is missing or malformed.
 */
function parseItems(raw: string | undefined) {
  if (!raw) return [];
  try {
    const compact: { s: string; z: string; q: number }[] = JSON.parse(raw);
    return compact.flatMap((c) => {
      const product = getProduct(c.s);
      if (!product) return [];
      return [
        {
          slug: c.s,
          name: product.name,
          colorway: product.colorway,
          size: c.z,
          quantity: c.q,
          unit_price_cents: product.priceCents,
          image: product.images[0],
        },
      ];
    });
  } catch {
    return [];
  }
}

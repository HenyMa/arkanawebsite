import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProduct } from "@/lib/products";
import { pointsForOrder } from "@/lib/rewards";

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

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true });
  }

  try {
    await recordOrder(event.data.object as Stripe.Checkout.Session);
  } catch (err) {
    // Returning 500 makes Stripe retry with backoff, which is what we want for
    // a transient database problem. The insert is idempotent, so retries are safe.
    console.error("[webhook] Failed to record order:", err);
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
  const subtotalCents =
    Number(session.metadata?.subtotal_cents) ||
    session.amount_subtotal ||
    0;

  const items = parseItems(session.metadata?.items);

  const { data: order, error: insertError } = await supabase
    .from("orders")
    .insert({
      user_id: userId,
      stripe_session_id: session.id,
      stripe_payment_intent:
        typeof session.payment_intent === "string" ? session.payment_intent : null,
      email: session.customer_details?.email ?? null,
      amount_subtotal_cents: subtotalCents,
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("lifetime_spend_cents")
    .eq("id", userId)
    .single();

  const points = pointsForOrder(
    subtotalCents,
    profile?.lifetime_spend_cents ?? 0,
  );

  const { error: awardError } = await supabase.rpc("award_points", {
    p_user_id: userId,
    p_points: points,
    p_spend: subtotalCents,
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

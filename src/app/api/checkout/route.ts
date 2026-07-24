import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe, siteUrl } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { SIZES, getProduct, type Size } from "@/lib/products";
import { COUNTRIES, shippingOptionsFor } from "@/lib/shipping";

export const runtime = "nodejs";

type IncomingLine = { slug?: unknown; size?: unknown; quantity?: unknown };

const MAX_QTY = 10;
/** Stripe caps metadata values at 500 characters. */
const METADATA_LIMIT = 500;

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

  // Signed-in members get their tier's shipping perks and have the order
  // attributed to them by the webhook.
  const supabase = await createClient();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;

  let lifetimeSpendCents: number | null = null;
  if (supabase && user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("lifetime_spend_cents")
      .eq("id", user.id)
      .single();
    lifetimeSpendCents = profile?.lifetime_spend_cents ?? 0;
  }

  const itemsJson = JSON.stringify(compact);

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: lineItems,
      // Stripe collects and validates the shipping address for us.
      shipping_address_collection: { allowed_countries: COUNTRIES },
      shipping_options: shippingOptionsFor(subtotalCents, lifetimeSpendCents),
      allow_promotion_codes: true,
      phone_number_collection: { enabled: false },
      ...(user?.email ? { customer_email: user.email } : {}),
      client_reference_id: user?.id,
      metadata: {
        // Read back by the webhook to record the order and mint points.
        user_id: user?.id ?? "",
        subtotal_cents: String(subtotalCents),
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

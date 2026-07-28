import { NextResponse } from "next/server";
import { getStripe, siteUrl } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import {
  MEMBERSHIP_PRICE_CENTS,
  isPurchasableTier,
  standingCents,
  tierByName,
} from "@/lib/rewards";

export const runtime = "nodejs";

/**
 * Buying a tier outright.
 *
 * A membership is a one-off payment that grants the tier permanently, so it is
 * a plain Checkout session in payment mode — no subscription, nothing to renew
 * or cancel. The tier itself is granted by the Stripe webhook once the money
 * clears; this route only ever creates the session.
 *
 * It must be signed in: a membership attaches to an account, and there is
 * nowhere to put one bought by a guest.
 */
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

  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Memberships need an account, and accounts aren't connected yet." },
      { status: 503 },
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Sign in to buy a membership." },
      { status: 401 },
    );
  }

  let body: { tier?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  if (!isPurchasableTier(body.tier)) {
    return NextResponse.json(
      { error: "That membership doesn't exist." },
      { status: 400 },
    );
  }

  const tier = tierByName(body.tier);
  if (!tier) {
    return NextResponse.json(
      { error: "That membership doesn't exist." },
      { status: 400 },
    );
  }

  const priceCents = MEMBERSHIP_PRICE_CENTS[body.tier];

  // Price comes from the catalogue above, never the request body — the client
  // only names the tier.
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("lifetime_spend_cents, purchased_tier")
    .eq("id", user.id)
    .single<{ lifetime_spend_cents: number | null; purchased_tier: string | null }>();

  /*
   * 42703 = undefined_column: the schema predates paid memberships, so there is
   * nowhere to record the tier and grant_membership() doesn't exist either.
   * Refuse the sale rather than take money for something we can't deliver.
   */
  if (profileError?.code === "42703") {
    console.error(
      "[membership] profiles.purchased_tier is missing; re-run supabase/schema.sql.",
    );
    return NextResponse.json(
      { error: "Memberships aren't switched on yet. Please try again later." },
      { status: 503 },
    );
  }

  const standing = standingCents(
    profile?.lifetime_spend_cents,
    profile?.purchased_tier,
  );

  // Nothing to sell someone who already has this standing, whether they earned
  // it or bought it. Checked here rather than only in the UI, because the UI is
  // the one part of this we don't control.
  if (standing >= tier.thresholdCents) {
    return NextResponse.json(
      { error: `You're already ${tier.name} or above — nothing to buy.` },
      { status: 400 },
    );
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: priceCents,
            product_data: {
              name: `The Arkana Circle — ${tier.name}`,
              description: "Lifetime membership. One payment, never expires.",
            },
          },
        },
      ],
      // No garments to ship, so no address to collect. Promotion codes are off:
      // membership prices are set here, not negotiated at the till.
      customer_email: user.email,
      client_reference_id: user.id,
      metadata: {
        // Read by the webhook, which grants the tier. `kind` is what tells it
        // this session is a membership and not an order of clothes.
        kind: "membership",
        user_id: user.id,
        tier: tier.name,
      },
      success_url: `${siteUrl()}/success?membership=${encodeURIComponent(tier.name)}`,
      cancel_url: `${siteUrl()}/rewards`,
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Stripe did not return a checkout URL." },
        { status: 502 },
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[membership] Stripe session creation failed:", err);
    return NextResponse.json(
      { error: "We couldn't start checkout. Please try again in a moment." },
      { status: 502 },
    );
  }
}

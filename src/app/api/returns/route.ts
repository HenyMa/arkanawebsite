import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { standingCents } from "@/lib/rewards";
import {
  generateRmaCode,
  isActiveReturn,
  isCancellable,
  isReturnReason,
  isWithinReturnWindow,
  refundableCents,
  returnPostageIsFree,
  returnWindowDays,
} from "@/lib/returns";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_COMMENT = 1000;
/** Retries on the (vanishingly unlikely) RMA code collision. */
const RMA_ATTEMPTS = 5;

type OrderItem = {
  slug: string;
  name: string;
  colorway: string;
  size: string;
  quantity: number;
  unit_price_cents: number;
  image: string;
};

type IncomingItem = { slug?: unknown; size?: unknown; quantity?: unknown };

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Opens a return.
 *
 * Everything the browser sent is treated as a suggestion: ownership, the return
 * window, the quantities still returnable, and the refund value are all decided
 * here against the order as stored. The client's job is only to say which lines
 * and why.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  if (!supabase) {
    return bad("Returns aren't connected yet. Add your Supabase keys.", 503);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return bad("Sign in to start a return.", 401);

  let body: {
    orderId?: unknown;
    reason?: unknown;
    comment?: unknown;
    items?: IncomingItem[];
  };
  try {
    body = await request.json();
  } catch {
    return bad("Malformed request.");
  }

  if (typeof body.orderId !== "string") return bad("Which order?");
  if (!isReturnReason(body.reason)) return bad("Choose a reason for the return.");
  if (!Array.isArray(body.items) || body.items.length === 0) {
    return bad("Choose at least one item to return.");
  }

  const reason = body.reason;
  const comment =
    typeof body.comment === "string"
      ? body.comment.trim().slice(0, MAX_COMMENT)
      : null;

  // The RLS policy already scopes this to the member's own orders; the explicit
  // filter keeps the failure a clean 404 rather than an empty result.
  const { data: order } = await supabase
    .from("orders")
    .select(
      "id, created_at, status, items, amount_subtotal_cents, discount_cents, shipping",
    )
    .eq("id", body.orderId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!order) return bad("We couldn't find that order.", 404);
  if (order.status === "refunded") {
    return bad("This order has already been refunded in full.");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("lifetime_spend_cents, purchased_tier")
    .eq("id", user.id)
    .single();

  // Standing, not raw spend: a bought Adept gets the extended window too.
  const standing = standingCents(
    profile?.lifetime_spend_cents,
    profile?.purchased_tier,
  );

  if (!isWithinReturnWindow(order.created_at, standing)) {
    return bad(
      `This order is outside the ${returnWindowDays(standing)}-day return window. Write to us — we'll still take a look.`,
    );
  }

  const orderItems = (order.items ?? []) as OrderItem[];
  if (orderItems.length === 0) {
    return bad("We don't have the item detail for this order. Please email us.");
  }

  /*
   * Quantities already spoken for by an earlier return have to come off what is
   * still returnable, or the same jumper could be returned twice. Cancelled and
   * rejected returns release their items again.
   */
  const { data: existing, error: existingError } = await supabase
    .from("returns")
    .select("status, items")
    .eq("order_id", order.id);

  if (existingError) {
    console.error("[returns] Could not read existing returns:", existingError);
    return bad("We couldn't start that return. Please try again.", 502);
  }

  const claimed = new Map<string, number>();
  const key = (slug: string, size: string) => `${slug}::${size}`;

  for (const prior of existing ?? []) {
    if (!isActiveReturn(prior.status)) continue;
    for (const item of (prior.items ?? []) as OrderItem[]) {
      const k = key(item.slug, item.size);
      claimed.set(k, (claimed.get(k) ?? 0) + item.quantity);
    }
  }

  const returning: OrderItem[] = [];
  let itemsTotalCents = 0;

  for (const raw of body.items) {
    if (typeof raw.slug !== "string" || typeof raw.size !== "string") {
      return bad("Invalid item selection.");
    }

    const ordered = orderItems.find(
      (i) => i.slug === raw.slug && i.size === raw.size,
    );
    if (!ordered) return bad("That item isn't on this order.");

    const k = key(ordered.slug, ordered.size);
    if (returning.some((r) => key(r.slug, r.size) === k)) {
      return bad("That item is listed twice.");
    }

    const remaining = ordered.quantity - (claimed.get(k) ?? 0);
    if (remaining <= 0) {
      return bad(`${ordered.name} (size ${ordered.size}) is already being returned.`);
    }

    const quantity = Math.floor(Number(raw.quantity) || 0);
    if (quantity < 1) return bad("Choose how many to return.");
    if (quantity > remaining) {
      return bad(
        `You can return at most ${remaining} × ${ordered.name} (size ${ordered.size}).`,
      );
    }

    itemsTotalCents += ordered.unit_price_cents * quantity;
    returning.push({ ...ordered, quantity });
  }

  const refundAmountCents = refundableCents(
    itemsTotalCents,
    order.amount_subtotal_cents ?? 0,
    order.discount_cents ?? 0,
  );

  const country =
    (order.shipping as { address?: { country?: string } } | null)?.address
      ?.country ?? null;

  for (let attempt = 0; attempt < RMA_ATTEMPTS; attempt++) {
    const { data: created, error } = await supabase
      .from("returns")
      .insert({
        order_id: order.id,
        user_id: user.id,
        rma_code: generateRmaCode(),
        status: "requested",
        reason,
        comment,
        items: returning,
        refund_amount_cents: refundAmountCents,
        free_postage: returnPostageIsFree(reason, country),
      })
      .select("id, rma_code, status, refund_amount_cents, free_postage")
      .single();

    if (!error) return NextResponse.json({ return: created }, { status: 201 });

    // 23505 = unique violation on rma_code. Any other error is real.
    if (error.code !== "23505") {
      console.error("[returns] Insert failed:", error);
      return bad("We couldn't start that return. Please try again.", 502);
    }
  }

  return bad("We couldn't generate a return reference. Please try again.", 502);
}

/** Cancels a return the member opened, while we haven't acted on it yet. */
export async function PATCH(request: Request) {
  const supabase = await createClient();
  if (!supabase) return bad("Returns aren't connected yet.", 503);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return bad("Sign in to manage your returns.", 401);

  let body: { returnId?: unknown; action?: unknown };
  try {
    body = await request.json();
  } catch {
    return bad("Malformed request.");
  }

  if (typeof body.returnId !== "string") return bad("Which return?");
  if (body.action !== "cancel") return bad("Unsupported action.");

  const { data: existing } = await supabase
    .from("returns")
    .select("id, status")
    .eq("id", body.returnId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!existing) return bad("We couldn't find that return.", 404);
  if (!isCancellable(existing.status)) {
    return bad("This return is already under way and can no longer be cancelled.");
  }

  const { error } = await supabase
    .from("returns")
    .update({ status: "cancelled" })
    .eq("id", existing.id)
    .eq("user_id", user.id)
    .eq("status", "requested");

  if (error) {
    console.error("[returns] Cancel failed:", error);
    return bad("We couldn't cancel that return. Please try again.", 502);
  }

  return NextResponse.json({ ok: true });
}

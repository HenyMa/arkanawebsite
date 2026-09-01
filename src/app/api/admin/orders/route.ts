import { NextResponse } from "next/server";
import { getAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { isCarrierId } from "@/lib/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Long enough for any carrier's format, short enough to bound the column. */
const MAX_TRACKING = 64;

/**
 * Marks an order shipped, or puts it back in the queue.
 *
 * Mirrors /api/admin/returns: the layout's admin check doesn't protect a PATCH,
 * so authorisation is re-established here, and RLS enforces it again at the
 * database — where a column grant also means this session can only ever write
 * the three fulfilment columns, never the money ones.
 */
export async function PATCH(request: Request) {
  // 404, not 403: an unauthorised caller learns nothing about this route.
  const admin = await getAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: "Not configured." }, { status: 503 });
  }

  let body: {
    orderId?: unknown;
    action?: unknown;
    carrier?: unknown;
    trackingNumber?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  if (typeof body.orderId !== "string") {
    return NextResponse.json({ error: "Which order?" }, { status: 400 });
  }
  if (body.action !== "ship" && body.action !== "unship") {
    return NextResponse.json({ error: "Ship it or unship it." }, { status: 400 });
  }

  const { data: existing, error: readError } = await supabase
    .from("orders")
    .select("id, fulfilled_at")
    .eq("id", body.orderId)
    .maybeSingle();

  if (readError) {
    console.error("[admin/orders] Read failed:", readError);
    return NextResponse.json({ error: "Couldn't load that order." }, { status: 502 });
  }
  if (!existing) {
    return NextResponse.json({ error: "No such order." }, { status: 404 });
  }

  let patch: Record<string, string | null>;

  if (body.action === "unship") {
    patch = { fulfilled_at: null, tracking_carrier: null, tracking_number: null };
  } else {
    if (!isCarrierId(body.carrier)) {
      return NextResponse.json({ error: "Pick a carrier." }, { status: 400 });
    }

    const tracking =
      typeof body.trackingNumber === "string"
        ? body.trackingNumber.trim().slice(0, MAX_TRACKING) || null
        : null;

    patch = {
      // Preserved when it is already set, so correcting a mistyped tracking
      // number doesn't rewrite the date the parcel actually went out.
      fulfilled_at: existing.fulfilled_at ?? new Date().toISOString(),
      tracking_carrier: body.carrier,
      tracking_number: tracking,
    };
  }

  const { data: updated, error: writeError } = await supabase
    .from("orders")
    .update(patch)
    .eq("id", existing.id)
    .select("id, fulfilled_at, tracking_carrier, tracking_number")
    .maybeSingle();

  if (writeError) {
    console.error("[admin/orders] Update failed:", writeError);
    return NextResponse.json(
      {
        error:
          writeError.code === "42703"
            ? "The database is missing the fulfilment columns — re-run supabase/schema.sql."
            : "Couldn't update that order.",
      },
      { status: 502 },
    );
  }
  if (!updated) {
    // RLS returned nothing: the admin row or policy is missing.
    return NextResponse.json({ error: "That update was refused." }, { status: 403 });
  }

  return NextResponse.json({ order: updated });
}

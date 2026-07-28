import { NextResponse } from "next/server";
import { getAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { canTransition, type ReturnStatus } from "@/lib/returns";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_NOTE = 1000;

/**
 * Advances a return along its lifecycle.
 *
 * The layout's admin check does not protect this route — a POST never renders a
 * layout — so authorisation is re-established here, and RLS enforces it a third
 * time at the database. The transition itself is validated against the same map
 * the UI draws its buttons from, so a hand-crafted request can't skip a step.
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

  let body: { returnId?: unknown; status?: unknown; note?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  if (typeof body.returnId !== "string" || typeof body.status !== "string") {
    return NextResponse.json({ error: "Which return, and to what?" }, { status: 400 });
  }

  const nextStatus = body.status as ReturnStatus;
  const note =
    typeof body.note === "string" ? body.note.trim().slice(0, MAX_NOTE) || null : null;

  const { data: existing, error: readError } = await supabase
    .from("returns")
    .select("id, status, rma_code")
    .eq("id", body.returnId)
    .maybeSingle();

  if (readError) {
    console.error("[admin/returns] Read failed:", readError);
    return NextResponse.json({ error: "Couldn't load that return." }, { status: 502 });
  }
  if (!existing) {
    return NextResponse.json({ error: "No such return." }, { status: 404 });
  }

  if (!canTransition(existing.status, nextStatus)) {
    return NextResponse.json(
      {
        error:
          nextStatus === "refunded"
            ? "Refunds are recorded from Stripe. Issue the refund there and the webhook will close this out."
            : `A ${existing.status} return can't be moved to ${nextStatus}.`,
      },
      { status: 409 },
    );
  }

  // Rejecting without saying why leaves the member with nothing to act on.
  if (nextStatus === "rejected" && !note) {
    return NextResponse.json(
      { error: "Add a note explaining the rejection — the member sees it." },
      { status: 400 },
    );
  }

  const { data: updated, error: writeError } = await supabase
    .from("returns")
    .update({
      status: nextStatus,
      admin_note: note,
      handled_by: admin.id,
      handled_at: new Date().toISOString(),
    })
    .eq("id", existing.id)
    // Re-assert the status we validated against: if another admin moved this
    // return between our read and write, the update matches nothing.
    .eq("status", existing.status)
    .select("id, status, rma_code")
    .maybeSingle();

  if (writeError) {
    console.error("[admin/returns] Update failed:", writeError);
    return NextResponse.json({ error: "Couldn't update that return." }, { status: 502 });
  }
  if (!updated) {
    return NextResponse.json(
      { error: "Someone else just changed this return. Reload and try again." },
      { status: 409 },
    );
  }

  return NextResponse.json({ return: updated });
}

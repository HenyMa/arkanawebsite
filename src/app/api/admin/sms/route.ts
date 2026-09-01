import { NextResponse } from "next/server";
import { getAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSmsConfigured, messageCost } from "@/lib/sms";
import { tierByName } from "@/lib/rewards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Three segments. Past that the cost per recipient climbs without the message
 * reading any better, and a drop alert that needs 500 characters is a link.
 */
const MAX_SEGMENTS = 3;

const AUDIENCES = ["all", "paid"] as const;

/** The Adept threshold, passed to SQL so it keeps living in rewards.ts. */
function tierThresholdCents(): number {
  return tierByName("Adept")?.thresholdCents ?? Number.MAX_SAFE_INTEGER;
}

/**
 * Creates a broadcast and snapshots its recipients.
 *
 * Deliberately does not send anything: `queue_broadcast` writes one queued
 * delivery row per recipient and the separate /send route works through them in
 * batches. Splitting it this way is what makes a send resumable — a serverless
 * request that times out mid-way has still durably recorded who is owed a
 * message, and the unique (broadcast_id, user_id) constraint means picking it
 * back up can't text anyone twice.
 */
export async function POST(request: Request) {
  // 404, not 403: an unauthorised caller learns nothing about this route.
  const admin = await getAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  if (!isSmsConfigured()) {
    return NextResponse.json(
      { error: "Twilio isn't connected. Add the TWILIO_* keys to .env.local." },
      { status: 503 },
    );
  }

  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "Not configured." }, { status: 503 });
  }

  let body: { body?: unknown; audience?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  const text = typeof body.body === "string" ? body.body.trim() : "";
  if (!text) {
    return NextResponse.json({ error: "Write the message first." }, { status: 400 });
  }

  const audience = AUDIENCES.find((a) => a === body.audience);
  if (!audience) {
    return NextResponse.json({ error: "Pick an audience." }, { status: 400 });
  }

  const cost = messageCost(text);
  if (cost.segments > MAX_SEGMENTS) {
    return NextResponse.json(
      {
        error: `That's ${cost.segments} segments — the limit is ${MAX_SEGMENTS}. ${
          cost.encoding === "UCS-2"
            ? "An emoji or a curly quote has forced it to UCS-2, which halves what fits."
            : "Shorten it or link out."
        }`,
      },
      { status: 400 },
    );
  }

  const { data: broadcast, error: insertError } = await supabase
    .from("sms_broadcasts")
    .insert({ body: text, audience, created_by: admin.id })
    .select("id")
    .single();

  if (insertError) {
    console.error("[admin/sms] Couldn't create broadcast:", insertError);
    return NextResponse.json(
      {
        error:
          insertError.code === "42P01"
            ? "The database is missing the SMS tables — re-run supabase/schema.sql."
            : "Couldn't create that broadcast.",
      },
      { status: 502 },
    );
  }

  const { data: queued, error: queueError } = await supabase.rpc("queue_broadcast", {
    p_broadcast_id: broadcast.id,
    p_audience: audience,
    p_tier_threshold_cents: tierThresholdCents(),
  });

  if (queueError) {
    console.error("[admin/sms] Couldn't queue recipients:", queueError);
    return NextResponse.json({ error: "Couldn't work out who to send to." }, { status: 502 });
  }

  return NextResponse.json({ broadcastId: broadcast.id, recipients: queued ?? 0 });
}

/**
 * How many people a given audience would reach right now.
 *
 * Powers the live count next to the composer, so nobody discovers the list was
 * empty — or ten times bigger than they thought — only after pressing send.
 */
export async function GET(request: Request) {
  const admin = await getAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "Not configured." }, { status: 503 });
  }

  const audience =
    AUDIENCES.find((a) => a === new URL(request.url).searchParams.get("audience")) ??
    "all";

  let query = supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .not("phone", "is", null)
    .not("phone_verified_at", "is", null)
    .not("sms_consent_at", "is", null)
    .is("sms_opt_out_at", null);

  // Mirrors the `or` in queue_broadcast: spent their way in, or bought a tier.
  if (audience === "paid") {
    query = query.or(
      `lifetime_spend_cents.gte.${tierThresholdCents()},purchased_tier.not.is.null`,
    );
  }

  const { count, error } = await query;

  if (error) {
    // 42703 = the SMS columns aren't there yet. Reported as zero with a flag so
    // the composer can say why rather than implying nobody has signed up.
    if (error.code === "42703") {
      return NextResponse.json({ count: 0, needsSchema: true });
    }
    console.error("[admin/sms] Couldn't count recipients:", error);
    return NextResponse.json({ error: "Couldn't count recipients." }, { status: 502 });
  }

  return NextResponse.json({ count: count ?? 0 });
}

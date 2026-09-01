import { NextResponse } from "next/server";
import { getAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendSms } from "@/lib/sms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Recipients per request.
 *
 * Bounded by the serverless timeout, not by Twilio: a Messaging Service queues
 * and paces delivery itself, so the constraint is how many round trips fit in
 * one invocation. Twenty-five at roughly 200ms each leaves plenty of headroom
 * under a 10s limit, and the client just calls again until nothing is left.
 */
const BATCH_SIZE = 25;

/**
 * Sends one batch of a broadcast, then reports what's left.
 *
 * Every delivery row is claimed before its message goes out, so a crash between
 * sending and recording leaves the row marked rather than queued — this fails
 * towards *not* re-sending. Combined with the unique (broadcast_id, user_id)
 * constraint, that is what makes the whole thing safe to retry: the worst case
 * is somebody misses a drop alert, never that they get it twice.
 */
export async function POST(request: Request) {
  const admin = await getAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "Not configured." }, { status: 503 });
  }

  let body: { broadcastId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  if (typeof body.broadcastId !== "string") {
    return NextResponse.json({ error: "Which broadcast?" }, { status: 400 });
  }

  const { data: broadcast, error: readError } = await supabase
    .from("sms_broadcasts")
    .select("id, body, completed_at")
    .eq("id", body.broadcastId)
    .maybeSingle();

  if (readError) {
    console.error("[admin/sms/send] Couldn't load broadcast:", readError);
    return NextResponse.json({ error: "Couldn't load that broadcast." }, { status: 502 });
  }
  if (!broadcast) {
    return NextResponse.json({ error: "No such broadcast." }, { status: 404 });
  }

  const { data: batch, error: batchError } = await supabase
    .from("sms_deliveries")
    .select("id, phone, user_id")
    .eq("broadcast_id", broadcast.id)
    .eq("status", "queued")
    .limit(BATCH_SIZE);

  if (batchError) {
    console.error("[admin/sms/send] Couldn't load batch:", batchError);
    return NextResponse.json({ error: "Couldn't load the queue." }, { status: 502 });
  }

  let sent = 0;
  let failed = 0;

  for (const delivery of batch ?? []) {
    /*
     * Claim first. The update is conditional on the row still being queued, so
     * two overlapping requests can't both take the same recipient — whichever
     * loses gets no row back and skips.
     */
    const { data: claimed } = await supabase
      .from("sms_deliveries")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", delivery.id)
      .eq("status", "queued")
      .select("id")
      .maybeSingle();

    if (!claimed) continue;

    const result = await sendSms(delivery.phone, broadcast.body);

    if (result.ok) {
      sent++;
      await supabase
        .from("sms_deliveries")
        .update({ provider_sid: result.sid })
        .eq("id", delivery.id);
    } else {
      failed++;
      await supabase
        .from("sms_deliveries")
        .update({ status: "failed", error: result.error.slice(0, 500) })
        .eq("id", delivery.id);

      /*
       * Twilio refusing because the recipient has sent STOP means our copy of
       * their status is stale — the carrier knows something we don't. Recording
       * it here stops the next broadcast queueing them at all.
       */
      if (result.error === "unsubscribed") {
        await supabase.rpc("record_sms_opt_out", {
          p_phone: delivery.phone,
          p_source: "sms_stop",
        });
      }
    }
  }

  const { count: remaining } = await supabase
    .from("sms_deliveries")
    .select("id", { count: "exact", head: true })
    .eq("broadcast_id", broadcast.id)
    .eq("status", "queued");

  const left = remaining ?? 0;

  if (left === 0 && !broadcast.completed_at) {
    await supabase
      .from("sms_broadcasts")
      .update({ completed_at: new Date().toISOString() })
      .eq("id", broadcast.id);
  }

  return NextResponse.json({ sent, failed, remaining: left });
}

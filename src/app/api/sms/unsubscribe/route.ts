import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Turns drop alerts off from the account page.
 *
 * Reads the number off the profile rather than taking it from the request: the
 * only number a member may unsubscribe is their own, and accepting one from the
 * body would let a signed-in account silence anybody's.
 *
 * The number is kept on the profile — see `record_sms_opt_out` for why. Opting
 * back in is a fresh verification, which is the correct bar: consent that was
 * withdrawn has to be given again.
 */
export async function POST() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "Not configured." }, { status: 503 });
  }

  const { data: profile, error: readError } = await supabase
    .from("profiles")
    .select("phone")
    .eq("id", user.id)
    .single();

  if (readError) {
    console.error("[sms] Couldn't read profile:", readError);
    return NextResponse.json({ error: "Try again in a moment." }, { status: 502 });
  }
  if (!profile?.phone) {
    // Already unsubscribed, or never subscribed. Either way, done.
    return NextResponse.json({ ok: true });
  }

  const { error } = await supabase.rpc("record_sms_opt_out", {
    p_phone: profile.phone,
    p_source: "account",
  });

  if (error) {
    console.error("[sms] Couldn't record opt-out:", error);
    return NextResponse.json({ error: "We couldn't save that." }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}

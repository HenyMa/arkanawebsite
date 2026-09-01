import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalisePhone, startVerification } from "@/lib/sms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Codes a single account may request in the window below. */
const MAX_ATTEMPTS = 5;
const WINDOW_MINUTES = 15;

/**
 * Starts phone verification: sends a one-time code to a number a member has
 * just typed in.
 *
 * Twilio Verify rate-limits per *destination number*, which stops one number
 * being bombarded. It does not stop one account walking a whole range of
 * numbers, each getting a single unsolicited message — so this route rate
 * limits per account as well, counting from the consent log.
 */
export async function POST(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "Not configured." }, { status: 503 });
  }

  let body: { phone?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  if (typeof body.phone !== "string") {
    return NextResponse.json({ error: "Enter a phone number." }, { status: 400 });
  }

  const phone = normalisePhone(body.phone);
  if (!phone) {
    return NextResponse.json(
      {
        error:
          "That doesn't look like a phone number. Include your country code if you're outside the US.",
      },
      { status: 400 },
    );
  }

  /*
   * Counted over 'attempted' rows — codes *requested*, not codes confirmed.
   * Counting successes would miss the whole case this guards against: someone
   * walking a range of numbers, each of which gets one unsolicited message and
   * none of which is ever confirmed.
   */
  const since = new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString();
  const { count } = await supabase
    .from("sms_consent_log")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("action", "attempted")
    .gte("created_at", since);

  if ((count ?? 0) >= MAX_ATTEMPTS) {
    return NextResponse.json(
      { error: `Too many attempts. Try again in ${WINDOW_MINUTES} minutes.` },
      { status: 429 },
    );
  }

  // Recorded before the send, so a Twilio call that succeeds but whose response
  // we never see still counts against the limit.
  await supabase.from("sms_consent_log").insert({
    user_id: user.id,
    phone,
    action: "attempted",
    source: "account",
  });

  const result = await startVerification(phone);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.retryable ? 502 : 400 });
  }

  // Echoed back so the check step sends exactly what was verified rather than
  // re-normalising possibly-different input.
  return NextResponse.json({ phone });
}

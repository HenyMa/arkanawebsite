import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkVerification, normalisePhone } from "@/lib/sms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Where the opt-in happened. Recorded verbatim in the consent log. */
const SOURCES = ["account", "signup", "checkout"];

/**
 * Confirms a one-time code and records consent.
 *
 * This is the only place a number becomes reachable, and it writes with the
 * service-role key: `profiles` grants `authenticated` update on `full_name`
 * alone, so a member cannot set `phone_verified_at` on themselves even with a
 * hand-crafted request against the anon key.
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

  let body: { phone?: unknown; code?: unknown; source?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  const phone =
    typeof body.phone === "string" ? normalisePhone(body.phone) : null;
  const code =
    typeof body.code === "string" ? body.code.trim().replace(/\D/g, "") : "";

  if (!phone) {
    return NextResponse.json({ error: "Which number?" }, { status: 400 });
  }
  if (code.length < 4) {
    return NextResponse.json({ error: "Enter the code we sent you." }, { status: 400 });
  }

  const source =
    typeof body.source === "string" && SOURCES.includes(body.source)
      ? body.source
      : "account";

  const approved = await checkVerification(phone, code);
  if (!approved) {
    // Wrong and expired are deliberately indistinguishable — telling them apart
    // would confirm which numbers have a live verification in flight.
    return NextResponse.json(
      { error: "That code didn't work. Check it, or send a new one." },
      { status: 400 },
    );
  }

  const { error } = await supabase.rpc("claim_verified_phone", {
    p_user_id: user.id,
    p_phone: phone,
    p_source: source,
  });

  if (error) {
    console.error("[sms] Couldn't record consent:", error);
    return NextResponse.json(
      {
        error:
          error.code === "42883"
            ? "The database is missing the SMS functions — re-run supabase/schema.sql."
            : "We couldn't save that. Try again in a moment.",
      },
      { status: 502 },
    );
  }

  return NextResponse.json({ phone });
}

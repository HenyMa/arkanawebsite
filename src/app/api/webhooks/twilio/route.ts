import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { keywordFor, normalisePhone, validateTwilioSignature } from "@/lib/sms";
import { siteUrl } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** An empty TwiML document: acknowledged, no auto-reply from us. */
const NO_REPLY = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';

function twiml() {
  return new NextResponse(NO_REPLY, {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}

/**
 * Inbound messages from Twilio — in practice, STOP and START.
 *
 * Twilio and the carriers honour these keywords themselves, before this route
 * runs; a member who texts STOP stops receiving messages whether or not this
 * code works. What this does is keep *our* copy of that state honest, so the
 * account page doesn't claim someone is subscribed when the carrier has already
 * cut them off, and so recipient counts mean something.
 *
 * Because Twilio has already replied to the sender with its own confirmation,
 * this returns empty TwiML — a second "you're unsubscribed" message would be
 * both redundant and billable.
 */
export async function POST(request: Request) {
  const signature = request.headers.get("x-twilio-signature");

  // Twilio posts form-encoded, and the signature covers the raw parameters.
  const form = await request.formData();
  const params: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    if (typeof value === "string") params[key] = value;
  }

  /*
   * The URL has to be byte-identical to the one configured in the Twilio
   * console, because it is the first thing fed into the HMAC. Rebuilt from
   * NEXT_PUBLIC_SITE_URL rather than read off the request: behind a proxy the
   * incoming URL is often http://internal-host/... which would never match.
   */
  const url = `${siteUrl()}/api/webhooks/twilio`;

  if (!validateTwilioSignature(url, params, signature)) {
    // Unsigned or misconfigured. Refused rather than trusted: without this
    // check, anyone who learned the URL could post Body=STOP with someone
    // else's From and unsubscribe them.
    console.error("[twilio] Signature verification failed.");
    return NextResponse.json({ error: "Invalid signature." }, { status: 403 });
  }

  const keyword = keywordFor(params.Body ?? "");
  const phone = normalisePhone(params.From ?? "");

  if (!keyword || !phone) return twiml();

  const supabase = createAdminClient();
  if (!supabase) {
    console.warn("[twilio] SUPABASE_SERVICE_ROLE_KEY is not set; keyword ignored.");
    return twiml();
  }

  try {
    if (keyword === "stop") {
      const { error } = await supabase.rpc("record_sms_opt_out", {
        p_phone: phone,
        p_source: "sms_stop",
      });
      if (error) throw error;
    } else {
      /*
       * START only revives a number this account already verified — it does not
       * create consent from nothing. Someone texting START to a number we have
       * never seen gets no row, which is correct: a text to a shortcode is not
       * the written consent the rules ask for.
       */
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("phone", phone)
        .not("phone_verified_at", "is", null)
        .maybeSingle();

      if (profile) {
        await supabase
          .from("profiles")
          .update({ sms_opt_out_at: null, sms_consent_at: new Date().toISOString() })
          .eq("id", profile.id);

        await supabase.from("sms_consent_log").insert({
          user_id: profile.id,
          phone,
          action: "opted_in",
          source: "sms_start",
        });
      }
    }
  } catch (err) {
    // Returning 500 makes Twilio retry, which is what we want — but never at
    // the cost of the member's own STOP, which the carrier honoured already.
    console.error(`[twilio] Failed to handle ${keyword}:`, err);
    return NextResponse.json({ error: "Processing failed." }, { status: 500 });
  }

  return twiml();
}

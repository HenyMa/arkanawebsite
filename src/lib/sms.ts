import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Twilio, over plain fetch.
 *
 * No SDK: the three endpoints this site touches are form-encoded POSTs with
 * basic auth, and the official package pulls in a large dependency tree to wrap
 * them. The Stripe SDK earns its place because it also brings webhook signature
 * verification and a typed event union; there is nothing equivalent to gain
 * here, and `validateTwilioSignature` below is twelve lines.
 *
 * Every function returns null or throws rather than falling back to a no-op
 * send — silently not sending is the one failure mode that would be invisible.
 */

const TWILIO_API = "https://api.twilio.com/2010-04-01";
const VERIFY_API = "https://verify.twilio.com/v2";

type TwilioConfig = {
  accountSid: string;
  authToken: string;
  messagingServiceSid: string;
  verifyServiceSid: string;
};

/**
 * Config, or null when Twilio hasn't been set up.
 *
 * Mirrors `getStripe()`: the storefront has to render before the keys exist, so
 * callers surface a "not connected yet" message rather than throwing at import.
 */
export function getTwilioConfig(): TwilioConfig | null {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
  const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

  if (!accountSid || !authToken || !messagingServiceSid || !verifyServiceSid) {
    return null;
  }
  return { accountSid, authToken, messagingServiceSid, verifyServiceSid };
}

export function isSmsConfigured(): boolean {
  return getTwilioConfig() !== null;
}

function authHeader(config: TwilioConfig): string {
  const raw = `${config.accountSid}:${config.authToken}`;
  return `Basic ${Buffer.from(raw).toString("base64")}`;
}

async function post(
  config: TwilioConfig,
  url: string,
  fields: Record<string, string>,
): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; status: number; message: string; code: number | null }> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: authHeader(config),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(fields).toString(),
  });

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;

  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      message: typeof data.message === "string" ? data.message : "Twilio rejected the request.",
      code: typeof data.code === "number" ? data.code : null,
    };
  }
  return { ok: true, data };
}

/*
 * Phone and message helpers live in ./sms-format so Client Components can use
 * them without pulling `node:crypto` and the Twilio credentials into the
 * browser bundle. Re-exported here so server code has one import to reach for.
 */
export {
  formatPhone,
  keywordFor,
  messageCost,
  normalisePhone,
  START_KEYWORDS,
  STOP_KEYWORDS,
  type MessageCost,
} from "./sms-format";

// ---------------------------------------------------------------------------
// Verify — proving a number belongs to the person entering it
// ---------------------------------------------------------------------------

export type VerifyResult =
  | { ok: true }
  | { ok: false; error: string; retryable: boolean };

/** Sends a one-time code. */
export async function startVerification(phone: string): Promise<VerifyResult> {
  const config = getTwilioConfig();
  if (!config) return { ok: false, error: "SMS isn't connected yet.", retryable: false };

  const res = await post(
    config,
    `${VERIFY_API}/Services/${config.verifyServiceSid}/Verifications`,
    { To: phone, Channel: "sms" },
  );

  if (res.ok) return { ok: true };

  // 60200 = invalid parameter, i.e. the number isn't real. 60203 = too many
  // attempts on this number; Twilio is already rate limiting us, and saying so
  // is more useful than a generic failure.
  if (res.code === 60200) {
    return { ok: false, error: "That doesn't look like a valid number.", retryable: false };
  }
  if (res.code === 60203) {
    return {
      ok: false,
      error: "Too many codes sent to that number. Try again in a few minutes.",
      retryable: false,
    };
  }

  console.error(
    `[sms] Verification start failed: ${res.status} (code ${res.code ?? "none"}) ${res.message}`,
  );

  /*
   * A 403 is Twilio refusing on account grounds, not a transient fault — most
   * often a trial account, which may only message numbers added to its Verified
   * Caller IDs list. Retrying can never fix it, so it must not be reported as
   * something to try again: the operator needs to know it's the account.
   */
  if (res.status === 403) {
    return {
      ok: false,
      error: /trial/i.test(res.message)
        ? "Twilio is on a trial account, which can only text numbers added to its Verified Caller IDs list. Add this number there, or upgrade the account."
        : "Twilio refused that number. Check the account's status and permissions.",
      retryable: false,
    };
  }

  return { ok: false, error: "Couldn't send the code. Try again shortly.", retryable: true };
}

/** Checks a code. False means wrong or expired — the caller must not distinguish. */
export async function checkVerification(
  phone: string,
  code: string,
): Promise<boolean> {
  const config = getTwilioConfig();
  if (!config) return false;

  const res = await post(
    config,
    `${VERIFY_API}/Services/${config.verifyServiceSid}/VerificationCheck`,
    { To: phone, Code: code },
  );

  // A wrong code comes back as 404 once the attempt is consumed, which is not
  // an error worth logging — only an unexpected status is.
  if (!res.ok) {
    if (res.status !== 404) {
      console.error("[sms] Verification check failed:", res.status, res.message);
    }
    return false;
  }

  return res.data.status === "approved";
}

// ---------------------------------------------------------------------------
// Sending
// ---------------------------------------------------------------------------

export type SendResult =
  | { ok: true; sid: string }
  | { ok: false; error: string };

/**
 * Sends one message through the Messaging Service.
 *
 * Using a Messaging Service rather than a bare `From` number is what gives you
 * carrier-level STOP handling, number pooling, and the 10DLC campaign
 * association — none of which you get by posting a From.
 */
export async function sendSms(phone: string, body: string): Promise<SendResult> {
  const config = getTwilioConfig();
  if (!config) return { ok: false, error: "SMS isn't connected." };

  const res = await post(config, `${TWILIO_API}/Accounts/${config.accountSid}/Messages.json`, {
    To: phone,
    MessagingServiceSid: config.messagingServiceSid,
    Body: body,
  });

  if (!res.ok) {
    // 21610 = the recipient has sent STOP. Twilio blocks it at their end, which
    // is exactly right, and our copy of their status is simply stale.
    if (res.code === 21610) return { ok: false, error: "unsubscribed" };
    return { ok: false, error: res.message };
  }

  return {
    ok: true,
    sid: typeof res.data.sid === "string" ? res.data.sid : "",
  };
}

// ---------------------------------------------------------------------------
// Inbound webhook signatures
// ---------------------------------------------------------------------------

/**
 * Validates X-Twilio-Signature on an inbound request.
 *
 * Twilio signs the full request URL with the POST parameters appended in
 * *alphabetical order by key*, HMAC-SHA1 with the auth token, base64. Without
 * this check anyone who learns the webhook URL could post `Body=STOP` and
 * unsubscribe an arbitrary number.
 *
 * The URL must be the one Twilio was configured with, including scheme and any
 * port — a proxy that rewrites it will break the comparison, which is why it is
 * passed in rather than read off the request.
 */
export function validateTwilioSignature(
  url: string,
  params: Record<string, string>,
  signature: string | null,
): boolean {
  const config = getTwilioConfig();
  if (!config || !signature) return false;

  const payload = Object.keys(params)
    .sort()
    .reduce((acc, key) => acc + key + params[key], url);

  const expected = createHmac("sha1", config.authToken)
    .update(Buffer.from(payload, "utf-8"))
    .digest("base64");

  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  // timingSafeEqual throws on a length mismatch, which is itself a failure.
  return a.length === b.length && timingSafeEqual(a, b);
}

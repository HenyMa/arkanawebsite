/**
 * Phone and message helpers with no Node dependencies.
 *
 * Split out of src/lib/sms.ts so the composer and the account panel — both
 * Client Components — can count segments and format numbers without dragging
 * `node:crypto` and the Twilio credentials into the browser bundle. Anything
 * that talks to Twilio or verifies a signature belongs in sms.ts, not here.
 */

/**
 * Normalises user input to E.164, or null if it can't be.
 *
 * Deliberately permissive about *formatting* and strict about *shape*: people
 * paste numbers with brackets, dots, and spaces, but the stored value has to be
 * canonical or the unique index and the STOP webhook won't match it against the
 * same number arriving in a different format.
 *
 * A bare 10-digit number is assumed to be US/Canada, which is the only place
 * that assumption is safe — everywhere else the caller must include the country
 * code. Twilio Verify is the real validator; this just stops obvious nonsense
 * before spending an API call on it.
 */
export function normalisePhone(input: string): string | null {
  const trimmed = input.trim();
  const hadPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");

  if (!digits) return null;

  if (!hadPlus && digits.length === 10) return `+1${digits}`;
  // 11 digits starting with 1 is a US number written without the plus.
  if (!hadPlus && digits.length === 11 && digits.startsWith("1")) return `+${digits}`;

  // E.164 allows at most 15 digits, and no country code is shorter than 8 total.
  if (digits.length < 8 || digits.length > 15) return null;

  return `+${digits}`;
}

/** Renders a stored E.164 number for display, e.g. +14155552671 -> (415) 555-2671. */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return "";
  const us = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(phone);
  if (us) return `(${us[1]}) ${us[2]}-${us[3]}`;
  return phone;
}

/**
 * The GSM-7 alphabet. Anything outside it forces the whole message into UCS-2,
 * which more than halves how much fits in a segment — one curly apostrophe
 * pasted from a word processor can turn a one-segment message into two, and you
 * are billed per segment per recipient.
 */
const GSM7 =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?" +
  "¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
/** These cost two GSM-7 characters each, not one. */
const GSM7_EXTENDED = "^{}\\[~]|€";

export type MessageCost = {
  characters: number;
  segments: number;
  encoding: "GSM-7" | "UCS-2";
};

/** What a message body will actually cost to send, per recipient. */
export function messageCost(body: string): MessageCost {
  const chars = [...body];
  const isGsm7 = chars.every(
    (c) => GSM7.includes(c) || GSM7_EXTENDED.includes(c),
  );

  if (!isGsm7) {
    const units = chars.length;
    return {
      characters: units,
      encoding: "UCS-2",
      segments: units === 0 ? 0 : units <= 70 ? 1 : Math.ceil(units / 67),
    };
  }

  const units = chars.reduce(
    (sum, c) => sum + (GSM7_EXTENDED.includes(c) ? 2 : 1),
    0,
  );
  return {
    characters: units,
    encoding: "GSM-7",
    segments: units === 0 ? 0 : units <= 160 ? 1 : Math.ceil(units / 153),
  };
}

/**
 * The keywords carriers require to work. Twilio honours these at their end
 * whatever we do; recognising them here is how the site's own copy of the state
 * keeps up, so recipient counts and the account page don't claim someone is
 * subscribed when the carrier has already stopped delivering to them.
 */
export const STOP_KEYWORDS = ["stop", "stopall", "unsubscribe", "cancel", "end", "quit"];
export const START_KEYWORDS = ["start", "unstop", "yes"];

export function keywordFor(body: string): "stop" | "start" | null {
  const word = body.trim().toLowerCase().replace(/[^a-z]/g, "");
  if (STOP_KEYWORDS.includes(word)) return "stop";
  if (START_KEYWORDS.includes(word)) return "start";
  return null;
}

/**
 * Returns.
 *
 * The rules live here so the policy copy on /shipping, the eligibility check in
 * the account UI, and the validation in /api/returns are all reading from the
 * same source. The API route is the authority — everything the browser decides
 * is re-decided server-side before a request is accepted.
 *
 * Lifecycle of a return:
 *
 *   requested ─┬─> approved ──> in_transit ──> received ──> refunded
 *              ├─> rejected
 *              └─> cancelled            (member changed their mind)
 *
 * Only `requested` and `cancelled` are ever written by a member. Everything
 * after approval is moved by the studio, and `refunded` is written by the
 * Stripe webhook when the refund actually settles — never by hand — so the
 * status can't claim money moved when it didn't.
 */

/** Days from delivery a return can be opened. */
export const RETURN_WINDOW_DAYS = 30;

/** Extended window for Adept and Oracle members. Matches the perk on /rewards. */
export const EXTENDED_RETURN_WINDOW_DAYS = 60;

/** Lifetime spend at which the extended window unlocks (the Adept threshold). */
const EXTENDED_WINDOW_THRESHOLD_CENTS = 30000;

export const RETURN_REASONS = [
  { value: "size", label: "Wrong size" },
  { value: "fit", label: "Didn't fit as expected" },
  { value: "not_as_described", label: "Not as described" },
  { value: "faulty", label: "Arrived faulty or damaged" },
  { value: "wrong_item", label: "Wrong item sent" },
  { value: "changed_mind", label: "Changed my mind" },
] as const;

export type ReturnReason = (typeof RETURN_REASONS)[number]["value"];

export function isReturnReason(value: unknown): value is ReturnReason {
  return RETURN_REASONS.some((r) => r.value === value);
}

export function reasonLabel(value: string): string {
  return RETURN_REASONS.find((r) => r.value === value)?.label ?? value;
}

/** Reasons that are our fault, and so never cost the customer return postage. */
const OUR_FAULT: ReturnReason[] = ["faulty", "wrong_item", "not_as_described"];

export type ReturnStatus =
  | "requested"
  | "approved"
  | "in_transit"
  | "received"
  | "refunded"
  | "rejected"
  | "cancelled";

export const RETURN_STATUS_COPY: Record<
  ReturnStatus,
  { label: string; description: string }
> = {
  requested: {
    label: "Requested",
    description:
      "We've got your request and will email a prepaid label within one business day.",
  },
  approved: {
    label: "Label sent",
    description:
      "Your return label is on its way to your inbox. Send the parcel back within 14 days.",
  },
  in_transit: {
    label: "On its way back",
    description: "The carrier has your parcel. We'll email once it reaches us.",
  },
  received: {
    label: "Received",
    description:
      "Your return is with us and being checked. Refunds are issued within two business days.",
  },
  refunded: {
    label: "Refunded",
    description:
      "Refunded to your original payment method. Banks usually take 3–5 days to show it.",
  },
  rejected: {
    label: "Not accepted",
    description:
      "We couldn't accept this return. Check your email — we'll always explain why.",
  },
  cancelled: {
    label: "Cancelled",
    description: "You cancelled this return request. Nothing was sent back.",
  },
};

/**
 * What the studio may move a return to, from where.
 *
 * `refunded` is reachable from no state here, on purpose. It is written only by
 * the charge.refunded webhook, so the status can never claim money moved when
 * Stripe disagrees. The same whitelist is enforced by RLS in schema.sql.
 */
export const ADMIN_TRANSITIONS: Record<ReturnStatus, ReturnStatus[]> = {
  requested: ["approved", "rejected"],
  approved: ["in_transit", "rejected"],
  in_transit: ["received"],
  // Received but not yet refunded: either issue the refund in Stripe (which
  // closes it out via the webhook) or reject it if it came back unsellable.
  received: ["rejected"],
  refunded: [],
  rejected: [],
  cancelled: [],
};

/** Button copy for each transition, phrased as the action being taken. */
export const TRANSITION_LABEL: Record<ReturnStatus, string> = {
  requested: "Reopen",
  approved: "Approve & send label",
  in_transit: "Mark posted",
  received: "Mark received",
  refunded: "Refunded",
  rejected: "Reject",
  cancelled: "Cancel",
};

export function canTransition(from: string, to: string): boolean {
  const allowed = ADMIN_TRANSITIONS[from as ReturnStatus];
  return Boolean(allowed?.includes(to as ReturnStatus));
}

/** Returns sitting on the studio's desk, in the order they need attention. */
export const ACTIONABLE_STATUSES: ReturnStatus[] = [
  "requested",
  "approved",
  "in_transit",
  "received",
];

/** Statuses where the return is still live and the items are spoken for. */
export const ACTIVE_RETURN_STATUSES: ReturnStatus[] = [
  "requested",
  "approved",
  "in_transit",
  "received",
  "refunded",
];

export function isActiveReturn(status: string): boolean {
  return ACTIVE_RETURN_STATUSES.includes(status as ReturnStatus);
}

/** Whether a member can still cancel the request themselves. */
export function isCancellable(status: string): boolean {
  return status === "requested";
}

/** The return window for a member, in days. Guests get the standard window. */
export function returnWindowDays(lifetimeSpendCents: number | null): number {
  return (lifetimeSpendCents ?? 0) >= EXTENDED_WINDOW_THRESHOLD_CENTS
    ? EXTENDED_RETURN_WINDOW_DAYS
    : RETURN_WINDOW_DAYS;
}

/**
 * The last day a return can be opened.
 *
 * Measured from the order date rather than delivery: we don't ingest carrier
 * delivery events, and dating from the order is always the more generous of the
 * two readings for the customer.
 */
export function returnDeadline(
  orderedAt: string | Date,
  lifetimeSpendCents: number | null,
): Date {
  const start = new Date(orderedAt);
  const deadline = new Date(start);
  deadline.setDate(deadline.getDate() + returnWindowDays(lifetimeSpendCents));
  return deadline;
}

export function isWithinReturnWindow(
  orderedAt: string | Date,
  lifetimeSpendCents: number | null,
  now: Date = new Date(),
): boolean {
  return now <= returnDeadline(orderedAt, lifetimeSpendCents);
}

export function daysLeftToReturn(
  orderedAt: string | Date,
  lifetimeSpendCents: number | null,
  now: Date = new Date(),
): number {
  const ms = returnDeadline(orderedAt, lifetimeSpendCents).getTime() - now.getTime();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

/** Whether we cover return postage. Always true domestically; see /shipping. */
export function returnPostageIsFree(
  reason: ReturnReason,
  countryCode: string | null,
): boolean {
  if (OUR_FAULT.includes(reason)) return true;
  return (countryCode ?? "US").toUpperCase() === "US";
}

/**
 * What a set of returned items is actually worth back.
 *
 * An order-level discount (the member welcome discount, a promo code) has to be
 * shared across the returned lines, or a member could return the cheap half of
 * a discounted order and be refunded more than they paid for it.
 */
export function refundableCents(
  itemsTotalCents: number,
  orderSubtotalCents: number,
  orderDiscountCents: number,
): number {
  if (itemsTotalCents <= 0) return 0;
  if (orderDiscountCents <= 0 || orderSubtotalCents <= 0) return itemsTotalCents;

  const share = Math.min(1, itemsTotalCents / orderSubtotalCents);
  const discountShare = Math.round(orderDiscountCents * share);
  return Math.max(0, itemsTotalCents - discountShare);
}

/** Human-readable RMA reference, e.g. `ARK-7Q2K4M`. Collisions are caught by a
 * unique index on the table, and the caller retries. */
export function generateRmaCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I/O/0/1
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  const body = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
  return `ARK-${body}`;
}

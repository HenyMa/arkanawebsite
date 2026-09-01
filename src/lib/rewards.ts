/**
 * The Arkana Circle — the rewards program.
 *
 * Rules are defined here and enforced server-side (points are only ever minted
 * in the Stripe webhook; discounts are only ever applied in the checkout route).
 * Keeping the constants in one module means the marketing copy on /rewards and
 * the logic that honours it can never drift apart.
 *
 * A tier is reached in one of two ways: by spending, or by buying it outright.
 * Both are expressed as a single number — see `standingCents` — so every rule
 * below stays keyed on one input and a bought tier is honoured everywhere a
 * spent one is, without threading a second argument through the whole codebase.
 */

/** Points granted per whole dollar spent, before shipping and tax. */
export const POINTS_PER_DOLLAR = 1;

/** Points handed out once, when an account is first created. */
export const SIGNUP_BONUS = 100;

/** Points required to redeem, and what that redemption is worth in cents. */
export const REDEMPTION_THRESHOLD = 500;
export const REDEMPTION_VALUE_CENTS = 2500;

/**
 * Percentage off a member's first order after joining. Applied automatically at
 * checkout — there is no code to enter — and burned once used, so it cannot be
 * claimed twice from the same account.
 */
export const WELCOME_DISCOUNT_PERCENT = 20;

/** The discount in cents for a given subtotal. Rounds to the nearest cent. */
export function welcomeDiscountCents(subtotalCents: number): number {
  return Math.round((subtotalCents * WELCOME_DISCOUNT_PERCENT) / 100);
}

/**
 * Percentage off a member's *second* order — a one-time perk, exactly like the
 * welcome discount, and burned the same way once it has been paid for.
 *
 * Two rates: everyone gets the base one, Adept and Oracle members get the
 * higher one. `standing` decides which, so a tier that was bought outright is
 * honoured identically to one that was spent into.
 *
 * These never compete with the welcome discount. That one is only offered on
 * order zero and this one only on order one, so the two are mutually exclusive
 * by construction — which matters, because Stripe Checkout accepts a single
 * coupon per session and could not apply both anyway.
 */
export const SECOND_ORDER_DISCOUNT_PERCENT = 10;
export const TIER_SECOND_ORDER_DISCOUNT_PERCENT = 20;

/**
 * Tiers that can be bought outright, and what they cost.
 *
 * A membership is a single payment and never expires, which matches how earned
 * tiers already work: once you're in a tier, it's yours.
 */
export const MEMBERSHIP_PRICE_CENTS = {
  Adept: 9900,
  Oracle: 19900,
} as const;

export type PurchasableTier = keyof typeof MEMBERSHIP_PRICE_CENTS;

export function isPurchasableTier(value: unknown): value is PurchasableTier {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(MEMBERSHIP_PRICE_CENTS, value)
  );
}

export type Tier = {
  name: string;
  /** Lifetime spend in cents required to enter this tier. */
  thresholdCents: number;
  /** Multiplier applied to points earned on every order. */
  multiplier: number;
  perks: string[];
};

export const TIERS: Tier[] = [
  {
    name: "Initiate",
    thresholdCents: 0,
    multiplier: 1,
    perks: [
      "100 points the moment you join",
      `${WELCOME_DISCOUNT_PERCENT}% off your first order as a member`,
      `${SECOND_ORDER_DISCOUNT_PERCENT}% off your second`,
      "1 point per dollar spent",
      "A text the moment a drop lands",
    ],
  },
  {
    name: "Adept",
    thresholdCents: 30000,
    multiplier: 1.25,
    perks: [
      `${TIER_SECOND_ORDER_DISCOUNT_PERCENT}% off your second order`,
      "1.25 points per dollar spent",
      "Extended 60-day return window",
      "The exclusive look, texted before it's announced",
    ],
  },
  {
    name: "Oracle",
    thresholdCents: 75000,
    multiplier: 1.5,
    perks: [
      `${TIER_SECOND_ORDER_DISCOUNT_PERCENT}% off your second order`,
      "1.5 points per dollar spent",
      "Extended 60-day return window",
      "Free express shipping",
      "The exclusive look, texted before it's announced",
      "Reserved sizing on limited runs",
    ],
  },
];

export function tierByName(name: string | null | undefined): Tier | null {
  return TIERS.find((t) => t.name === name) ?? null;
}

/**
 * A member's standing, expressed as the spend their tier is worth.
 *
 * Buying a tier is treated as having spent your way into it, so `tierFor`,
 * `nextTierFor`, `pointsForOrder`, the return window, and the shipping perks
 * all keep working off a single number. Pass the result of this anywhere those
 * functions ask for lifetime spend — and pass the raw figure only when you mean
 * to *display* what someone has actually spent.
 */
export function standingCents(
  lifetimeSpendCents: number | null | undefined,
  purchasedTier: string | null | undefined,
): number {
  return Math.max(
    lifetimeSpendCents ?? 0,
    tierByName(purchasedTier)?.thresholdCents ?? 0,
  );
}

/**
 * The lowest tier that counts as a paying member for perk purposes. Derived
 * rather than written out, and falling back to unreachable rather than zero, so
 * a rename in TIERS can only ever withdraw a perk — never hand it to everyone.
 */
const TIER_MEMBER_FROM_CENTS =
  tierByName("Adept")?.thresholdCents ?? Number.POSITIVE_INFINITY;

/** Whether a standing places a member in Adept or Oracle. */
export function isTierMember(standing: number): boolean {
  return standing >= TIER_MEMBER_FROM_CENTS;
}

/** The rate a given standing gets on its second order. */
export function secondOrderDiscountPercent(standing: number): number {
  return isTierMember(standing)
    ? TIER_SECOND_ORDER_DISCOUNT_PERCENT
    : SECOND_ORDER_DISCOUNT_PERCENT;
}

/**
 * The second-order discount on a basket, in cents.
 *
 * Being a percentage, it can never exceed the basket, so unlike a fixed amount
 * there is no minimum order to enforce. Eligibility — that this really is the
 * member's second order, and that they haven't had it already — is decided in
 * the checkout route, not here.
 */
export function secondOrderDiscountCents(
  standing: number,
  subtotalCents: number,
): number {
  return Math.round(
    (subtotalCents * secondOrderDiscountPercent(standing)) / 100,
  );
}

/** Resolves the tier a member currently sits in from their lifetime spend. */
export function tierFor(lifetimeSpendCents: number): Tier {
  // Walk backwards so the highest qualifying tier wins.
  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (lifetimeSpendCents >= TIERS[i].thresholdCents) return TIERS[i];
  }
  return TIERS[0];
}

/** The next tier up, or null if the member is already at the top. */
export function nextTierFor(lifetimeSpendCents: number): Tier | null {
  return TIERS.find((t) => lifetimeSpendCents < t.thresholdCents) ?? null;
}

/**
 * Points earned by an order. `subtotalCents` should exclude shipping and tax,
 * and should be the amount actually charged for the garments — i.e. after any
 * welcome discount — so members are not rewarded for money they did not spend.
 */
export function pointsForOrder(
  subtotalCents: number,
  lifetimeSpendCents: number,
): number {
  const tier = tierFor(lifetimeSpendCents);
  return Math.floor((subtotalCents / 100) * POINTS_PER_DOLLAR * tier.multiplier);
}

/**
 * Points to claw back when part of an order is refunded, pro-rated against what
 * was originally awarded. Never returns more than was granted in the first
 * place, so a rounding difference can't leave a member owing points.
 */
export function pointsToReverse(
  pointsAwarded: number,
  refundedCents: number,
  orderSubtotalCents: number,
): number {
  if (pointsAwarded <= 0 || refundedCents <= 0 || orderSubtotalCents <= 0) {
    return 0;
  }
  const share = Math.min(1, refundedCents / orderSubtotalCents);
  return Math.min(pointsAwarded, Math.round(pointsAwarded * share));
}

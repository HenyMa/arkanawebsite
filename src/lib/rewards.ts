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
 * Percentage off every order — not just the first — for Adept and Oracle
 * members, however they got there. Applied automatically at checkout.
 *
 * Deliberately below WELCOME_DISCOUNT_PERCENT: the two can't stack (Stripe
 * Checkout takes one coupon per session), and the checkout route applies
 * whichever is worth more, so a member's first order still gets the bigger
 * welcome discount and this one takes over from the second order on.
 */
export const MEMBER_DISCOUNT_PERCENT = 10;

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
      "1 point per dollar spent",
      "Early access to every drop",
    ],
  },
  {
    name: "Adept",
    thresholdCents: 30000,
    multiplier: 1.25,
    perks: [
      `${MEMBER_DISCOUNT_PERCENT}% off every order`,
      "1.25 points per dollar spent",
      "Extended 60-day return window",
      "First look at limited runs",
    ],
  },
  {
    name: "Oracle",
    thresholdCents: 75000,
    multiplier: 1.5,
    perks: [
      `${MEMBER_DISCOUNT_PERCENT}% off every order`,
      "1.5 points per dollar spent",
      "Extended 60-day return window",
      "Free express shipping",
      "Reserved sizing on limited runs",
      "Invitations to private releases",
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
 * The lowest tier that carries the member discount. Derived rather than written
 * out, and falling back to unreachable rather than zero, so a rename in TIERS
 * can only ever withdraw the perk — never hand it to everyone.
 */
const MEMBER_DISCOUNT_FROM_CENTS =
  tierByName("Adept")?.thresholdCents ?? Number.POSITIVE_INFINITY;

/** Whether a standing earns the member discount, ignoring the basket. */
export function hasMemberDiscount(standing: number): boolean {
  return standing >= MEMBER_DISCOUNT_FROM_CENTS;
}

/**
 * The member discount on an order, in cents. Zero for anyone below Adept.
 *
 * Being a percentage, it can never exceed the basket, so unlike a fixed amount
 * there is no minimum order to enforce.
 */
export function memberDiscountCents(
  standing: number,
  subtotalCents: number,
): number {
  if (!hasMemberDiscount(standing)) return 0;
  return Math.round((subtotalCents * MEMBER_DISCOUNT_PERCENT) / 100);
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

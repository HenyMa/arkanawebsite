/**
 * The Arkana Circle — the rewards program.
 *
 * Rules are defined here and enforced in the Stripe webhook (the only place
 * points are ever minted). Keeping the constants in one module means the
 * marketing copy on /rewards and the accrual logic can never drift apart.
 */

/** Points granted per whole dollar spent, before shipping and tax. */
export const POINTS_PER_DOLLAR = 1;

/** Points handed out once, when an account is first created. */
export const SIGNUP_BONUS = 100;

/** Points required to redeem, and what that redemption is worth in cents. */
export const REDEMPTION_THRESHOLD = 500;
export const REDEMPTION_VALUE_CENTS = 2500;

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
      "1 point per dollar spent",
      "Early access to every drop",
    ],
  },
  {
    name: "Adept",
    thresholdCents: 30000,
    multiplier: 1.25,
    perks: [
      "1.25 points per dollar spent",
      "Free standard shipping, always",
      "First look at limited runs",
    ],
  },
  {
    name: "Oracle",
    thresholdCents: 75000,
    multiplier: 1.5,
    perks: [
      "1.5 points per dollar spent",
      "Free express shipping",
      "Reserved sizing on limited runs",
      "Invitations to private releases",
    ],
  },
];

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
 * Points earned by an order. `subtotalCents` should exclude shipping and tax
 * so members are not rewarded for choosing express delivery.
 */
export function pointsForOrder(
  subtotalCents: number,
  lifetimeSpendCents: number,
): number {
  const tier = tierFor(lifetimeSpendCents);
  return Math.floor((subtotalCents / 100) * POINTS_PER_DOLLAR * tier.multiplier);
}

import type { Metadata } from "next";
import { BuyMembershipButton } from "@/components/BuyMembershipButton";
import { JoinCircleLink } from "@/components/JoinCircleLink";
import { Mark } from "@/components/Logo";
import {
  MEMBER_DISCOUNT_PERCENT,
  MEMBERSHIP_PRICE_CENTS,
  POINTS_PER_DOLLAR,
  REDEMPTION_THRESHOLD,
  REDEMPTION_VALUE_CENTS,
  SIGNUP_BONUS,
  TIERS,
  WELCOME_DISCOUNT_PERCENT,
  isPurchasableTier,
} from "@/lib/rewards";
import { formatPrice } from "@/lib/products";
import {
  EXTENDED_RETURN_WINDOW_DAYS,
  RETURN_WINDOW_DAYS,
} from "@/lib/returns";

export const metadata: Metadata = {
  title: "The Arkana Circle",
  description:
    "Earn points on every order, unlock free shipping, and get first access to limited runs.",
};

const STEPS = [
  {
    n: "01",
    title: "Join",
    body: `Create an account and we credit ${SIGNUP_BONUS} points immediately — no purchase needed.`,
  },
  {
    n: "02",
    title: "Save",
    body: `Your first order as a member is ${WELCOME_DISCOUNT_PERCENT}% off. It comes off automatically at checkout — there is no code to enter and nothing to remember.`,
  },
  {
    n: "03",
    title: "Earn",
    body: `Every order earns ${POINTS_PER_DOLLAR} point per dollar, multiplied by your tier. Points post as soon as payment clears.`,
  },
  {
    n: "04",
    title: "Redeem",
    body: `Every ${REDEMPTION_THRESHOLD} points is ${formatPrice(REDEMPTION_VALUE_CENTS)} off your next order.`,
  },
];

export default function RewardsPage() {
  return (
    <div>
      <section className="border-b border-parchment bg-linen">
        <div className="mx-auto max-w-3xl px-5 py-24 text-center sm:px-8">
          <Mark className="animate-rise mx-auto h-11 w-11 text-gold" />
          <p className="eyebrow mt-8 text-clay">Rewards</p>
          <h1 className="mt-4 font-display text-5xl font-light text-graphite sm:text-6xl">
            The Arkana Circle
          </h1>
          <p className="mx-auto mt-7 max-w-xl text-[0.95rem] leading-relaxed text-slate">
            A quiet programme for people who buy less and keep it longer.{" "}
            {WELCOME_DISCOUNT_PERCENT}% off the first order, points on
            everything after, a longer window to change your mind, and first
            access to runs before they&apos;re announced.
          </p>
          <JoinCircleLink className="mt-10" memberLabel="View your standing">
            Join — {WELCOME_DISCOUNT_PERCENT}% off your first order
          </JoinCircleLink>
        </div>
      </section>

      {/* ----------------------------------------------------------- How it works */}
      <section className="mx-auto max-w-6xl px-5 py-24 sm:px-8">
        <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step) => (
            <div key={step.n}>
              <p className="font-display text-5xl font-light text-sand">{step.n}</p>
              <h2 className="mt-4 font-display text-2xl text-graphite">
                {step.title}
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-slate">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ----------------------------------------------------------------- Tiers */}
      <section id="memberships" className="border-y border-parchment bg-linen">
        <div className="mx-auto max-w-6xl px-5 py-24 sm:px-8">
          <div className="text-center">
            <p className="eyebrow text-clay">Standing</p>
            <h2 className="mt-3 font-display text-4xl font-light text-graphite">
              Three tiers
            </h2>
            <p className="mx-auto mt-5 max-w-md text-sm text-slate">
              Tiers are set by lifetime spend and never expire. Once you reach a
              tier, it&apos;s yours — and if you&apos;d rather not wait, Adept
              and Oracle can be taken outright for a single payment.
            </p>
          </div>

          <div className="mt-14 grid items-stretch gap-8 md:grid-cols-3">
            {TIERS.map((tier, i) => (
              <div
                key={tier.name}
                className={`flex flex-col border bg-bone p-8 ${
                  i === TIERS.length - 1 ? "border-gold" : "border-parchment"
                }`}
              >
                <p className="font-display text-3xl text-graphite">{tier.name}</p>
                <p className="mt-2 text-[0.7rem] uppercase tracking-[0.18em] text-clay">
                  {tier.thresholdCents === 0
                    ? "On joining"
                    : `From ${formatPrice(tier.thresholdCents)} lifetime`}
                </p>
                <div className="rule-gold my-6" />
                <ul className="space-y-3 text-sm text-slate">
                  {tier.perks.map((perk) => (
                    <li key={perk} className="flex gap-3">
                      <span
                        className="mt-2 h-px w-4 shrink-0 bg-gold"
                        aria-hidden="true"
                      />
                      {perk}
                    </li>
                  ))}
                </ul>

                {isPurchasableTier(tier.name) && (
                  // `mt-auto` so the buttons line up across cards of unequal
                  // height rather than floating under each perk list.
                  <div className="mt-auto pt-8">
                    <BuyMembershipButton tier={tier.name} />
                    <p className="mt-3 text-center text-xs text-ash">
                      One payment. Never expires.
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------- FAQ */}
      <section className="mx-auto max-w-2xl px-5 py-24 sm:px-8">
        <h2 className="text-center font-display text-4xl font-light text-graphite">
          Questions
        </h2>
        <dl className="mt-12 divide-y divide-parchment">
          {[
            [
              "How does the first-order discount work?",
              `Create an account and ${WELCOME_DISCOUNT_PERCENT}% comes off your first order automatically at checkout — no code. It's used once and then it's gone, so spend it on something you actually want.`,
            ],
            [
              "Can I just buy Adept or Oracle?",
              `Yes. Both are ${formatPrice(MEMBERSHIP_PRICE_CENTS.Adept)} and ${formatPrice(MEMBERSHIP_PRICE_CENTS.Oracle)} respectively — a single payment, no renewal, and the tier is yours for good. Every perk switches on the moment the payment clears. If you later spend your way past it, you simply keep the higher standing.`,
            ],
            [
              `How does the ${MEMBER_DISCOUNT_PERCENT}% member discount work?`,
              `Adept and Oracle members get ${MEMBER_DISCOUNT_PERCENT}% off every order, automatically, with no code and no minimum. It doesn't stack with the ${WELCOME_DISCOUNT_PERCENT}% welcome discount — we apply whichever saves you more, so your first order as a member takes the ${WELCOME_DISCOUNT_PERCENT}% and the ${MEMBER_DISCOUNT_PERCENT}% picks up from the order after, for good.`,
            ],
            [
              "Do points expire?",
              "No. Points and tier standing stay with your account for as long as it's open.",
            ],
            [
              "When do points appear?",
              "As soon as your payment clears — usually within a few seconds of checkout. They'll show on your account page.",
            ],
            [
              "Do I earn points on shipping?",
              "Points are calculated on the value of the garments, before shipping and tax.",
            ],
            [
              "What happens if I return something?",
              `Points earned on returned items are deducted when the refund is processed, and your lifetime total is adjusted to match. Everyone gets ${RETURN_WINDOW_DAYS} days to return; Adept and Oracle members get ${EXTENDED_RETURN_WINDOW_DAYS}.`,
            ],
          ].map(([q, a]) => (
            <div key={q} className="py-6">
              <dt className="font-display text-xl text-graphite">{q}</dt>
              <dd className="mt-2 text-sm leading-relaxed text-slate">{a}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}

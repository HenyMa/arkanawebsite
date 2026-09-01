import type { Metadata } from "next";
import { BuyMembershipButton } from "@/components/BuyMembershipButton";
import { JoinCircleLink } from "@/components/JoinCircleLink";
import {
  SECOND_ORDER_DISCOUNT_PERCENT,
  TIER_SECOND_ORDER_DISCOUNT_PERCENT,
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
    body: `Your first order as a member is ${WELCOME_DISCOUNT_PERCENT}% off and your second is ${SECOND_ORDER_DISCOUNT_PERCENT}% — ${TIER_SECOND_ORDER_DISCOUNT_PERCENT}% if you're Adept or Oracle. Both come off automatically at checkout, with no code to enter.`,
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
      <section className="mx-auto max-w-3xl px-5 py-28 text-center sm:px-10 sm:py-36">
        <p className="eyebrow text-clay">Membership</p>
        <h1 className="display-line mt-8 text-graphite">The Arkana Circle</h1>
        <p className="mx-auto mt-12 max-w-lg text-sm leading-relaxed text-slate">
          A quiet programme for people who buy less and keep it longer.{" "}
          {WELCOME_DISCOUNT_PERCENT}% off the first order, points on everything
          after, a longer window to change your mind, and first access to runs
          before they&apos;re announced.
        </p>
        <div className="mt-12">
          <JoinCircleLink variant="link" memberLabel="View your standing">
            Join — {WELCOME_DISCOUNT_PERCENT}% off your first order
          </JoinCircleLink>
        </div>
      </section>

      {/* ----------------------------------------------------------- How it works */}
      <section className="border-t border-parchment px-5 py-24 sm:px-10">
        <div className="mx-auto grid max-w-[110rem] gap-14 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step) => (
            <div key={step.n} className="border-t border-parchment pt-7">
              <p className="eyebrow text-mist">{step.n}</p>
              <h2 className="eyebrow mt-5 text-graphite">{step.title}</h2>
              <p className="mt-5 text-xs leading-relaxed text-slate">
                {step.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ----------------------------------------------------------------- Tiers */}
      <section
        id="memberships"
        className="border-t border-parchment bg-linen px-5 py-24 sm:px-10 sm:py-32"
      >
        <div className="mx-auto max-w-[110rem]">
          <div className="text-center">
            <h2 className="section-title text-graphite">Three tiers</h2>
            <p className="mx-auto mt-7 max-w-md text-sm leading-relaxed text-slate">
              Tiers are set by lifetime spend and never expire. Once you reach a
              tier, it&apos;s yours — and if you&apos;d rather not wait, Adept
              and Oracle can be taken outright for a single payment.
            </p>
          </div>

          <div className="mt-20 grid items-stretch gap-12 md:grid-cols-3">
            {TIERS.map((tier) => (
              <div
                key={tier.name}
                className="flex flex-col border-t border-clay/40 pt-7"
              >
                <p className="eyebrow text-graphite">{tier.name}</p>
                <p className="eyebrow mt-3 text-clay">
                  {tier.thresholdCents === 0
                    ? "On joining"
                    : `From ${formatPrice(tier.thresholdCents)} lifetime`}
                </p>
                <ul className="mt-8 space-y-3 text-xs leading-relaxed text-slate">
                  {tier.perks.map((perk) => (
                    <li key={perk}>{perk}</li>
                  ))}
                </ul>

                {isPurchasableTier(tier.name) && (
                  // `mt-auto` so the buttons line up across columns of unequal
                  // height rather than floating under each perk list.
                  <div className="mt-auto pt-10">
                    <BuyMembershipButton tier={tier.name} />
                    <p className="eyebrow mt-4 text-ash">
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
      <section className="mx-auto max-w-2xl px-5 py-24 sm:px-10 sm:py-32">
        <h2 className="section-title text-center text-graphite">Questions</h2>
        <dl className="mt-16 divide-y divide-parchment border-y border-parchment">
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
              "How does the second-order discount work?",
              `Your second order as a member takes ${SECOND_ORDER_DISCOUNT_PERCENT}% off automatically — or ${TIER_SECOND_ORDER_DISCOUNT_PERCENT}% if you've reached Adept or Oracle by then, whether you spent your way there or bought the tier. Like the welcome discount it's used once and no code is needed, and the two never overlap: the first order takes one, the second takes the other.`,
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
            <div key={q} className="py-8">
              <dt className="eyebrow text-graphite">{q}</dt>
              <dd className="mt-4 text-xs leading-relaxed text-slate">{a}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}

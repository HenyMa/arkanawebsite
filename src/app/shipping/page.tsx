import type { Metadata } from "next";
import Link from "next/link";
import { ButtonLink } from "@/components/Button";
import { COUNTRIES, SHIPPING_SUMMARY } from "@/lib/shipping";
import {
  EXTENDED_RETURN_WINDOW_DAYS,
  RETURN_WINDOW_DAYS,
} from "@/lib/returns";

export const metadata: Metadata = {
  title: "Shipping & returns",
  description: "How Arkana ships, and how returns work.",
};

const COUNTRY_NAMES: Record<string, string> = {
  US: "United States",
  CA: "Canada",
  GB: "United Kingdom",
  IE: "Ireland",
  AU: "Australia",
  NZ: "New Zealand",
  DE: "Germany",
  FR: "France",
  NL: "Netherlands",
  ES: "Spain",
  IT: "Italy",
  PT: "Portugal",
  SE: "Sweden",
  DK: "Denmark",
  NO: "Norway",
};

const SECTIONS = [
  {
    heading: "Dispatch",
    body: "We pack Monday through Thursday from our studio. Orders placed before 2pm usually leave the same day; anything later goes out the next working day. You'll get tracking by email the moment a label is created.",
  },
  {
    heading: "Shipping cost",
    body: "Standard shipping is free on every order, everywhere we ship — no minimum and no threshold to clear. Express is an optional paid upgrade at checkout, and it's complimentary for Oracle members.",
  },
  {
    heading: "Duties & taxes",
    body: "Orders outside the United States may attract import duty on arrival, charged by your local customs authority. These aren't included at checkout and are the recipient's responsibility.",
  },
];

const RETURN_STEPS = [
  {
    n: "01",
    title: "Open it from your account",
    body: "Find the order under Orders, choose the pieces coming back, and tell us why. You'll get a return reference straight away.",
  },
  {
    n: "02",
    title: "We send the label",
    body: "A prepaid label lands in your inbox within one business day. Put the pieces back in the bag they arrived in, or any bag you have.",
  },
  {
    n: "03",
    title: "We refund",
    body: "Once the parcel reaches us and passes a quick check, we refund to your original payment method within two business days. Banks usually take another 3–5 to show it.",
  },
];

export default function ShippingPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-20 sm:px-8">
      <p className="eyebrow text-clay">Help</p>
      <h1 className="mt-3 font-display text-5xl font-light text-graphite">
        Shipping &amp; returns
      </h1>

      <div className="rule-gold mt-10" />

      <div className="mt-10 border border-parchment bg-linen/60 p-7">
        <h2 className="eyebrow text-clay">Rates</h2>
        <ul className="mt-4 space-y-2 text-sm text-slate">
          {SHIPPING_SUMMARY.map((line) => (
            <li key={line}>{line}</li>
          ))}
          <li>Oracle members ship express free.</li>
        </ul>
      </div>

      {/* ------------------------------------------------------------- Returns */}
      <section className="mt-16">
        <h2 className="font-display text-3xl font-light text-graphite">
          Returns
        </h2>
        <p className="mt-4 text-[0.95rem] leading-relaxed text-slate">
          Unworn pieces with tags attached can be returned within{" "}
          {RETURN_WINDOW_DAYS} days for a full refund — {EXTENDED_RETURN_WINDOW_DAYS}{" "}
          days for Adept and Oracle members. Return postage is on us within the
          United States, and everywhere if the piece arrived faulty or we sent
          the wrong thing.
        </p>

        <ol className="mt-10 space-y-8">
          {RETURN_STEPS.map((step) => (
            <li key={step.n} className="flex gap-6">
              <span className="font-display text-4xl font-light text-sand">
                {step.n}
              </span>
              <div>
                <h3 className="font-display text-xl text-graphite">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate">
                  {step.body}
                </p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-10 border border-parchment bg-linen/60 p-7">
          <p className="text-sm leading-relaxed text-slate">
            Returns are opened from your account — no email needed, and you can
            track where yours has got to at any point.
          </p>
          <ButtonLink href="/account" variant="outline" className="mt-6">
            Start a return
          </ButtonLink>
        </div>

        <dl className="mt-12 divide-y divide-parchment border-t border-parchment">
          {[
            [
              "What condition does it need to be in?",
              "Unworn, unwashed, and with the tags still attached. Try things on — just do it over a carpet rather than out in the world.",
            ],
            [
              "Can I exchange instead?",
              "Return the piece and order the size you want whenever suits. Both directions are free domestically, and it's faster than holding stock for an exchange.",
            ],
            [
              "What happens to my points?",
              "Points earned on returned pieces are deducted when the refund settles, and your lifetime total is adjusted to match. Your tier never drops as a result.",
            ],
            [
              "I used my member discount — what do I get back?",
              "Each returned piece refunds its share of what you actually paid, discount included. Return the whole order and you're refunded the whole discounted total.",
            ],
            [
              "It arrived faulty.",
              "Open a return, choose 'Arrived faulty or damaged', and we cover postage wherever you are. If it's our mistake we'd rather hear it early.",
            ],
            [
              "I'm outside the window.",
              "Write to us anyway. The window is a policy, not a rule we enjoy enforcing.",
            ],
          ].map(([q, a]) => (
            <div key={q} className="py-6">
              <dt className="font-display text-xl text-graphite">{q}</dt>
              <dd className="mt-2 text-sm leading-relaxed text-slate">{a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="mt-12 divide-y divide-parchment border-t border-parchment">
        {SECTIONS.map((section) => (
          <section key={section.heading} className="py-8">
            <h2 className="font-display text-2xl text-graphite">
              {section.heading}
            </h2>
            <p className="mt-3 text-[0.95rem] leading-relaxed text-slate">
              {section.body}
            </p>
          </section>
        ))}
      </div>

      <section className="border-t border-parchment py-8">
        <h2 className="font-display text-2xl text-graphite">Where we ship</h2>
        <p className="mt-3 text-sm leading-relaxed text-slate">
          {COUNTRIES.map((c) => COUNTRY_NAMES[c] ?? c).join(", ")}. Somewhere
          else?{" "}
          <Link href="/about" className="link-underline text-gold-deep">
            Write to us
          </Link>{" "}
          and we&apos;ll usually find a way.
        </p>
      </section>

      <ButtonLink href="/shop" variant="outline" className="mt-6">
        Back to the collection
      </ButtonLink>
    </div>
  );
}

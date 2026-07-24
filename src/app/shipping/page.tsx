import type { Metadata } from "next";
import { ButtonLink } from "@/components/Button";
import { COUNTRIES, SHIPPING_SUMMARY } from "@/lib/shipping";

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
    heading: "Returns",
    body: "Unworn pieces with tags attached can be returned within 30 days for a full refund. Email us and we'll send a prepaid label for domestic returns. International returns are at your own cost unless the item arrived faulty.",
  },
  {
    heading: "Exchanges",
    body: "Sizing is boxy and we'd rather you had the right one. Exchanges within 30 days are free in both directions, domestically. Just tell us the size you want and we'll reserve it while your return is in transit.",
  },
  {
    heading: "Duties & taxes",
    body: "Orders outside the United States may attract import duty on arrival, charged by your local customs authority. These aren't included at checkout and are the recipient's responsibility.",
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
          <li>
            Adept members ship standard free. Oracle members ship express free.
          </li>
        </ul>
      </div>

      <div className="mt-12 divide-y divide-parchment">
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
          else? Write to us and we&apos;ll usually find a way.
        </p>
      </section>

      <ButtonLink href="/hoodies" variant="outline" className="mt-6">
        Back to the collection
      </ButtonLink>
    </div>
  );
}

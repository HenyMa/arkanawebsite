import type { Metadata } from "next";
import Image from "next/image";
import { ButtonLink } from "@/components/Button";
import { Mark } from "@/components/Logo";

export const metadata: Metadata = {
  title: "About",
  description:
    "Arkana makes heavyweight essentials in small batches — garment-dyed cotton, made in Portugal.",
};

export default function AboutPage() {
  return (
    <div>
      <section className="border-b border-parchment bg-linen">
        <div className="mx-auto max-w-3xl px-5 py-24 text-center sm:px-8">
          <Mark className="animate-rise mx-auto h-11 w-11 text-gold" />
          <h1 className="mt-8 font-display text-5xl font-light leading-tight text-graphite sm:text-6xl">
            Made to be kept.
          </h1>
          <p className="mx-auto mt-7 max-w-xl text-[0.95rem] leading-relaxed text-slate">
            Arkana started with a simple frustration: almost every hoodie worth
            wearing is either disposable or absurd. We wanted one heavy enough to
            feel like something, cut so it still looks right after two winters,
            and priced so that buying one is a reasonable decision.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-24 sm:px-8">
        <div className="grid items-center gap-14 lg:grid-cols-2">
          <div className="relative aspect-[4/5] overflow-hidden">
            <Image
              src="/products/vesper-2.svg"
              alt="Arkana fabric detail"
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
            />
          </div>
          <div>
            <p className="eyebrow text-clay">Our approach</p>
            <h2 className="mt-3 font-display text-4xl font-light leading-tight text-graphite">
              Three hoodies. That&apos;s the whole range.
            </h2>
            <div className="mt-7 space-y-5 text-[0.95rem] leading-relaxed text-slate">
              <p>
                We would rather make three things properly than thirty things
                adequately. Each hoodie in the collection exists because it does
                something the other two don&apos;t — a different weight, a
                different drape, a different reason to reach for it.
              </p>
              <p>
                Everything is cut, sewn, and dyed within forty kilometres of each
                other in northern Portugal, by mills and workshops we visit. Runs
                are between 120 and 400 pieces. When a colour sells through, the
                next batch will be close but never identical, because that is
                what garment dyeing honestly does.
              </p>
              <p>
                We don&apos;t run seasonal sales. The price on the page is the
                price, and members of the Circle earn against it instead.
              </p>
            </div>
            <ButtonLink href="/hoodies" className="mt-10">
              See the collection
            </ButtonLink>
          </div>
        </div>
      </section>

      <section className="border-t border-parchment bg-linen">
        <div className="mx-auto max-w-5xl px-5 py-20 sm:px-8">
          <dl className="grid gap-10 text-center sm:grid-cols-3">
            {[
              ["500gsm", "Heaviest fleece in the range"],
              ["120–400", "Pieces per batch"],
              ["40km", "Between mill and workshop"],
            ].map(([figure, label]) => (
              <div key={label}>
                <dt className="font-display text-5xl font-light text-gold-deep">
                  {figure}
                </dt>
                <dd className="mt-3 text-xs uppercase tracking-[0.18em] text-slate">
                  {label}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
    </div>
  );
}

import type { Metadata } from "next";
import Image from "next/image";
import { ButtonLink } from "@/components/Button";

export const metadata: Metadata = {
  title: "About",
  description:
    "Arkana makes heavyweight essentials in small batches — garment-dyed cotton, made in Portugal.",
};

export default function AboutPage() {
  return (
    <div>
      <section className="mx-auto max-w-3xl px-5 py-28 text-center sm:px-10 sm:py-36">
        <p className="eyebrow text-clay">Arkana</p>
        <h1 className="display-line mt-8 text-graphite">Made to be kept.</h1>
        <p className="mx-auto mt-12 max-w-lg text-sm leading-relaxed text-slate">
          Arkana started with a simple frustration: almost every hoodie worth
          wearing is either disposable or absurd. We wanted one heavy enough to
          feel like something, cut so it still looks right after two winters,
          and priced so that buying one is a reasonable decision.
        </p>
      </section>

      <section className="border-t border-parchment">
        <div className="grid lg:grid-cols-2">
          <div className="relative min-h-[26rem] bg-linen lg:min-h-[46rem]">
            <Image
              src="/products/meridian-2.svg"
              alt="Arkana fabric detail"
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              /* A flat swatch rather than a cut-out garment, so it can fill
                 the panel edge to edge without losing anything. */
              className="object-cover"
            />
          </div>

          <div className="flex flex-col justify-center border-parchment px-5 py-24 sm:px-14 lg:border-l">
            <p className="eyebrow text-clay">Our approach</p>
            <h2 className="display-line-sm mt-6 max-w-md text-graphite">
              Four garments. That&apos;s the whole range.
            </h2>
            <div className="mt-9 max-w-md space-y-6 text-sm leading-relaxed text-slate">
              <p>
                We would rather make four things properly than forty things
                adequately. A hoodie, a sweatshirt, a sweatpant, a zip-up — and
                every piece within them exists because it does something the
                others don&apos;t: a different weight, a different drape, a
                different reason to reach for it.
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
            <div className="mt-12">
              <ButtonLink href="/shop" variant="link">
                See the collection
              </ButtonLink>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-parchment px-5 py-24 sm:px-10">
        <dl className="mx-auto grid max-w-5xl gap-14 text-center sm:grid-cols-3">
          {[
            ["500gsm", "Heaviest fleece in the range"],
            ["120–400", "Pieces per batch"],
            ["40km", "Between mill and workshop"],
          ].map(([figure, label]) => (
            <div key={label}>
              <dt className="display-line-sm text-graphite">{figure}</dt>
              <dd className="eyebrow mt-5 text-ash">{label}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}

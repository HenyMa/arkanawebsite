import Image from "next/image";
import { ButtonLink } from "@/components/Button";
import { ProductCard } from "@/components/ProductCard";
import { Mark } from "@/components/Logo";
import { PRODUCTS } from "@/lib/products";
import { SIGNUP_BONUS, TIERS } from "@/lib/rewards";

export default function HomePage() {
  return (
    <>
      {/* ---------------------------------------------------------------- Hero */}
      <section className="relative overflow-hidden border-b border-parchment bg-linen">
        <div
          className="absolute inset-0 opacity-[0.55]"
          style={{
            background:
              "radial-gradient(120% 80% at 50% 0%, #f7f4ef 0%, transparent 60%), radial-gradient(80% 60% at 85% 100%, #d6c6ae 0%, transparent 65%)",
          }}
          aria-hidden="true"
        />
        <div className="relative mx-auto max-w-4xl px-5 py-28 text-center sm:px-8 sm:py-36">
          <Mark className="animate-rise mx-auto h-11 w-11 text-gold" />
          <p className="eyebrow animate-rise mt-8 text-clay [animation-delay:80ms]">
            Autumn Collection · Made in Portugal
          </p>
          <h1 className="animate-rise mt-6 font-display text-5xl font-light leading-[1.08] text-graphite [animation-delay:160ms] sm:text-7xl">
            Fewer pieces,
            <br />
            <span className="italic text-gold-deep">made properly.</span>
          </h1>
          <p className="animate-rise mx-auto mt-8 max-w-lg text-[0.95rem] leading-relaxed text-slate [animation-delay:240ms]">
            Arkana begins with three hoodies. Heavyweight cotton, garment-dyed in
            small batches, cut to hold its shape for years rather than seasons.
          </p>
          <div className="animate-rise mt-11 flex flex-wrap justify-center gap-4 [animation-delay:320ms]">
            <ButtonLink href="/hoodies">Shop hoodies</ButtonLink>
            <ButtonLink href="/rewards" variant="outline">
              The Arkana Circle
            </ButtonLink>
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------------- Collection */}
      <section className="mx-auto max-w-7xl px-5 py-24 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="eyebrow text-clay">The Collection</p>
            <h2 className="mt-3 font-display text-4xl font-light text-graphite sm:text-5xl">
              Hoodies
            </h2>
          </div>
          <p className="max-w-sm text-sm leading-relaxed text-slate">
            Three weights, three colourways. Each one dyed after construction so
            the colour settles into the seams.
          </p>
        </div>

        <div className="rule-gold mt-10" />

        <div className="mt-12 grid gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
          {PRODUCTS.map((product) => (
            <ProductCard key={product.slug} product={product} />
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------------------- Craft */}
      <section className="border-y border-parchment bg-linen">
        <div className="mx-auto grid max-w-7xl items-center gap-14 px-5 py-24 sm:px-8 lg:grid-cols-2">
          <div className="relative aspect-[5/4] overflow-hidden">
            <Image
              src="/products/monolith-2.svg"
              alt="Close detail of Arkana loopback cotton"
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
            />
          </div>
          <div>
            <p className="eyebrow text-clay">The Making</p>
            <h2 className="mt-3 font-display text-4xl font-light leading-tight text-graphite sm:text-[2.75rem]">
              Dyed after it is sewn, not before.
            </h2>
            <p className="mt-6 text-[0.95rem] leading-relaxed text-slate">
              Garment dyeing is slower, costlier, and harder to keep consistent.
              We do it because it is the only way to get colour that settles
              unevenly into the seams and softens honestly with wear — the
              character most fleece only fakes.
            </p>
            <ul className="mt-8 space-y-3 text-sm text-slate">
              {[
                "420–500gsm loopback cotton, milled in Portugal",
                "Batches of 120–400 pieces, never restocked identically",
                "Cut, sewn, and dyed within forty kilometres",
              ].map((line) => (
                <li key={line} className="flex gap-3">
                  <span className="mt-2 h-px w-5 shrink-0 bg-gold" aria-hidden="true" />
                  {line}
                </li>
              ))}
            </ul>
            <ButtonLink href="/about" variant="outline" className="mt-10">
              Read our story
            </ButtonLink>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------------- Rewards */}
      <section className="bg-graphite">
        <div className="mx-auto max-w-5xl px-5 py-24 text-center sm:px-8">
          <p className="eyebrow text-gold-soft">Rewards</p>
          <h2 className="mt-4 font-display text-4xl font-light text-bone sm:text-5xl">
            The Arkana Circle
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-[0.95rem] leading-relaxed text-mist">
            Create an account and we&apos;ll credit you {SIGNUP_BONUS} points on
            the spot. Earn on every order, unlock free shipping, and get first
            access to limited runs before they&apos;re announced.
          </p>

          <div className="mt-14 grid gap-px overflow-hidden border border-white/10 bg-white/10 sm:grid-cols-3">
            {TIERS.map((tier) => (
              <div key={tier.name} className="bg-graphite px-6 py-9">
                <p className="font-display text-2xl text-gold-soft">{tier.name}</p>
                <p className="mt-1.5 text-[0.7rem] uppercase tracking-[0.18em] text-ash">
                  {tier.thresholdCents === 0
                    ? "On joining"
                    : `From $${tier.thresholdCents / 100} lifetime`}
                </p>
                <p className="mt-5 text-sm text-mist">
                  {tier.multiplier}× points per dollar
                </p>
              </div>
            ))}
          </div>

          <div className="mt-12 flex flex-wrap justify-center gap-4">
            <ButtonLink
              href="/signup"
              className="bg-gold text-graphite hover:bg-gold-soft"
            >
              Join the Circle
            </ButtonLink>
            <ButtonLink
              href="/rewards"
              variant="outline"
              className="border-white/25 text-bone hover:border-gold-soft hover:bg-white/5"
            >
              How it works
            </ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}

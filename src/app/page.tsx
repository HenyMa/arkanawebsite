import Image from "next/image";
import Link from "next/link";
import { ButtonLink } from "@/components/Button";
import { JoinCircleLink } from "@/components/JoinCircleLink";
import { ProductCard } from "@/components/ProductCard";
import {
  CATEGORIES,
  PRODUCTS,
  categoryPath,
  formatPrice,
  productPath,
} from "@/lib/products";
import { SIGNUP_BONUS, TIERS, WELCOME_DISCOUNT_PERCENT } from "@/lib/rewards";

export default function HomePage() {
  const [lead, ...rest] = PRODUCTS;

  return (
    <>
      {/*
        ------------------------------------------------------------------ Hero
        Full-viewport image with the header floating over it and the type
        pinned to the bottom. The placeholder art is a centred garment on a
        flat ground, so it is set `object-contain`; swap in photography and
        change that one class to `object-cover` for a full-bleed campaign shot.
      */}
      <section className="relative flex min-h-[100svh] flex-col justify-end overflow-hidden bg-linen">
        <Image
          src="/products/monolith-1.svg"
          alt="The Monolith Hoodie in graphite"
          fill
          priority
          sizes="100vw"
          className="animate-fade object-contain object-center"
        />

        <div className="relative px-5 pb-14 sm:px-10 sm:pb-16">
          <div className="flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="eyebrow animate-rise text-clay">
                Volume One · Garment-Dyed
              </p>
              <h1 className="display-line animate-rise mt-5 max-w-2xl text-graphite [animation-delay:120ms]">
                Fewer pieces,
                <br />
                <span className="italic">made properly.</span>
              </h1>
            </div>

            <div className="animate-rise flex flex-wrap items-end gap-8 [animation-delay:240ms] sm:pb-3">
              <ButtonLink href="/shop" variant="link">
                Shop the collection
              </ButtonLink>
              <ButtonLink href="/about" variant="link">
                The making
              </ButtonLink>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- Statement */}
      <section className="mx-auto max-w-3xl px-5 py-28 text-center sm:px-10 sm:py-36">
        <p className="eyebrow text-clay">Arkana</p>
        <p className="display-line-sm mt-8 text-graphite">
          Heavyweight cotton, dyed in small batches, cut to hold its shape for
          years rather than seasons.
        </p>
        <p className="mt-10 text-sm leading-relaxed text-slate">
          Four garments. One price per garment type. Free shipping on every
          order, everywhere.
        </p>
      </section>

      {/*
        ------------------------------------------------------- Lead product
        One piece given a full-width spread before the grid, the way a house
        opens a lookbook on a single look.
      */}
      {lead && (
        <section className="border-t border-parchment">
          <div className="grid lg:grid-cols-[1.35fr_1fr]">
            <Link
              href={productPath(lead)}
              className="group relative block aspect-[4/5] overflow-hidden bg-linen lg:aspect-auto lg:min-h-[42rem]"
            >
              <Image
                src={lead.images[0]}
                alt={`${lead.name} in ${lead.colorway}`}
                fill
                sizes="(max-width: 1024px) 100vw, 60vw"
                className="object-contain transition-opacity duration-700 group-hover:opacity-0"
              />
              {lead.images[1] && (
                <Image
                  src={lead.images[1]}
                  alt=""
                  fill
                  sizes="(max-width: 1024px) 100vw, 60vw"
                  className="object-contain opacity-0 transition-opacity duration-700 group-hover:opacity-100"
                />
              )}
            </Link>

            <div className="flex flex-col justify-center border-parchment px-5 py-20 sm:px-14 lg:border-l">
              <p className="eyebrow text-clay">The Anchor</p>
              <h2 className="display-line-sm mt-6 text-graphite">
                {lead.name}
              </h2>
              <p className="eyebrow mt-5 tabular-nums text-slate">
                {formatPrice(lead.priceCents)} · {lead.colorway}
              </p>
              <p className="mt-8 max-w-md text-sm leading-relaxed text-slate">
                {lead.description}
              </p>
              <div className="mt-11">
                <ButtonLink href={productPath(lead)} variant="link">
                  View the piece
                </ButtonLink>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* --------------------------------------------------------- Collection */}
      <section className="border-t border-parchment px-5 py-24 sm:px-10 sm:py-32">
        <div className="mx-auto max-w-[110rem]">
          <div className="text-center">
            <h2 className="section-title text-graphite">The Collection</h2>
            <p className="mx-auto mt-6 max-w-md text-sm leading-relaxed text-slate">
              Garment-dyed after construction, so colour settles into the seams
              and softens honestly with wear.
            </p>
          </div>

          <div className="mt-20 grid gap-x-10 gap-y-20 sm:grid-cols-2 lg:grid-cols-3">
            {rest.map((product) => (
              <ProductCard key={product.slug} product={product} />
            ))}
          </div>

          <div className="mt-24 text-center">
            <ButtonLink href="/shop" variant="link">
              All four pieces
            </ButtonLink>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------- Categories */}
      <section className="border-t border-parchment px-5 py-20 sm:px-10">
        <div className="mx-auto max-w-[110rem]">
          <ul className="grid gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
            {CATEGORIES.map((category) => (
              <li key={category.slug}>
                <Link
                  href={categoryPath(category.slug)}
                  className="group block"
                >
                  <p className="eyebrow text-graphite transition-opacity group-hover:opacity-55">
                    {category.name}
                  </p>
                  <p className="eyebrow mt-3 tabular-nums text-slate">
                    {formatPrice(category.priceCents)}
                  </p>
                  <p className="mt-4 max-w-[16rem] text-xs leading-relaxed text-ash">
                    {category.tagline}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ------------------------------------------------------------- Craft */}
      <section className="border-t border-parchment">
        <div className="grid lg:grid-cols-2">
          <div className="flex flex-col justify-center px-5 py-24 sm:px-14 sm:py-32">
            <p className="eyebrow text-clay">The Making</p>
            <h2 className="display-line-sm mt-6 max-w-md text-graphite">
              Dyed after it is sewn, not before.
            </h2>
            <p className="mt-8 max-w-md text-sm leading-relaxed text-slate">
              Garment dyeing is slower, costlier, and harder to keep consistent.
              We do it because it is the only way to get colour that settles
              unevenly into the seams and softens honestly with wear — the
              character most fleece only fakes.
            </p>
            <ul className="mt-12 max-w-md">
              {[
                "420–500gsm loopback cotton, milled in Portugal",
                "Batches of 120–400 pieces, never restocked identically",
                "Cut, sewn, and dyed within forty kilometres",
              ].map((line) => (
                <li
                  key={line}
                  className="border-t border-parchment py-4 text-xs leading-relaxed text-slate last:border-b"
                >
                  {line}
                </li>
              ))}
            </ul>
            <div className="mt-12">
              <ButtonLink href="/about" variant="link">
                Read our story
              </ButtonLink>
            </div>
          </div>

          <div className="relative order-first min-h-[26rem] bg-linen lg:order-last lg:min-h-full">
            <Image
              src="/products/monolith-2.svg"
              alt="Close detail of Arkana loopback cotton"
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              /* A swatch, not a cut-out garment — safe to crop to the panel. */
              className="object-cover"
            />
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------------- Rewards */}
      <section className="bg-graphite px-5 py-28 text-center sm:px-10 sm:py-36">
        <div className="mx-auto max-w-4xl">
          <p className="eyebrow text-sand">Membership</p>
          <h2 className="display-line-sm mt-7 text-bone">The Arkana Circle</h2>
          <p className="mx-auto mt-9 max-w-lg text-sm leading-relaxed text-mist">
            Create an account and we&apos;ll credit you {SIGNUP_BONUS} points on
            the spot, plus {WELCOME_DISCOUNT_PERCENT}% off your first order. Earn
            on every order after that, and get first access to limited runs
            before they&apos;re announced.
          </p>

          <ul className="mt-20 grid gap-12 sm:grid-cols-3">
            {TIERS.map((tier) => (
              <li key={tier.name} className="border-t border-bone/20 pt-7">
                <p className="eyebrow text-bone">{tier.name}</p>
                <p className="eyebrow mt-3 text-ash">
                  {tier.thresholdCents === 0
                    ? "On joining"
                    : `From $${tier.thresholdCents / 100} lifetime`}
                </p>
                <p className="eyebrow mt-3 text-sand">
                  {tier.multiplier}× points per dollar
                </p>
              </li>
            ))}
          </ul>

          <div className="mt-20 flex flex-wrap justify-center gap-10">
            <JoinCircleLink
              variant="linkOnDark"
              memberLabel="View your standing"
            >
              Join the Circle
            </JoinCircleLink>
            <ButtonLink href="/rewards" variant="linkOnDark">
              How it works
            </ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}

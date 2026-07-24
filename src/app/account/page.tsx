import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ButtonLink } from "@/components/Button";
import { SignOutButton } from "@/components/SignOutButton";
import { NotConfigured } from "@/components/NotConfigured";
import { createClient } from "@/lib/supabase/server";
import { formatPrice } from "@/lib/products";
import {
  REDEMPTION_THRESHOLD,
  REDEMPTION_VALUE_CENTS,
  nextTierFor,
  tierFor,
} from "@/lib/rewards";

export const metadata: Metadata = { title: "Account" };
/** Points and orders change after checkout, so never cache this page. */
export const dynamic = "force-dynamic";

type OrderItem = {
  slug: string;
  name: string;
  colorway: string;
  size: string;
  quantity: number;
  unit_price_cents: number;
  image: string;
};

export default async function AccountPage() {
  const supabase = await createClient();
  if (!supabase) {
    return (
      <NotConfigured
        title="Accounts aren't connected yet"
        body="Add your Supabase URL and keys to .env.local, then run supabase/schema.sql in the SQL editor. Sign-in, points, and order history switch on automatically."
      />
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/account");

  const [{ data: profile }, { data: orders }, { data: ledger }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("full_name, email, points, lifetime_spend_cents")
        .eq("id", user.id)
        .single(),
      supabase
        .from("orders")
        .select("id, created_at, amount_total_cents, items, points_awarded, status")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("points_ledger")
        .select("id, created_at, delta, reason")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

  const points = profile?.points ?? 0;
  const spend = profile?.lifetime_spend_cents ?? 0;
  const tier = tierFor(spend);
  const next = nextTierFor(spend);
  const progress = next
    ? Math.min(100, Math.round((spend / next.thresholdCents) * 100))
    : 100;
  const redeemable = Math.floor(points / REDEMPTION_THRESHOLD);

  return (
    <div className="mx-auto max-w-5xl px-5 py-16 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow text-clay">Account</p>
          <h1 className="mt-3 font-display text-4xl font-light text-graphite sm:text-5xl">
            {profile?.full_name?.trim() || "Welcome"}
          </h1>
          <p className="mt-2 text-sm text-ash">{profile?.email ?? user.email}</p>
        </div>
        <SignOutButton />
      </div>

      {/* ------------------------------------------------------------- Standing */}
      <section className="mt-12 border border-parchment bg-linen/60">
        <div className="grid gap-px bg-parchment sm:grid-cols-3">
          <div className="bg-linen/60 px-7 py-8">
            <p className="eyebrow text-clay">Points</p>
            <p className="mt-3 font-display text-4xl text-graphite tabular-nums">
              {points.toLocaleString()}
            </p>
            <p className="mt-2 text-xs text-ash">
              {redeemable > 0
                ? `Worth ${formatPrice(redeemable * REDEMPTION_VALUE_CENTS)} off`
                : `${(REDEMPTION_THRESHOLD - points).toLocaleString()} more for ${formatPrice(REDEMPTION_VALUE_CENTS)} off`}
            </p>
          </div>
          <div className="bg-linen/60 px-7 py-8">
            <p className="eyebrow text-clay">Tier</p>
            <p className="mt-3 font-display text-4xl text-gold-deep">{tier.name}</p>
            <p className="mt-2 text-xs text-ash">
              {tier.multiplier}× points per dollar
            </p>
          </div>
          <div className="bg-linen/60 px-7 py-8">
            <p className="eyebrow text-clay">Lifetime</p>
            <p className="mt-3 font-display text-4xl text-graphite tabular-nums">
              {formatPrice(spend)}
            </p>
            <p className="mt-2 text-xs text-ash">
              {orders?.length ?? 0} order{orders?.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>

        <div className="border-t border-parchment px-7 py-7">
          {next ? (
            <>
              <div className="flex justify-between text-xs text-slate">
                <span>Progress to {next.name}</span>
                <span className="tabular-nums">
                  {formatPrice(Math.max(0, next.thresholdCents - spend))} to go
                </span>
              </div>
              <div className="mt-3 h-1 w-full bg-parchment">
                <div
                  className="h-full bg-gold transition-[width] duration-700"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </>
          ) : (
            <p className="text-xs text-gold-deep">
              You&apos;ve reached Oracle — the highest tier in the Circle. Thank you.
            </p>
          )}

          <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate">
            {tier.perks.map((perk) => (
              <li key={perk} className="flex items-center gap-2">
                <span className="h-px w-3 bg-gold" aria-hidden="true" />
                {perk}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* --------------------------------------------------------------- Orders */}
      <section className="mt-16">
        <h2 className="font-display text-3xl font-light text-graphite">Orders</h2>
        <div className="rule-gold mt-6" />

        {!orders || orders.length === 0 ? (
          <div className="py-14 text-center">
            <p className="text-sm text-slate">No orders yet.</p>
            <ButtonLink href="/hoodies" variant="outline" className="mt-6">
              Shop hoodies
            </ButtonLink>
          </div>
        ) : (
          <ul className="mt-8 space-y-8">
            {orders.map((order) => {
              const items = (order.items ?? []) as OrderItem[];
              return (
                <li key={order.id} className="border border-parchment p-6">
                  <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <p className="text-sm text-slate">
                      {new Date(order.created_at).toLocaleDateString("en-US", {
                        dateStyle: "long",
                      })}
                    </p>
                    <p className="text-sm tabular-nums text-graphite">
                      {formatPrice(order.amount_total_cents)}
                      {order.points_awarded > 0 && (
                        <span className="ml-3 text-xs text-gold-deep">
                          +{order.points_awarded} pts
                        </span>
                      )}
                    </p>
                  </div>

                  <ul className="mt-5 space-y-4">
                    {items.map((item, i) => (
                      <li key={`${item.slug}-${item.size}-${i}`} className="flex gap-4">
                        <Link
                          href={`/hoodies/${item.slug}`}
                          className="relative aspect-[4/5] w-14 shrink-0 overflow-hidden bg-linen"
                        >
                          <Image
                            src={item.image}
                            alt={item.name}
                            fill
                            sizes="56px"
                            className="object-cover"
                          />
                        </Link>
                        <div className="text-sm">
                          <p className="text-graphite">{item.name}</p>
                          <p className="mt-0.5 text-xs text-ash">
                            {item.colorway} · Size {item.size} · Qty {item.quantity}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* --------------------------------------------------------------- Ledger */}
      {ledger && ledger.length > 0 && (
        <section className="mt-16">
          <h2 className="font-display text-3xl font-light text-graphite">
            Points activity
          </h2>
          <div className="rule-gold mt-6" />
          <ul className="mt-6 divide-y divide-parchment">
            {ledger.map((entry) => (
              <li key={entry.id} className="flex justify-between gap-4 py-4 text-sm">
                <div>
                  <p className="text-graphite">{entry.reason}</p>
                  <p className="mt-0.5 text-xs text-ash">
                    {new Date(entry.created_at).toLocaleDateString("en-US", {
                      dateStyle: "medium",
                    })}
                  </p>
                </div>
                <p
                  className={`tabular-nums ${entry.delta >= 0 ? "text-gold-deep" : "text-slate"}`}
                >
                  {entry.delta >= 0 ? "+" : ""}
                  {entry.delta}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

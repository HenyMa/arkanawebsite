import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ButtonLink } from "@/components/Button";
import { CancelReturnButton } from "@/components/CancelReturnButton";
import { SignOutButton } from "@/components/SignOutButton";
import { NotConfigured } from "@/components/NotConfigured";
import { createClient } from "@/lib/supabase/server";
import { getAdmin } from "@/lib/admin";
import { formatPrice, productPathBySlug } from "@/lib/products";
import {
  MEMBER_DISCOUNT_PERCENT,
  MEMBERSHIP_PRICE_CENTS,
  REDEMPTION_THRESHOLD,
  REDEMPTION_VALUE_CENTS,
  WELCOME_DISCOUNT_PERCENT,
  hasMemberDiscount,
  isPurchasableTier,
  nextTierFor,
  standingCents,
  tierFor,
} from "@/lib/rewards";
import {
  RETURN_STATUS_COPY,
  type ReturnStatus,
  daysLeftToReturn,
  isActiveReturn,
  isCancellable,
  isWithinReturnWindow,
  reasonLabel,
  returnWindowDays,
} from "@/lib/returns";

export const metadata: Metadata = { title: "Account" };
/** Points, orders, and returns all change after checkout — never cache this. */
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

type ReturnRow = {
  id: string;
  order_id: string;
  rma_code: string;
  status: string;
  reason: string;
  items: OrderItem[];
  refund_amount_cents: number;
  created_at: string;
};

type Props = {
  searchParams: Promise<{ return?: string }>;
};

export default async function AccountPage({ searchParams }: Props) {
  const supabase = await createClient();
  if (!supabase) {
    return (
      <NotConfigured
        title="Accounts aren't connected yet"
        body="Add your Supabase URL and keys to .env.local, then run supabase/schema.sql in the SQL editor. Sign-in, points, order history, and returns switch on automatically."
      />
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/account");

  const justOpenedReturn = (await searchParams).return === "opened";

  /*
   * The admin entrance lives here rather than in the site header: the header is
   * rendered by the static root layout, and making it check admin status would
   * turn every storefront page dynamic to serve one link.
   */
  const admin = await getAdmin();

  const [
    { data: profile, error: profileError },
    { data: orders },
    { data: ledger },
    { data: returns },
  ] = await Promise.all([
      supabase
        .from("profiles")
        .select(
          "full_name, email, points, lifetime_spend_cents, welcome_discount_used_at, purchased_tier",
        )
        .eq("id", user.id)
        .single(),
      supabase
        .from("orders")
        .select(
          "id, created_at, amount_total_cents, items, points_awarded, status, refunded_cents",
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("points_ledger")
        .select("id, created_at, delta, reason")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("returns")
        .select(
          "id, order_id, rma_code, status, reason, items, refund_amount_cents, created_at",
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

  /*
   * A missing column or table means the schema is behind the code — returns,
   * the welcome discount, and refund tracking each added one. Left alone, every
   * query below would just resolve to null and the page would cheerfully report
   * zero orders and an unused discount, which is worse than saying nothing.
   *
   * 42P01 = undefined_table, 42703 = undefined_column.
   */
  if (profileError && ["42P01", "42703"].includes(profileError.code)) {
    return (
      <NotConfigured
        title="The database needs updating"
        body="Your Supabase schema is missing something this page needs. Open the SQL editor and re-run supabase/schema.sql — it's idempotent, so running it again is safe. Your orders and points are untouched."
      />
    );
  }

  const points = profile?.points ?? 0;
  /*
   * `spend` is what this member has actually paid us and is only ever shown.
   * `standing` is what their tier is worth — the higher of that spend and any
   * tier they bought — and is what every rule on this page reads.
   */
  const spend = profile?.lifetime_spend_cents ?? 0;
  const purchasedTier = profile?.purchased_tier ?? null;
  const standing = standingCents(spend, purchasedTier);

  const tier = tierFor(standing);
  const next = nextTierFor(standing);
  const progress = next
    ? Math.min(100, Math.round((standing / next.thresholdCents) * 100))
    : 100;
  const redeemable = Math.floor(points / REDEMPTION_THRESHOLD);
  const windowDays = returnWindowDays(standing);

  const hasOrdered = (orders?.length ?? 0) > 0;
  const welcomeDiscountAvailable =
    !profile?.welcome_discount_used_at && !hasOrdered;

  // Returns, grouped so each order can show what's already coming back.
  const returnsByOrder = new Map<string, ReturnRow[]>();
  for (const row of (returns ?? []) as ReturnRow[]) {
    const list = returnsByOrder.get(row.order_id) ?? [];
    list.push(row);
    returnsByOrder.set(row.order_id, list);
  }

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
        <div className="flex items-center gap-6">
          {admin && (
            <Link
              href="/admin"
              className="eyebrow link-underline pb-0.5 text-gold-deep transition-colors hover:text-graphite"
            >
              Studio
            </Link>
          )}
          <SignOutButton />
        </div>
      </div>

      {justOpenedReturn && (
        <p className="animate-rise mt-8 border border-gold bg-linen/60 px-6 py-4 text-sm leading-relaxed text-graphite">
          Your return is open. We&apos;ll email a prepaid label within one
          business day — you&apos;ll find the reference below.
        </p>
      )}

      {welcomeDiscountAvailable && (
        <p className="mt-8 border border-gold bg-linen/60 px-6 py-4 text-sm leading-relaxed text-graphite">
          <span className="text-gold-deep">
            {WELCOME_DISCOUNT_PERCENT}% off your first order
          </span>{" "}
          is waiting on your account. It comes off automatically at checkout —
          there&apos;s no code to enter.
        </p>
      )}

      {hasMemberDiscount(standing) && (
        <p className="mt-8 border border-parchment bg-linen/60 px-6 py-4 text-sm leading-relaxed text-graphite">
          <span className="text-gold-deep">
            {MEMBER_DISCOUNT_PERCENT}% off every order
          </span>{" "}
          comes with {tier.name}. It&apos;s taken off automatically at checkout,
          on every order — not just your next one.
        </p>
      )}

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
              {purchasedTier === tier.name && " · membership"}
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
                  {formatPrice(Math.max(0, next.thresholdCents - standing))} to
                  go
                </span>
              </div>
              <div className="mt-3 h-1 w-full bg-parchment">
                <div
                  className="h-full bg-gold transition-[width] duration-700"
                  style={{ width: `${progress}%` }}
                />
              </div>
              {isPurchasableTier(next.name) && (
                <p className="mt-4 text-xs text-slate">
                  Or take {next.name} now for{" "}
                  {formatPrice(MEMBERSHIP_PRICE_CENTS[next.name])} —{" "}
                  <Link
                    href="/rewards#memberships"
                    className="link-underline pb-0.5 text-gold-deep hover:text-graphite"
                  >
                    every perk, straight away
                  </Link>
                  .
                </p>
              )}
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
            <ButtonLink href="/shop" variant="outline" className="mt-6">
              Shop the collection
            </ButtonLink>
          </div>
        ) : (
          <ul className="mt-8 space-y-8">
            {orders.map((order) => {
              const items = (order.items ?? []) as OrderItem[];
              const orderReturns = returnsByOrder.get(order.id) ?? [];

              // Every unit already on a live return.
              const claimed = orderReturns
                .filter((r) => isActiveReturn(r.status))
                .flatMap((r) => r.items ?? [])
                .reduce((sum, item) => sum + item.quantity, 0);
              const totalUnits = items.reduce((sum, i) => sum + i.quantity, 0);

              const returnable =
                items.length > 0 &&
                claimed < totalUnits &&
                order.status !== "refunded" &&
                isWithinReturnWindow(order.created_at, standing);

              const daysLeft = daysLeftToReturn(order.created_at, standing);

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
                      {(order.refunded_cents ?? 0) > 0 && (
                        <span className="ml-3 text-xs text-ash">
                          {formatPrice(order.refunded_cents)} refunded
                        </span>
                      )}
                    </p>
                  </div>

                  <ul className="mt-5 space-y-4">
                    {items.map((item, i) => (
                      <li key={`${item.slug}-${item.size}-${i}`} className="flex gap-4">
                        <Link
                          href={productPathBySlug(item.slug)}
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

                  <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-parchment pt-5">
                    {returnable ? (
                      <p className="text-xs text-ash">
                        {daysLeft} day{daysLeft === 1 ? "" : "s"} left to return
                        {claimed > 0 && " what's left of this order"}
                      </p>
                    ) : (
                      <p className="text-xs text-ash">
                        {order.status === "refunded"
                          ? "Fully refunded"
                          : claimed > 0 && claimed >= totalUnits
                            ? "All items are on a return"
                            : `Return window closed (${windowDays} days)`}
                      </p>
                    )}

                    {returnable && (
                      <Link
                        href={`/account/returns/${order.id}`}
                        className="eyebrow link-underline pb-0.5 text-slate hover:text-graphite"
                      >
                        Start a return
                      </Link>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* -------------------------------------------------------------- Returns */}
      {returns && returns.length > 0 && (
        <section className="mt-16">
          <h2 className="font-display text-3xl font-light text-graphite">
            Returns
          </h2>
          <div className="rule-gold mt-6" />

          <ul className="mt-8 space-y-6">
            {(returns as ReturnRow[]).map((row) => {
              const copy =
                RETURN_STATUS_COPY[row.status as ReturnStatus] ??
                RETURN_STATUS_COPY.requested;

              return (
                <li key={row.id} className="border border-parchment p-6">
                  <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <div>
                      <p className="font-display text-xl text-graphite">
                        {copy.label}
                      </p>
                      <p className="mt-1 text-xs tracking-[0.14em] text-ash">
                        {row.rma_code}
                      </p>
                    </div>
                    <p className="text-sm tabular-nums text-slate">
                      {formatPrice(row.refund_amount_cents)}
                      <span className="ml-2 text-xs text-ash">
                        {row.status === "refunded" ? "refunded" : "expected"}
                      </span>
                    </p>
                  </div>

                  <p className="mt-4 text-sm leading-relaxed text-slate">
                    {copy.description}
                  </p>

                  <ul className="mt-4 space-y-1 text-xs text-ash">
                    {(row.items ?? []).map((item, i) => (
                      <li key={`${item.slug}-${item.size}-${i}`}>
                        {item.name} · Size {item.size}
                        {item.quantity > 1 && ` · ×${item.quantity}`}
                      </li>
                    ))}
                  </ul>

                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-parchment pt-4">
                    <p className="text-xs text-ash">
                      {reasonLabel(row.reason)} · opened{" "}
                      {new Date(row.created_at).toLocaleDateString("en-US", {
                        dateStyle: "medium",
                      })}
                    </p>
                    {isCancellable(row.status) && (
                      <CancelReturnButton returnId={row.id} />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

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

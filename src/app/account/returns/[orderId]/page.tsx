import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ButtonLink } from "@/components/Button";
import { NotConfigured } from "@/components/NotConfigured";
import {
  ReturnRequestForm,
  type ReturnableItem,
} from "@/components/ReturnRequestForm";
import { createClient } from "@/lib/supabase/server";
import { standingCents } from "@/lib/rewards";
import {
  daysLeftToReturn,
  isActiveReturn,
  isWithinReturnWindow,
  returnDeadline,
  returnWindowDays,
} from "@/lib/returns";

export const metadata: Metadata = {
  title: "Start a return",
  robots: { index: false },
};

/** Returnable quantities change the moment a request is filed. */
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ orderId: string }> };

type OrderItem = {
  slug: string;
  name: string;
  colorway: string;
  size: string;
  quantity: number;
  unit_price_cents: number;
  image: string;
};

export default async function StartReturnPage({ params }: Params) {
  const { orderId } = await params;

  const supabase = await createClient();
  if (!supabase) {
    return (
      <NotConfigured
        title="Returns aren't connected yet"
        body="Add your Supabase URL and keys to .env.local, then run supabase/schema.sql in the SQL editor. Returns switch on automatically."
      />
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/account/returns/${orderId}`);

  const [{ data: order }, { data: profile }] = await Promise.all([
    supabase
      .from("orders")
      .select(
        "id, created_at, status, items, amount_subtotal_cents, discount_cents",
      )
      .eq("id", orderId)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("lifetime_spend_cents, purchased_tier")
      .eq("id", user.id)
      .single(),
  ]);

  if (!order) notFound();

  // Standing, not raw spend: a bought Adept gets the extended window too.
  const standing = standingCents(
    profile?.lifetime_spend_cents,
    profile?.purchased_tier,
  );
  const windowDays = returnWindowDays(standing);

  const { data: existing } = await supabase
    .from("returns")
    .select("status, items")
    .eq("order_id", order.id);

  // Anything on a live return is already spoken for.
  const claimed = new Map<string, number>();
  for (const prior of existing ?? []) {
    if (!isActiveReturn(prior.status)) continue;
    for (const item of (prior.items ?? []) as OrderItem[]) {
      const key = `${item.slug}::${item.size}`;
      claimed.set(key, (claimed.get(key) ?? 0) + item.quantity);
    }
  }

  const items: ReturnableItem[] = ((order.items ?? []) as OrderItem[])
    .map((item) => ({
      slug: item.slug,
      name: item.name,
      colorway: item.colorway,
      size: item.size,
      image: item.image,
      unit_price_cents: item.unit_price_cents,
      returnable: item.quantity - (claimed.get(`${item.slug}::${item.size}`) ?? 0),
    }))
    .filter((item) => item.returnable > 0);

  const withinWindow = isWithinReturnWindow(order.created_at, standing);
  const deadline = returnDeadline(order.created_at, standing);
  const daysLeft = daysLeftToReturn(order.created_at, standing);

  const blocked =
    order.status === "refunded"
      ? "This order has already been refunded in full."
      : !withinWindow
        ? `The ${windowDays}-day return window for this order closed on ${deadline.toLocaleDateString("en-US", { dateStyle: "long" })}.`
        : items.length === 0
          ? "Everything on this order is already part of a return."
          : null;

  return (
    <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
      <nav className="text-xs text-ash">
        <Link href="/account" className="hover:text-slate">
          Account
        </Link>
        <span className="mx-2">/</span>
        <span className="text-slate">Start a return</span>
      </nav>

      <header className="mt-8">
        <p className="eyebrow text-clay">Returns</p>
        <h1 className="mt-3 font-display text-4xl font-light text-graphite sm:text-5xl">
          Start a return
        </h1>
        <p className="mt-4 text-sm text-slate">
          Order of{" "}
          {new Date(order.created_at).toLocaleDateString("en-US", {
            dateStyle: "long",
          })}
          {!blocked && (
            <>
              {" "}
              · {daysLeft} day{daysLeft === 1 ? "" : "s"} left of your{" "}
              {windowDays}-day window
            </>
          )}
        </p>
      </header>

      <div className="rule-gold mt-8" />

      {blocked ? (
        <div className="py-16 text-center">
          <p className="mx-auto max-w-md text-sm leading-relaxed text-slate">
            {blocked}
          </p>
          <p className="mx-auto mt-4 max-w-md text-xs leading-relaxed text-ash">
            If something isn&apos;t right, write to us anyway — we read every
            email and we&apos;d rather fix it than win the argument.
          </p>
          <ButtonLink href="/account" variant="outline" className="mt-8">
            Back to your account
          </ButtonLink>
        </div>
      ) : (
        <ReturnRequestForm
          orderId={order.id}
          items={items}
          orderSubtotalCents={order.amount_subtotal_cents ?? 0}
          orderDiscountCents={order.discount_cents ?? 0}
        />
      )}
    </div>
  );
}

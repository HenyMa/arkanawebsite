import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatPrice } from "@/lib/products";

type Props = { searchParams: Promise<{ q?: string }> };

type OrderRow = {
  id: string;
  created_at: string;
  email: string | null;
  amount_total_cents: number;
  discount_cents: number;
  refunded_cents: number;
  status: string;
  points_awarded: number;
  items: { quantity: number }[];
};

const PAGE_SIZE = 50;

export default async function AdminOrders({ searchParams }: Props) {
  const q = ((await searchParams).q ?? "").trim();

  const supabase = await createClient();
  if (!supabase) return null;

  let query = supabase
    .from("orders")
    .select(
      "id, created_at, email, amount_total_cents, discount_cents, refunded_cents, status, points_awarded, items",
    )
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE);

  // Email is the only handle worth searching by — it's what a customer quotes.
  if (q) query = query.ilike("email", `%${q}%`);

  const { data, error } = await query;
  const rows = (data ?? []) as OrderRow[];

  return (
    <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8">
      <h1 className="font-display text-4xl font-light text-graphite">Orders</h1>
      <p className="mt-2 text-sm text-ash">
        The {PAGE_SIZE} most recent, newest first.
      </p>

      <form action="/admin/orders" method="get" className="mt-8 max-w-md">
        <div className="flex border border-sand focus-within:border-gold">
          <input
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Search by email…"
            aria-label="Search orders by email"
            className="w-full bg-bone px-4 py-2.5 text-sm text-graphite placeholder:text-mist focus:outline-none"
          />
          <button
            type="submit"
            className="shrink-0 bg-graphite px-5 text-[0.7rem] font-medium uppercase tracking-[0.18em] text-bone transition-colors hover:bg-gold-deep"
          >
            Find
          </button>
        </div>
      </form>

      <div className="rule-gold mt-8" />

      {error ? (
        <p className="py-12 text-sm text-gold-deep">Couldn&apos;t load orders.</p>
      ) : rows.length === 0 ? (
        <p className="py-12 text-sm text-ash">
          {q ? `No orders for "${q}".` : "No orders yet."}
        </p>
      ) : (
        <ul className="mt-8 divide-y divide-parchment border-y border-parchment">
          {rows.map((order) => {
            const units = (order.items ?? []).reduce(
              (sum, i) => sum + (i.quantity ?? 0),
              0,
            );
            const refunded = order.refunded_cents ?? 0;

            return (
              <li
                key={order.id}
                className="flex flex-wrap items-center gap-x-6 gap-y-2 py-5"
              >
                <span className="w-28 shrink-0 text-xs text-ash">
                  {new Date(order.created_at).toLocaleDateString("en-US", {
                    dateStyle: "medium",
                  })}
                </span>

                <span className="min-w-0 flex-1 truncate text-sm text-slate">
                  {order.email ?? "guest"}
                  <span className="text-ash">
                    {" · "}
                    {units} item{units === 1 ? "" : "s"}
                    {order.discount_cents > 0 &&
                      ` · −${formatPrice(order.discount_cents)}`}
                  </span>
                </span>

                {refunded > 0 && (
                  <span className="shrink-0 text-xs text-gold-deep">
                    {formatPrice(refunded)} refunded
                  </span>
                )}

                <span className="shrink-0 text-sm tabular-nums text-graphite">
                  {formatPrice(order.amount_total_cents)}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-10 text-xs leading-relaxed text-ash">
        Orders are written by the Stripe webhook and are never edited here. To
        refund one, do it in Stripe — the webhook records it and reverses the
        member&apos;s points.{" "}
        <Link href="/admin/returns" className="link-underline text-slate">
          Open returns
        </Link>
      </p>
    </div>
  );
}

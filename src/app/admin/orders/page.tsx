import Link from "next/link";
import { FulfilOrderForm } from "@/components/FulfilOrderForm";
import { NotConfigured } from "@/components/NotConfigured";
import { createClient } from "@/lib/supabase/server";
import { formatPrice } from "@/lib/products";
import { formatAddress } from "@/lib/orders";

type Props = { searchParams: Promise<{ q?: string; view?: string }> };

type Item = {
  slug: string;
  name: string;
  colorway: string;
  size: string;
  quantity: number;
  unit_price_cents: number;
};

type OrderRow = {
  id: string;
  created_at: string;
  email: string | null;
  amount_total_cents: number;
  discount_cents: number;
  refunded_cents: number;
  status: string;
  points_awarded: number;
  items: Item[];
  shipping: unknown;
  fulfilled_at: string | null;
  tracking_carrier: string | null;
  tracking_number: string | null;
};

const PAGE_SIZE = 50;

const VIEWS = [
  { id: "queue", label: "To pack" },
  { id: "shipped", label: "Shipped" },
  { id: "all", label: "All" },
] as const;

export default async function AdminOrders({ searchParams }: Props) {
  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const view = VIEWS.some((v) => v.id === params.view)
    ? (params.view as (typeof VIEWS)[number]["id"])
    : "queue";

  const supabase = await createClient();
  if (!supabase) return null;

  let query = supabase
    .from("orders")
    .select(
      "id, created_at, email, amount_total_cents, discount_cents, refunded_cents, status, points_awarded, items, shipping, fulfilled_at, tracking_carrier, tracking_number",
    )
    .limit(PAGE_SIZE);

  // The queue is worked oldest-first — the person who has been waiting longest
  // gets packed first. Everywhere else, newest is what you want to see.
  if (view === "queue") {
    query = query.is("fulfilled_at", null).order("created_at", { ascending: true });
  } else {
    if (view === "shipped") query = query.not("fulfilled_at", "is", null);
    query = query.order("created_at", { ascending: false });
  }

  // Email is the only handle worth searching by — it's what a customer quotes.
  if (q) query = query.ilike("email", `%${q}%`);

  const { data, error } = await query;

  // 42703 = undefined_column: the fulfilment columns aren't there yet.
  if (error?.code === "42703") {
    return (
      <NotConfigured
        title="The database needs updating"
        body="This page needs the fulfilment columns on `orders`. Open the Supabase SQL editor and re-run supabase/schema.sql — it's idempotent, so running it again is safe."
      />
    );
  }

  const rows = (data ?? []) as OrderRow[];

  return (
    <div className="mx-auto max-w-4xl px-5 py-14 sm:px-8">
      <h1 className="font-display text-4xl font-light text-graphite">Orders</h1>
      <p className="mt-2 text-sm text-ash">
        {view === "queue"
          ? "Waiting to be packed, longest wait first."
          : `The ${PAGE_SIZE} most recent, newest first.`}
      </p>

      <div className="mt-8 flex flex-wrap items-center gap-6">
        <nav className="flex gap-5">
          {VIEWS.map((v) => (
            <Link
              key={v.id}
              href={`/admin/orders?view=${v.id}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
              className={
                v.id === view
                  ? "eyebrow border-b border-gold pb-1 text-graphite"
                  : "eyebrow border-b border-transparent pb-1 text-ash transition-colors hover:text-graphite"
              }
            >
              {v.label}
            </Link>
          ))}
        </nav>

        <form action="/admin/orders" method="get" className="ml-auto max-w-xs flex-1">
          <input type="hidden" name="view" value={view} />
          <div className="flex border border-parchment focus-within:border-graphite">
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
      </div>

      <div className="rule-gold mt-6" />

      {error ? (
        <p className="py-12 text-sm text-gold-deep">Couldn&apos;t load orders.</p>
      ) : rows.length === 0 ? (
        <p className="py-12 text-sm text-ash">
          {q
            ? `No orders for "${q}".`
            : view === "queue"
              ? "Nothing waiting. Everything is packed."
              : "No orders yet."}
        </p>
      ) : (
        <ul className="mt-10 space-y-10">
          {rows.map((order) => {
            const items = order.items ?? [];
            const units = items.reduce((sum, i) => sum + (i.quantity ?? 0), 0);
            const address = formatAddress(order.shipping);
            const refunded = order.refunded_cents ?? 0;

            return (
              <li key={order.id} className="border border-parchment">
                <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-parchment px-6 py-4">
                  <span className="text-xs text-ash">
                    {new Date(order.created_at).toLocaleDateString("en-US", {
                      dateStyle: "medium",
                    })}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-slate">
                    {order.email ?? "guest"}
                  </span>
                  {refunded > 0 && (
                    <span className="text-xs text-gold-deep">
                      {formatPrice(refunded)} refunded
                    </span>
                  )}
                  <span className="text-sm tabular-nums text-graphite">
                    {formatPrice(order.amount_total_cents)}
                  </span>
                </div>

                <div className="grid gap-8 px-6 py-6 sm:grid-cols-2">
                  {/* ------------------------------------------------- Pack list */}
                  <div>
                    <h2 className="eyebrow text-clay">
                      Pack · {units} item{units === 1 ? "" : "s"}
                    </h2>
                    {items.length === 0 ? (
                      <p className="mt-4 text-sm text-ash">
                        No line items were recorded — open this session in Stripe
                        to see what was bought.
                      </p>
                    ) : (
                      <ul className="mt-4 space-y-2 text-sm leading-relaxed text-slate">
                        {items.map((item, i) => (
                          <li key={`${item.slug}-${item.size}-${i}`}>
                            <span className="tabular-nums text-graphite">
                              {item.quantity}×
                            </span>{" "}
                            {item.name}
                            {item.colorway && (
                              <span className="text-ash"> — {item.colorway}</span>
                            )}
                            <span className="text-ash"> · size {item.size}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* ---------------------------------------------------- Address */}
                  <div>
                    <h2 className="eyebrow text-clay">Ship to</h2>
                    {address.length === 0 ? (
                      <p className="mt-4 text-sm text-ash">
                        No address on this order. It predates address collection,
                        or was taken outside the site.
                      </p>
                    ) : (
                      <address className="mt-4 text-sm not-italic leading-relaxed text-slate">
                        {address.map((line, i) => (
                          <span key={i} className="block">
                            {line}
                          </span>
                        ))}
                      </address>
                    )}
                  </div>
                </div>

                <div className="border-t border-parchment px-6 py-4">
                  <FulfilOrderForm
                    orderId={order.id}
                    fulfilledAt={order.fulfilled_at}
                    carrier={order.tracking_carrier}
                    trackingNumber={order.tracking_number}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-12 text-xs leading-relaxed text-ash">
        Orders and their totals are written by the Stripe webhook and are never
        edited here — only whether they&apos;ve shipped. To refund one, do it in
        Stripe; the webhook records it and reverses the member&apos;s points.{" "}
        <Link href="/admin/returns" className="link-underline text-slate">
          Open returns
        </Link>
      </p>
    </div>
  );
}

import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ReturnActions } from "@/components/ReturnActions";
import { createClient } from "@/lib/supabase/server";
import { formatPrice, productPathBySlug } from "@/lib/products";
import { RETURN_STATUS_COPY, reasonLabel, type ReturnStatus } from "@/lib/returns";

type Params = { params: Promise<{ id: string }> };

type Item = {
  slug: string;
  name: string;
  colorway: string;
  size: string;
  quantity: number;
  unit_price_cents: number;
  image: string;
};

type ReturnDetail = {
  id: string;
  rma_code: string;
  status: string;
  reason: string;
  comment: string | null;
  admin_note: string | null;
  items: Item[];
  refund_amount_cents: number;
  refunded_cents: number;
  points_reversed: number;
  free_postage: boolean;
  created_at: string;
  handled_at: string | null;
  orders: {
    id: string;
    email: string | null;
    created_at: string;
    amount_total_cents: number;
    discount_cents: number;
    refunded_cents: number;
    shipping: unknown;
  } | null;
};

function formatAddress(shipping: unknown): string[] {
  const s = shipping as
    | { name?: string; address?: Record<string, string | null> }
    | null;
  if (!s?.address) return [];
  const a = s.address;
  return [
    s.name,
    a.line1,
    a.line2,
    [a.city, a.state, a.postal_code].filter(Boolean).join(" "),
    a.country,
  ].filter((line): line is string => Boolean(line && line.trim()));
}

export default async function AdminReturnDetail({ params }: Params) {
  const { id } = await params;

  const supabase = await createClient();
  if (!supabase) return null;

  const { data } = await supabase
    .from("returns")
    .select(
      "id, rma_code, status, reason, comment, admin_note, items, refund_amount_cents, refunded_cents, points_reversed, free_postage, created_at, handled_at, orders(id, email, created_at, amount_total_cents, discount_cents, refunded_cents, shipping)",
    )
    .eq("id", id)
    .maybeSingle();

  if (!data) notFound();
  const ret = data as unknown as ReturnDetail;

  const copy =
    RETURN_STATUS_COPY[ret.status as ReturnStatus] ?? RETURN_STATUS_COPY.requested;
  const address = formatAddress(ret.orders?.shipping);

  return (
    <div className="mx-auto max-w-5xl px-5 py-14 sm:px-8">
      <nav className="text-xs text-ash">
        <Link href="/admin/returns" className="hover:text-slate">
          Returns
        </Link>
        <span className="mx-2">/</span>
        <span className="text-slate">{ret.rma_code}</span>
      </nav>

      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow text-clay">{copy.label}</p>
          <h1 className="mt-2 font-display text-4xl font-light text-graphite">
            {ret.rma_code}
          </h1>
          <p className="mt-2 text-sm text-ash">
            Opened{" "}
            {new Date(ret.created_at).toLocaleDateString("en-US", {
              dateStyle: "long",
            })}
            {ret.orders?.email && ` · ${ret.orders.email}`}
          </p>
        </div>
        <p className="font-display text-3xl text-graphite tabular-nums">
          {formatPrice(ret.refund_amount_cents)}
        </p>
      </div>

      <div className="rule-gold mt-8" />

      <div className="mt-10 grid gap-12 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <h2 className="eyebrow text-clay">Coming back</h2>
          <ul className="mt-5 divide-y divide-parchment border-y border-parchment">
            {(ret.items ?? []).map((item, i) => (
              <li key={`${item.slug}-${item.size}-${i}`} className="flex gap-5 py-5">
                <Link
                  href={productPathBySlug(item.slug)}
                  className="relative aspect-[4/5] w-16 shrink-0 overflow-hidden bg-linen"
                >
                  <Image
                    src={item.image}
                    alt={item.name}
                    fill
                    sizes="64px"
                    className="object-cover"
                  />
                </Link>
                <div className="flex-1">
                  <p className="font-display text-lg text-graphite">{item.name}</p>
                  <p className="mt-1 text-xs text-ash">
                    {item.colorway} · Size {item.size} · Qty {item.quantity}
                  </p>
                </div>
                <p className="text-sm tabular-nums text-slate">
                  {formatPrice(item.unit_price_cents * item.quantity)}
                </p>
              </li>
            ))}
          </ul>

          <div className="mt-8">
            <h2 className="eyebrow text-clay">Why</h2>
            <p className="mt-3 text-sm text-graphite">{reasonLabel(ret.reason)}</p>
            {ret.comment && (
              <p className="mt-3 border-l border-tan pl-4 text-sm leading-relaxed text-slate">
                {ret.comment}
              </p>
            )}
          </div>

          {ret.admin_note && (
            <div className="mt-8">
              <h2 className="eyebrow text-clay">Last note</h2>
              <p className="mt-3 border-l border-gold pl-4 text-sm leading-relaxed text-slate">
                {ret.admin_note}
              </p>
              {ret.handled_at && (
                <p className="mt-2 pl-4 text-xs text-ash">
                  {new Date(ret.handled_at).toLocaleString("en-US", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </p>
              )}
            </div>
          )}

          <div className="mt-12 border border-parchment bg-linen/60 p-7">
            <h2 className="eyebrow text-clay">Move it along</h2>
            <div className="mt-5">
              <ReturnActions returnId={ret.id} status={ret.status} />
            </div>
          </div>
        </div>

        {/* ---------------------------------------------------------- Sidebar */}
        <aside className="h-fit space-y-8">
          <div className="border border-parchment p-6">
            <h2 className="eyebrow text-clay">Money</h2>
            <dl className="mt-4 space-y-2.5 text-sm">
              <Row label="Owed back" value={formatPrice(ret.refund_amount_cents)} />
              <Row
                label="Refunded"
                value={
                  ret.refunded_cents > 0 ? formatPrice(ret.refunded_cents) : "—"
                }
              />
              <Row
                label="Points reversed"
                value={ret.points_reversed > 0 ? `−${ret.points_reversed}` : "—"}
              />
              <Row
                label="Return postage"
                value={ret.free_postage ? "On us" : "Customer pays"}
              />
            </dl>
            {(ret.orders?.discount_cents ?? 0) > 0 && (
              <p className="mt-4 text-xs leading-relaxed text-ash">
                The order was discounted, so this figure is the returned
                items&apos; share of what was actually paid.
              </p>
            )}
          </div>

          <div className="border border-parchment p-6">
            <h2 className="eyebrow text-clay">Order</h2>
            <dl className="mt-4 space-y-2.5 text-sm">
              <Row
                label="Placed"
                value={
                  ret.orders
                    ? new Date(ret.orders.created_at).toLocaleDateString("en-US", {
                        dateStyle: "medium",
                      })
                    : "—"
                }
              />
              <Row
                label="Order total"
                value={
                  ret.orders ? formatPrice(ret.orders.amount_total_cents) : "—"
                }
              />
            </dl>
            {ret.orders && (
              <Link
                href={`/admin/orders?q=${encodeURIComponent(ret.orders.email ?? "")}`}
                className="link-underline mt-4 inline-block text-xs text-gold-deep"
              >
                Other orders from this member
              </Link>
            )}
          </div>

          {address.length > 0 && (
            <div className="border border-parchment p-6">
              <h2 className="eyebrow text-clay">Ships from</h2>
              <address className="mt-4 text-sm not-italic leading-relaxed text-slate">
                {address.map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
              </address>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate">{label}</dt>
      <dd className="tabular-nums text-graphite">{value}</dd>
    </div>
  );
}

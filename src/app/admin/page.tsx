import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatPrice } from "@/lib/products";
import { RETURN_STATUS_COPY, type ReturnStatus } from "@/lib/returns";

type ReturnRow = { status: string; refund_amount_cents: number };

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export default async function AdminOverview() {
  const supabase = await createClient();
  if (!supabase) return null;

  const since = new Date(Date.now() - THIRTY_DAYS_MS).toISOString();

  const [
    { data: returns },
    { count: orderCount },
    { data: recentOrders },
    { count: memberCount },
  ] = await Promise.all([
    supabase.from("returns").select("status, refund_amount_cents"),
    supabase.from("orders").select("id", { count: "exact", head: true }),
    supabase
      .from("orders")
      .select("amount_total_cents, refunded_cents, created_at")
      .gte("created_at", since),
    supabase.from("profiles").select("id", { count: "exact", head: true }),
  ]);

  const rows = (returns ?? []) as ReturnRow[];
  const byStatus = new Map<string, { count: number; cents: number }>();
  for (const row of rows) {
    const bucket = byStatus.get(row.status) ?? { count: 0, cents: 0 };
    bucket.count += 1;
    bucket.cents += row.refund_amount_cents ?? 0;
    byStatus.set(row.status, bucket);
  }

  const needsAction =
    (byStatus.get("requested")?.count ?? 0) +
    (byStatus.get("received")?.count ?? 0);

  const awaitingRefund = byStatus.get("received") ?? { count: 0, cents: 0 };

  const revenue = (recentOrders ?? []).reduce(
    (sum, o) => sum + (o.amount_total_cents ?? 0) - (o.refunded_cents ?? 0),
    0,
  );

  return (
    <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8">
      <h1 className="font-display text-4xl font-light text-graphite">Overview</h1>
      <p className="mt-2 text-sm text-ash">
        Everything needing a decision, and how the last thirty days went.
      </p>

      {/* The only number worth leading with is the one that implies work. */}
      <Link
        href="/admin/returns"
        className={`mt-10 block border p-7 transition-colors ${
          needsAction > 0
            ? "border-gold bg-linen/60 hover:bg-linen"
            : "border-parchment hover:bg-linen/40"
        }`}
      >
        <p className="eyebrow text-clay">Needs your attention</p>
        <p className="mt-3 font-display text-5xl font-light text-graphite tabular-nums">
          {needsAction}
        </p>
        <p className="mt-2 text-sm text-slate">
          {needsAction === 0
            ? "Nothing waiting. Every return is either moving or closed."
            : `${byStatus.get("requested")?.count ?? 0} to approve · ${
                awaitingRefund.count
              } received and awaiting refund`}
        </p>
      </Link>

      <div className="mt-8 grid gap-px border border-parchment bg-parchment sm:grid-cols-3">
        <Stat
          label="Awaiting refund"
          value={formatPrice(awaitingRefund.cents)}
          hint={`${awaitingRefund.count} return${awaitingRefund.count === 1 ? "" : "s"} checked in`}
        />
        <Stat
          label="Net · 30 days"
          value={formatPrice(revenue)}
          hint={`${recentOrders?.length ?? 0} order${recentOrders?.length === 1 ? "" : "s"}, refunds deducted`}
        />
        <Stat
          label="Members"
          value={String(memberCount ?? 0)}
          hint={`${orderCount ?? 0} order${orderCount === 1 ? "" : "s"} all time`}
        />
      </div>

      <section className="mt-14">
        <h2 className="font-display text-2xl text-graphite">Returns by status</h2>
        <div className="rule-gold mt-5" />

        {rows.length === 0 ? (
          <p className="py-10 text-sm text-ash">No returns have been opened yet.</p>
        ) : (
          <ul className="mt-6 divide-y divide-parchment border-y border-parchment">
            {(Object.keys(RETURN_STATUS_COPY) as ReturnStatus[])
              .filter((status) => byStatus.has(status))
              .map((status) => {
                const bucket = byStatus.get(status)!;
                return (
                  <li key={status}>
                    <Link
                      href={`/admin/returns?status=${status}`}
                      className="flex items-center justify-between gap-4 py-4 transition-colors hover:bg-linen/50"
                    >
                      <span className="text-sm text-graphite">
                        {RETURN_STATUS_COPY[status].label}
                      </span>
                      <span className="flex items-center gap-6 text-sm tabular-nums">
                        <span className="text-ash">
                          {formatPrice(bucket.cents)}
                        </span>
                        <span className="w-8 text-right text-graphite">
                          {bucket.count}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="bg-bone px-6 py-7">
      <p className="eyebrow text-clay">{label}</p>
      <p className="mt-3 font-display text-3xl text-graphite tabular-nums">
        {value}
      </p>
      <p className="mt-2 text-xs text-ash">{hint}</p>
    </div>
  );
}

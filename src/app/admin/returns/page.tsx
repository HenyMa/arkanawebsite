import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatPrice } from "@/lib/products";
import {
  ACTIONABLE_STATUSES,
  RETURN_STATUS_COPY,
  reasonLabel,
  type ReturnStatus,
} from "@/lib/returns";

type Props = { searchParams: Promise<{ status?: string }> };

type ReturnRow = {
  id: string;
  rma_code: string;
  status: string;
  reason: string;
  refund_amount_cents: number;
  created_at: string;
  items: { name: string; size: string; quantity: number }[];
  orders: { email: string | null } | null;
};

const FILTERS: { value: string; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "all", label: "All" },
  ...(Object.keys(RETURN_STATUS_COPY) as ReturnStatus[]).map((s) => ({
    value: s,
    label: RETURN_STATUS_COPY[s].label,
  })),
];

export default async function AdminReturns({ searchParams }: Props) {
  const filter = (await searchParams).status ?? "open";

  const supabase = await createClient();
  if (!supabase) return null;

  let query = supabase
    .from("returns")
    .select(
      "id, rma_code, status, reason, refund_amount_cents, created_at, items, orders(email)",
    )
    .order("created_at", { ascending: true });

  // "Open" is the default because it is the only view that implies work.
  if (filter === "open") query = query.in("status", ACTIONABLE_STATUSES);
  else if (filter !== "all") query = query.eq("status", filter);

  const { data, error } = await query;
  const rows = (data ?? []) as unknown as ReturnRow[];

  return (
    <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8">
      <h1 className="font-display text-4xl font-light text-graphite">Returns</h1>
      <p className="mt-2 text-sm text-ash">
        Oldest first — the one that has been waiting longest is at the top.
      </p>

      <nav className="mt-8 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={`/admin/returns?status=${f.value}`}
            className={`border px-3.5 py-1.5 text-xs transition-colors ${
              filter === f.value
                ? "border-graphite bg-graphite text-bone"
                : "border-sand text-slate hover:border-gold hover:bg-linen"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </nav>

      <div className="rule-gold mt-8" />

      {error ? (
        <p className="py-12 text-sm text-gold-deep">
          Couldn&apos;t load returns. If you&apos;ve just pulled changes, re-run
          supabase/schema.sql.
        </p>
      ) : rows.length === 0 ? (
        <p className="py-12 text-sm text-ash">
          {filter === "open"
            ? "Nothing open. Every return is either closed or already refunded."
            : "No returns match this filter."}
        </p>
      ) : (
        <ul className="mt-8 divide-y divide-parchment border-y border-parchment">
          {rows.map((row) => {
            const copy =
              RETURN_STATUS_COPY[row.status as ReturnStatus] ??
              RETURN_STATUS_COPY.requested;
            const units = (row.items ?? []).reduce(
              (sum, i) => sum + (i.quantity ?? 0),
              0,
            );
            const age = Math.floor(
              (Date.now() - new Date(row.created_at).getTime()) / 86_400_000,
            );

            return (
              <li key={row.id}>
                <Link
                  href={`/admin/returns/${row.id}`}
                  className="flex flex-wrap items-center gap-x-6 gap-y-2 py-5 transition-colors hover:bg-linen/50"
                >
                  <span className="w-28 shrink-0 text-xs tracking-[0.12em] text-graphite">
                    {row.rma_code}
                  </span>

                  <span className="w-32 shrink-0 text-xs text-slate">
                    {copy.label}
                  </span>

                  <span className="min-w-0 flex-1 truncate text-sm text-slate">
                    {row.orders?.email ?? "—"}
                    <span className="text-ash">
                      {" · "}
                      {units} item{units === 1 ? "" : "s"} ·{" "}
                      {reasonLabel(row.reason)}
                    </span>
                  </span>

                  <span className="shrink-0 text-sm tabular-nums text-graphite">
                    {formatPrice(row.refund_amount_cents)}
                  </span>

                  <span
                    className={`w-20 shrink-0 text-right text-xs tabular-nums ${
                      age >= 3 && ACTIONABLE_STATUSES.includes(row.status as ReturnStatus)
                        ? "text-gold-deep"
                        : "text-ash"
                    }`}
                  >
                    {age === 0 ? "today" : `${age}d`}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

import { createClient } from "@/lib/supabase/server";
import { formatPrice } from "@/lib/products";
import { standingCents, tierFor } from "@/lib/rewards";

type MemberRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  points: number;
  lifetime_spend_cents: number;
  welcome_discount_used_at: string | null;
  purchased_tier: string | null;
  created_at: string;
};

const PAGE_SIZE = 100;

export default async function AdminMembers() {
  const supabase = await createClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, email, full_name, points, lifetime_spend_cents, welcome_discount_used_at, purchased_tier, created_at",
    )
    .order("lifetime_spend_cents", { ascending: false })
    .limit(PAGE_SIZE);

  const rows = (data ?? []) as MemberRow[];

  return (
    <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8">
      <h1 className="font-display text-4xl font-light text-graphite">Members</h1>
      <p className="mt-2 text-sm text-ash">Highest lifetime spend first.</p>

      <div className="rule-gold mt-8" />

      {error ? (
        <p className="py-12 text-sm text-gold-deep">Couldn&apos;t load members.</p>
      ) : rows.length === 0 ? (
        <p className="py-12 text-sm text-ash">No members yet.</p>
      ) : (
        <ul className="mt-8 divide-y divide-parchment border-y border-parchment">
          {rows.map((member) => {
            // Bought tiers count the same as earned ones, so read standing.
            const bought = member.purchased_tier;
            const tier = tierFor(
              standingCents(member.lifetime_spend_cents, bought),
            );

            return (
              <li
                key={member.id}
                className="flex flex-wrap items-center gap-x-6 gap-y-2 py-5"
              >
                <span className="min-w-0 flex-1 truncate text-sm text-graphite">
                  {member.full_name?.trim() || member.email || "—"}
                  {member.full_name?.trim() && (
                    <span className="text-ash"> · {member.email}</span>
                  )}
                </span>

                <span
                  className="w-20 shrink-0 text-xs text-gold-deep"
                  title={
                    bought === tier.name
                      ? `${tier.name} was bought, not earned`
                      : undefined
                  }
                >
                  {tier.name}
                  {bought === tier.name && (
                    <span className="text-ash"> · paid</span>
                  )}
                </span>

                <span className="w-24 shrink-0 text-right text-xs tabular-nums text-ash">
                  {member.points.toLocaleString()} pts
                </span>

                <span className="w-24 shrink-0 text-right text-sm tabular-nums text-graphite">
                  {formatPrice(member.lifetime_spend_cents ?? 0)}
                </span>

                <span
                  className="w-24 shrink-0 text-right text-xs text-ash"
                  title="Whether the 20% welcome discount has been used"
                >
                  {member.welcome_discount_used_at ? "used 20%" : "20% unused"}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-10 text-xs leading-relaxed text-ash">
        Read-only. Points and tier are derived from orders and adjusted by the
        Stripe webhook, so there is deliberately no way to edit them by hand —
        every balance stays explainable from the ledger.
      </p>
    </div>
  );
}

import { BroadcastComposer } from "@/components/BroadcastComposer";
import { NotConfigured } from "@/components/NotConfigured";
import { createClient } from "@/lib/supabase/server";
import { isSmsConfigured } from "@/lib/sms";

export const dynamic = "force-dynamic";

type BroadcastRow = {
  id: string;
  body: string;
  audience: string;
  created_at: string;
  completed_at: string | null;
  recipient_count: number;
};

const AUDIENCE_LABEL: Record<string, string> = {
  all: "Every member",
  paid: "Adept & Oracle",
};

export default async function AdminDrops() {
  const supabase = await createClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("sms_broadcasts")
    .select("id, body, audience, created_at, completed_at, recipient_count")
    .order("created_at", { ascending: false })
    .limit(25);

  // 42P01 = undefined_table: the SMS tables aren't there yet.
  if (error?.code === "42P01") {
    return (
      <NotConfigured
        title="The database needs updating"
        body="Drop alerts need the SMS tables. Open the Supabase SQL editor and re-run supabase/schema.sql — it's idempotent, so running it again is safe."
      />
    );
  }

  const rows = (data ?? []) as BroadcastRow[];

  return (
    <div className="mx-auto max-w-3xl px-5 py-14 sm:px-8">
      <h1 className="font-display text-4xl font-light text-graphite">Drops</h1>
      <p className="mt-2 text-sm text-ash">
        Text every member when something lands, or just Adept and Oracle for the
        early look.
      </p>

      <div className="rule-gold mt-8" />

      {!isSmsConfigured() ? (
        <p className="mt-10 border-l border-clay p-5 text-sm leading-relaxed text-graphite">
          Twilio isn&apos;t connected yet. Add <code>TWILIO_ACCOUNT_SID</code>,{" "}
          <code>TWILIO_AUTH_TOKEN</code>, <code>TWILIO_MESSAGING_SERVICE_SID</code>{" "}
          and <code>TWILIO_VERIFY_SERVICE_SID</code> to your environment. Members
          can&apos;t verify a number until you do, so this list will stay empty.
        </p>
      ) : (
        <div className="mt-10">
          <BroadcastComposer />
        </div>
      )}

      {/* ------------------------------------------------------------- History */}
      <h2 className="mt-16 font-display text-2xl font-light text-graphite">
        Already sent
      </h2>

      {rows.length === 0 ? (
        <p className="mt-6 text-sm text-ash">Nothing yet.</p>
      ) : (
        <ul className="mt-6 divide-y divide-parchment border-y border-parchment">
          {rows.map((row) => (
            <li key={row.id} className="py-5">
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <span className="text-xs text-ash">
                  {new Date(row.created_at).toLocaleDateString("en-US", {
                    dateStyle: "medium",
                  })}
                </span>
                <span className="eyebrow text-clay">
                  {AUDIENCE_LABEL[row.audience] ?? row.audience}
                </span>
                <span className="ml-auto text-xs tabular-nums text-slate">
                  {row.recipient_count}{" "}
                  {row.recipient_count === 1 ? "recipient" : "recipients"}
                </span>
                {!row.completed_at && (
                  <span
                    className="text-xs text-gold-deep"
                    title="Some recipients are still queued — open the composer and send again to finish."
                  >
                    incomplete
                  </span>
                )}
              </div>
              <p className="mt-2 text-sm leading-relaxed text-slate">{row.body}</p>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-10 text-xs leading-relaxed text-ash">
        Members opt in themselves and can text STOP at any time — the carrier
        honours it immediately and the webhook records it here, so an opted-out
        number is never queued again. Nobody can be added to this list from the
        studio.
      </p>
    </div>
  );
}

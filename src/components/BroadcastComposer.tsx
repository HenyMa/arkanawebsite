"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./Button";
import { messageCost } from "@/lib/sms-format";

type Audience = "all" | "paid";

const AUDIENCES: { id: Audience; label: string; note: string }[] = [
  {
    id: "all",
    label: "Every member",
    note: "Anyone who has verified a number and not opted out.",
  },
  {
    id: "paid",
    label: "Adept & Oracle",
    note: "The exclusive look. Bought or earned the tier — both count.",
  },
];

type Progress = { sent: number; failed: number; remaining: number };

/**
 * Writes and sends a drop alert.
 *
 * The send loop lives here rather than in the route because it is inherently
 * multi-request: the API sends one batch per call so it fits inside a
 * serverless invocation, and something has to keep calling it. Doing that from
 * the browser also means the progress bar is real rather than estimated.
 */
export function BroadcastComposer() {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<Audience>("all");
  const [reach, setReach] = useState<number | null>(null);
  const [needsSchema, setNeedsSchema] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Progress | null>(null);

  const cost = messageCost(body);

  // Recount whenever the audience changes, so the number next to the button is
  // always the one that will actually be used.
  useEffect(() => {
    let cancelled = false;
    setReach(null);

    fetch(`/api/admin/sms?audience=${audience}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        setReach(typeof data.count === "number" ? data.count : null);
        setNeedsSchema(Boolean(data.needsSchema));
      })
      .catch(() => {
        if (!cancelled) setReach(null);
      });

    return () => {
      cancelled = true;
    };
  }, [audience]);

  async function send() {
    setBusy(true);
    setError(null);
    setDone(null);

    try {
      const res = await fetch("/api/admin/sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: body.trim(), audience }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "That didn't work.");
        return;
      }

      const total: number = data.recipients ?? 0;
      if (total === 0) {
        setError("Nobody matches that audience yet — nothing was sent.");
        return;
      }

      // Work through the queue a batch at a time until the API says it's empty.
      const totals: Progress = { sent: 0, failed: 0, remaining: total };
      setProgress({ ...totals });

      while (totals.remaining > 0) {
        const batchRes = await fetch("/api/admin/sms/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ broadcastId: data.broadcastId }),
        });
        const batch = await batchRes.json();

        if (!batchRes.ok) {
          setError(
            `${batch.error ?? "Sending stopped."} ${totals.sent} of ${total} went out — reopen this drop to finish the rest.`,
          );
          return;
        }

        /*
         * A batch that neither sent nor failed anything has made no progress,
         * and calling again would do the same thing forever — the queue can't
         * drain if, say, another tab is holding the same rows. Stop and say so
         * rather than spinning.
         */
        if ((batch.sent ?? 0) === 0 && (batch.failed ?? 0) === 0) {
          setError(
            `Sending stalled with ${batch.remaining ?? 0} left. ${totals.sent} of ${total} went out — check nothing else is sending this drop, then send again to finish.`,
          );
          return;
        }

        totals.sent += batch.sent ?? 0;
        totals.failed += batch.failed ?? 0;
        totals.remaining = batch.remaining ?? 0;
        setProgress({ ...totals });
      }

      setDone({ ...totals });
      setBody("");
      setConfirming(false);
      router.refresh();
    } catch {
      setError("Couldn't reach the server. Some messages may already have gone out.");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  const audienceLabel = AUDIENCES.find((a) => a.id === audience)!.label.toLowerCase();
  const canSend = body.trim().length > 0 && (reach ?? 0) > 0 && !busy;

  return (
    <div>
      <label htmlFor="broadcast-body" className="eyebrow text-clay">
        Message
      </label>
      <textarea
        id="broadcast-body"
        value={body}
        onChange={(e) => {
          setBody(e.target.value);
          setConfirming(false);
        }}
        rows={4}
        placeholder="The Monolith Hoodie is live. Yours before anyone else: arkana.com/shop"
        className="mt-3 w-full border border-parchment bg-bone px-4 py-3 text-sm leading-relaxed text-graphite placeholder:text-mist focus:border-graphite focus:outline-none"
      />

      <div className="mt-2 flex flex-wrap items-center gap-x-4 text-xs text-ash">
        <span className="tabular-nums">
          {cost.characters} characters ·{" "}
          <span className={cost.segments > 3 ? "text-gold-deep" : undefined}>
            {cost.segments} segment{cost.segments === 1 ? "" : "s"}
          </span>
        </span>
        {cost.encoding === "UCS-2" && (
          <span className="text-gold-deep">
            An emoji or curly quote forced UCS-2 — 70 characters a segment
            instead of 160.
          </span>
        )}
      </div>

      <p className="mt-4 text-xs leading-relaxed text-ash">
        Twilio appends opt-out wording to the first message a member receives.
        Don&apos;t write your own &ldquo;reply STOP&rdquo; — it doubles up and
        eats a segment.
      </p>

      {/* ------------------------------------------------------------ Audience */}
      <fieldset className="mt-8">
        <legend className="eyebrow text-clay">Audience</legend>
        <div className="mt-3 grid gap-px bg-parchment sm:grid-cols-2">
          {AUDIENCES.map((a) => (
            <label
              key={a.id}
              className={`cursor-pointer bg-linen/60 p-5 transition-colors ${
                audience === a.id ? "bg-linen" : "hover:bg-linen"
              }`}
            >
              <span className="flex items-center gap-3">
                <input
                  type="radio"
                  name="audience"
                  value={a.id}
                  checked={audience === a.id}
                  onChange={() => {
                    setAudience(a.id);
                    setConfirming(false);
                  }}
                  className="accent-gold-deep"
                />
                <span className="text-sm text-graphite">{a.label}</span>
              </span>
              <span className="mt-2 block pl-7 text-xs leading-relaxed text-ash">
                {a.note}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* --------------------------------------------------------------- Reach */}
      <p className="mt-6 text-sm text-slate">
        {needsSchema ? (
          <span className="text-gold-deep">
            The database is missing the SMS columns — re-run
            supabase/schema.sql.
          </span>
        ) : reach === null ? (
          "Counting…"
        ) : (
          <>
            <span className="tabular-nums text-graphite">{reach}</span>{" "}
            {reach === 1 ? "member" : "members"} will get this
            {cost.segments > 1 && reach > 0 && (
              <span className="text-ash">
                {" "}
                · {reach * cost.segments} segments billed
              </span>
            )}
          </>
        )}
      </p>

      {/* ---------------------------------------------------------------- Send */}
      <div className="mt-6">
        {progress ? (
          <div>
            <p className="text-sm text-slate tabular-nums">
              Sending… {progress.sent} sent
              {progress.failed > 0 && `, ${progress.failed} failed`},{" "}
              {progress.remaining} to go
            </p>
            <div className="mt-3 h-px w-full bg-parchment">
              <div
                className="h-px bg-gold transition-all duration-300"
                style={{
                  width: `${
                    (progress.sent + progress.failed) === 0
                      ? 0
                      : ((progress.sent + progress.failed) /
                          (progress.sent + progress.failed + progress.remaining)) *
                        100
                  }%`,
                }}
              />
            </div>
          </div>
        ) : confirming ? (
          <div className="border border-gold bg-linen/60 p-5">
            <p className="text-sm leading-relaxed text-graphite">
              Send to <span className="tabular-nums">{reach}</span>{" "}
              {audienceLabel}? This can&apos;t be recalled.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button onClick={send} disabled={!canSend}>
                Yes — send it
              </Button>
              <Button onClick={() => setConfirming(false)} variant="outline">
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button onClick={() => setConfirming(true)} disabled={!canSend}>
            Review and send
          </Button>
        )}
      </div>

      {done && (
        <p className="mt-5 border border-gold bg-linen/60 px-5 py-4 text-sm leading-relaxed text-graphite">
          Sent to <span className="tabular-nums">{done.sent}</span>{" "}
          {done.sent === 1 ? "member" : "members"}
          {done.failed > 0 && (
            <span className="text-gold-deep">
              {" "}
              · {done.failed} failed, listed below
            </span>
          )}
          .
        </p>
      )}

      {error && (
        <p className="mt-5 border-l border-clay p-4 text-xs leading-relaxed text-graphite">
          {error}
        </p>
      )}
    </div>
  );
}

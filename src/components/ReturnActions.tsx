"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "./Button";
import {
  ADMIN_TRANSITIONS,
  TRANSITION_LABEL,
  type ReturnStatus,
} from "@/lib/returns";

/**
 * Status controls for one return.
 *
 * Buttons are drawn from the same transition map the API validates against, so
 * the UI can never offer a move the server will refuse.
 */
export function ReturnActions({
  returnId,
  status,
}: {
  returnId: string;
  status: string;
}) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const options = ADMIN_TRANSITIONS[status as ReturnStatus] ?? [];

  async function move(next: ReturnStatus) {
    // The API enforces this too; catching it here saves a round trip and
    // explains itself next to the box the note goes in.
    if (next === "rejected" && !note.trim()) {
      setError("Add a note first — the member is shown this.");
      return;
    }

    setBusy(next);
    setError(null);
    try {
      const res = await fetch("/api/admin/returns", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          returnId,
          status: next,
          note: note.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "That didn't work.");
        return;
      }

      setNote("");
      router.refresh();
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setBusy(null);
    }
  }

  if (options.length === 0) {
    return (
      <p className="text-sm leading-relaxed text-ash">
        {status === "received"
          ? "Checked in and waiting on the refund. Issue it in Stripe — the webhook closes this out automatically."
          : "This return is closed. Nothing further to do."}
      </p>
    );
  }

  return (
    <div>
      <label htmlFor="admin-note" className="eyebrow text-clay">
        Note <span className="text-ash">(shown to the member)</span>
      </label>
      <textarea
        id="admin-note"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={3}
        maxLength={1000}
        placeholder="Optional — required when rejecting."
        className="mt-3 w-full border border-sand bg-bone px-4 py-3 text-sm text-graphite placeholder:text-mist focus:border-gold focus:outline-none"
      />

      <div className="mt-4 flex flex-wrap gap-3">
        {options.map((next) => (
          <Button
            key={next}
            onClick={() => move(next)}
            disabled={busy !== null}
            variant={next === "rejected" ? "outline" : "primary"}
          >
            {busy === next ? "Saving…" : TRANSITION_LABEL[next]}
          </Button>
        ))}
      </div>

      {error && (
        <p className="mt-4 border border-tan bg-parchment/60 p-3 text-xs leading-relaxed text-graphite">
          {error}
        </p>
      )}
    </div>
  );
}

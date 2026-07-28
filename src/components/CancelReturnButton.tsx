"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Cancels a return that hasn't been actioned yet.
 *
 * Two-step rather than a browser confirm() — the first click arms it, the
 * second commits — so a misclick costs nothing and nothing blocks the page.
 */
export function CancelReturnButton({ returnId }: { returnId: string }) {
  const router = useRouter();
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cancel() {
    if (!armed) {
      setArmed(true);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/returns", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ returnId, action: "cancel" }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't cancel that return.");
        setArmed(false);
        return;
      }

      router.refresh();
    } catch {
      setError("Couldn't reach the returns service.");
      setArmed(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="text-right">
      <button
        type="button"
        onClick={cancel}
        onBlur={() => setArmed(false)}
        disabled={busy}
        className="text-xs text-ash underline underline-offset-4 hover:text-slate disabled:opacity-50"
      >
        {busy
          ? "Cancelling…"
          : armed
            ? "Tap again to confirm"
            : "Cancel this return"}
      </button>
      {error && <p className="mt-2 text-xs text-gold-deep">{error}</p>}
    </div>
  );
}

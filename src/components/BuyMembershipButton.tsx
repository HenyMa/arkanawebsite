"use client";

import { useState } from "react";
import { Button } from "./Button";
import { useSignedIn } from "@/lib/useSignedIn";
import { formatPrice } from "@/lib/products";
import { MEMBERSHIP_PRICE_CENTS, type PurchasableTier } from "@/lib/rewards";

/**
 * Buys a tier outright.
 *
 * A membership belongs to an account, so a signed-out visitor is sent to sign
 * up first and comes back here. The label doesn't wait on the auth check —
 * it reads the same either way, and a click before the check resolves still
 * lands correctly, because `signedIn` starts false and so routes via sign-up.
 */
export function BuyMembershipButton({ tier }: { tier: PurchasableTier }) {
  const { signedIn } = useSignedIn();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function buy() {
    if (!signedIn) {
      window.location.href = `/signup?next=${encodeURIComponent("/rewards#memberships")}`;
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/membership/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Could not reach the checkout service. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <Button
        onClick={buy}
        disabled={busy}
        variant="outline"
        className="w-full"
      >
        {busy
          ? "One moment…"
          : `Become ${tier} — ${formatPrice(MEMBERSHIP_PRICE_CENTS[tier])}`}
      </Button>
      {error && <p className="mt-3 text-xs text-gold-deep">{error}</p>}
    </div>
  );
}

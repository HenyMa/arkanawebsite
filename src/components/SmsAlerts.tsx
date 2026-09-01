"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./Button";
import { formatPhone } from "@/lib/sms-format";

const INPUT =
  "w-full border border-parchment bg-bone px-4 py-3 text-sm text-graphite placeholder:text-mist focus:border-graphite focus:outline-none";

/**
 * Where this instance is rendered. Recorded verbatim in the consent log, which
 * is the record you would produce if an opt-in were ever challenged — so it has
 * to say where the person actually was, not where the component lives.
 */
type Source = "account" | "signup" | "checkout";

type Props = {
  source: Source;
  /** E.164 number already on the profile, if any. */
  phone: string | null;
  subscribed: boolean;
  /** True for Adept/Oracle — they get the exclusive look as well as drops. */
  tierMember: boolean;
  /** Draws the panel as an invitation rather than a settings row. */
  highlight?: boolean;
};

/**
 * Drop-alert opt-in: number, one-time code, done.
 *
 * The same component serves the account page, the post-signup welcome, and the
 * order confirmation, because the consent it collects has to be identical in
 * all three — a shortcut on one surface would make the record uneven and the
 * evidence weaker exactly where it matters.
 */
export function SmsAlerts({
  source,
  phone,
  subscribed,
  tierMember,
  highlight = false,
}: Props) {
  const router = useRouter();
  const [step, setStep] = useState<"idle" | "code">("idle");
  const [input, setInput] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode() {
    if (!consent) {
      setError("Tick the box to confirm you'd like the messages.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/sms/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: input }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "That didn't work.");
        return;
      }
      setPending(data.phone);
      setStep("code");
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/sms/verify/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: pending, code, source }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "That didn't work.");
        return;
      }
      setStep("idle");
      setCode("");
      setInput("");
      router.refresh();
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setBusy(false);
    }
  }

  async function unsubscribe() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/sms/unsubscribe", { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "That didn't work.");
        return;
      }
      router.refresh();
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setBusy(false);
    }
  }

  const frame = highlight
    ? "border border-gold bg-linen/60"
    : "border border-parchment bg-linen/60";

  // ------------------------------------------------------------- Subscribed
  if (subscribed) {
    return (
      <div className={`${frame} px-6 py-5`}>
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
          <div>
            <p className="eyebrow text-clay">Drop alerts</p>
            <p className="mt-2 text-sm text-graphite">
              On for{" "}
              <span className="tabular-nums">{formatPhone(phone)}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={unsubscribe}
            disabled={busy}
            className="link-underline text-xs text-ash transition-colors hover:text-graphite disabled:opacity-50"
          >
            {busy ? "One moment…" : "Turn off"}
          </button>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-ash">
          {tierMember
            ? "You'll hear about every drop, plus the exclusive look Adept and Oracle members get first."
            : "You'll hear about every drop as it lands."}{" "}
          Reply STOP to any message to turn these off from your phone.
        </p>
        {error && (
          <p className="mt-3 border-l border-clay p-3 text-xs leading-relaxed text-graphite">
            {error}
          </p>
        )}
      </div>
    );
  }

  // ------------------------------------------------------------ Enter a code
  if (step === "code") {
    return (
      <div className={`${frame} px-6 py-5`}>
        <p className="eyebrow text-clay">Check your phone</p>
        <p className="mt-2 text-sm leading-relaxed text-slate">
          We sent a code to{" "}
          <span className="text-graphite tabular-nums">{formatPhone(pending)}</span>.
        </p>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div className="w-40">
            <label htmlFor="sms-code" className="sr-only">
              Verification code
            </label>
            <input
              id="sms-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={10}
              placeholder="123456"
              className={`${INPUT} tabular-nums`}
            />
          </div>
          <Button onClick={confirm} disabled={busy || code.trim().length < 4}>
            {busy ? "Checking…" : "Confirm"}
          </Button>
          <button
            type="button"
            onClick={() => {
              setStep("idle");
              setCode("");
              setError(null);
            }}
            className="link-underline pb-3 text-xs text-ash transition-colors hover:text-graphite"
          >
            Use a different number
          </button>
        </div>

        {error && (
          <p className="mt-3 border-l border-clay p-3 text-xs leading-relaxed text-graphite">
            {error}
          </p>
        )}
      </div>
    );
  }

  // ----------------------------------------------------------------- Opt in
  return (
    <div className={`${frame} px-6 py-5`}>
      <p className="eyebrow text-clay">Drop alerts</p>
      <p className="mt-2 text-sm leading-relaxed text-slate">
        {tierMember
          ? "A text when a drop lands — and the exclusive look before it's announced, because you're a tier member."
          : "A text when a drop lands. No more than that."}
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div className="min-w-[13rem] flex-1">
          <label htmlFor={`sms-phone-${source}`} className="sr-only">
            Mobile number
          </label>
          <input
            id={`sms-phone-${source}`}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            type="tel"
            autoComplete="tel"
            placeholder="(415) 555-2671"
            className={INPUT}
          />
        </div>
        <Button onClick={sendCode} disabled={busy || input.trim().length < 7}>
          {busy ? "Sending…" : "Send me a code"}
        </Button>
      </div>

      <label className="mt-4 flex cursor-pointer items-start gap-3 text-xs leading-relaxed text-ash">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => {
            setConsent(e.target.checked);
            setError(null);
          }}
          className="mt-0.5 accent-gold-deep"
        />
        <span>
          Text me about drops at this number. Message and data rates may apply;
          message frequency varies. Reply STOP to cancel, HELP for help.
          Consent isn&apos;t a condition of purchase.
        </span>
      </label>

      <p className="mt-3 text-xs leading-relaxed text-ash">
        Outside the US? Include your country code.
      </p>

      {error && (
        <p className="mt-3 border-l border-clay p-3 text-xs leading-relaxed text-graphite">
          {error}
        </p>
      )}
    </div>
  );
}

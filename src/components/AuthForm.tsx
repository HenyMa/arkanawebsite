"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "./Button";
import { createClient } from "@/lib/supabase/client";
import { SIGNUP_BONUS } from "@/lib/rewards";

type Mode = "login" | "signup";

const INPUT =
  "w-full border border-parchment bg-bone px-4 py-4 text-sm text-graphite placeholder:text-mist focus:border-graphite focus:outline-none";

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  /*
   * New members land on /account with ?welcome=1, which is what surfaces the
   * drop-alerts prompt. It rides on `next` so it survives the email
   * confirmation round trip — the callback redirects to whatever this is.
   */
  const next =
    searchParams.get("next") ??
    (mode === "signup" ? "/account?welcome=1" : "/account");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);

  const isSignup = mode === "signup";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const supabase = createClient();
    if (!supabase) {
      setError(
        "Accounts aren't connected yet. Add your Supabase keys to .env.local to enable sign-in.",
      );
      return;
    }

    setBusy(true);
    try {
      if (isSignup) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
            emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
          },
        });
        if (error) throw error;

        // With email confirmation enabled (the Supabase default) there is no
        // session yet — the member has to click the link first.
        if (!data.session) {
          setCheckEmail(true);
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }

      router.push(next);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (checkEmail) {
    return (
      <div className="text-center">
        <h1 className="section-title text-graphite">Confirm your email</h1>
        <p className="mt-7 text-sm leading-relaxed text-slate">
          We&apos;ve sent a link to <span className="text-graphite">{email}</span>.
          Click it to finish joining the Circle — your {SIGNUP_BONUS} points are
          waiting.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="text-center">
        <h1 className="section-title text-graphite">
          {isSignup ? "Join the Circle" : "Sign in"}
        </h1>
        <p className="mt-7 text-sm leading-relaxed text-slate">
          {isSignup
            ? `${SIGNUP_BONUS} points the moment you join, and early access to every drop.`
            : "Your points, tier, and order history."}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-10 space-y-4">
        {isSignup && (
          <div>
            <label htmlFor="fullName" className="eyebrow text-clay">
              Name
            </label>
            <input
              id="fullName"
              type="text"
              autoComplete="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className={`${INPUT} mt-2`}
              placeholder="Your name"
            />
          </div>
        )}

        <div>
          <label htmlFor="email" className="eyebrow text-clay">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={`${INPUT} mt-2`}
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label htmlFor="password" className="eyebrow text-clay">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={8}
            autoComplete={isSignup ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={`${INPUT} mt-2`}
            placeholder={isSignup ? "At least 8 characters" : "••••••••"}
          />
        </div>

        {error && (
          <p className="border-l border-clay p-3 text-xs leading-relaxed text-graphite">
            {error}
          </p>
        )}

        <Button type="submit" disabled={busy} className="w-full">
          {busy ? "One moment…" : isSignup ? "Create account" : "Sign in"}
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-slate">
        {isSignup ? "Already a member? " : "No account yet? "}
        <Link
          href={isSignup ? "/login" : "/signup"}
          className="link-underline text-gold-deep"
        >
          {isSignup ? "Sign in" : "Join the Circle"}
        </Link>
      </p>
    </div>
  );
}

import type { Metadata } from "next";
import { ButtonLink } from "@/components/Button";
import { ClearCart } from "@/components/ClearCart";
import { Mark } from "@/components/Logo";
import { getUser } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Order confirmed",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

export default async function SuccessPage() {
  const user = await getUser();

  return (
    <div className="mx-auto max-w-lg px-5 py-32 text-center sm:px-8">
      <ClearCart />

      <Mark className="animate-rise mx-auto h-12 w-12 text-gold" />
      <h1 className="animate-rise mt-8 font-display text-4xl font-light text-graphite [animation-delay:100ms] sm:text-5xl">
        Thank you.
      </h1>
      <p className="animate-rise mt-5 text-[0.95rem] leading-relaxed text-slate [animation-delay:180ms]">
        Your order is confirmed and a receipt is on its way to your inbox. We
        pack Monday through Thursday, and you&apos;ll get tracking as soon as it
        leaves us.
      </p>

      <div className="animate-rise mt-11 flex flex-wrap justify-center gap-4 [animation-delay:260ms]">
        {user ? (
          <ButtonLink href="/account">View order & points</ButtonLink>
        ) : (
          <ButtonLink href="/signup">Join the Circle</ButtonLink>
        )}
        <ButtonLink href="/hoodies" variant="outline">
          Continue shopping
        </ButtonLink>
      </div>

      {!user && (
        <p className="mt-8 text-xs leading-relaxed text-ash">
          Create an account with the same email and we&apos;ll start your points
          balance with a joining bonus.
        </p>
      )}
    </div>
  );
}

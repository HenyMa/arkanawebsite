import type { Metadata } from "next";
import { ButtonLink } from "@/components/Button";
import { ClearCart } from "@/components/ClearCart";
import { SmsAlerts } from "@/components/SmsAlerts";
import { createClient, getUser } from "@/lib/supabase/server";
import { isPurchasableTier, isTierMember, standingCents } from "@/lib/rewards";

type SmsState = {
  phone: string | null;
  subscribed: boolean;
  tierMember: boolean;
};

/**
 * Reads what the drop-alerts panel needs, or null if it can't be shown.
 *
 * Every failure returns null rather than throwing: this is the page someone
 * sees straight after paying, and an unmigrated column or a slow query must
 * never be what stands between them and their order confirmation.
 */
async function loadSmsState(userId: string): Promise<SmsState | null> {
  const supabase = await createClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select(
      "phone, phone_verified_at, sms_consent_at, sms_opt_out_at, lifetime_spend_cents, purchased_tier",
    )
    .eq("id", userId)
    .single();

  if (error || !data) return null;

  return {
    phone: data.phone ?? null,
    subscribed: Boolean(
      data.phone && data.phone_verified_at && data.sms_consent_at && !data.sms_opt_out_at,
    ),
    tierMember: isTierMember(
      standingCents(data.lifetime_spend_cents, data.purchased_tier),
    ),
  };
}

export const metadata: Metadata = {
  title: "Order confirmed",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ membership?: string }>;
};

export default async function SuccessPage({ searchParams }: Props) {
  const user = await getUser();
  const membership = (await searchParams).membership;
  const sms = user ? await loadSmsState(user.id) : null;

  /*
   * Memberships and garments both land here, but only one of them empties the
   * cart — someone who buys Oracle mid-shop should still find their basket
   * where they left it.
   */
  const tier = isPurchasableTier(membership) ? membership : null;

  if (tier) {
    return (
      <div className="mx-auto max-w-lg px-5 py-40 text-center sm:px-10">
        <h1 className="display-line-sm animate-rise text-graphite">
          Welcome to {tier}.
        </h1>
        <p className="animate-rise mt-9 text-sm leading-relaxed text-slate [animation-delay:180ms]">
          Your membership is confirmed and a receipt is on its way. Every perk —
          the money off each order, the longer return window, the early access —
          is live on your account now. It never expires and there is nothing to
          renew.
        </p>

        <div className="animate-rise mt-12 flex flex-wrap justify-center gap-10 [animation-delay:260ms]">
          <ButtonLink href="/account" variant="link">
            View your standing
          </ButtonLink>
          <ButtonLink href="/shop" variant="link">
            Shop the collection
          </ButtonLink>
        </div>

        {sms && !sms.subscribed && (
          <div className="mt-12 text-left">
            <SmsAlerts
              source="checkout"
              phone={sms.phone}
              subscribed={false}
              tierMember
            />
          </div>
        )}

        <p className="mt-8 text-xs leading-relaxed text-ash">
          If your tier hasn&apos;t updated yet, give it a moment and refresh —
          it&apos;s applied as soon as the payment settles.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-5 py-40 text-center sm:px-10">
      <ClearCart />

      <h1 className="display-line-sm animate-rise text-graphite">Thank you.</h1>
      <p className="animate-rise mt-9 text-sm leading-relaxed text-slate [animation-delay:180ms]">
        Your order is confirmed and a receipt is on its way to your inbox. We
        pack Monday through Thursday, and you&apos;ll get tracking as soon as it
        leaves us.
      </p>

      <div className="animate-rise mt-12 flex flex-wrap justify-center gap-10 [animation-delay:260ms]">
        {user ? (
          <ButtonLink href="/account" variant="link">
            View order & points
          </ButtonLink>
        ) : (
          <ButtonLink href="/signup" variant="link">
            Join the Circle
          </ButtonLink>
        )}
        <ButtonLink href="/shop" variant="outline">
          Continue shopping
        </ButtonLink>
      </div>

      {/*
        Only offered to someone who isn't already subscribed. The number Stripe
        collected for delivery is deliberately not prefilled or reused: giving a
        number so a parcel can arrive is not agreement to be marketed to, so the
        opt-in starts empty and goes through the same verification as anywhere
        else.
      */}
      {sms && !sms.subscribed && (
        <div className="mt-12 text-left">
          <SmsAlerts
            source="checkout"
            phone={sms.phone}
            subscribed={false}
            tierMember={sms.tierMember}
          />
        </div>
      )}

      {!user && (
        <p className="mt-8 text-xs leading-relaxed text-ash">
          Create an account with the same email and we&apos;ll start your points
          balance with a joining bonus.
        </p>
      )}
    </div>
  );
}

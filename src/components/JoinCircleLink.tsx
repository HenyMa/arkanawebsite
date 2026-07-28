"use client";

import { ButtonLink, type Variant } from "./Button";
import { useSignedIn } from "@/lib/useSignedIn";

/**
 * The "Join the Circle" call to action.
 *
 * Members are already in the Circle, so they get a link to their account
 * instead of being sent back through sign-up. Until the auth check resolves it
 * renders the signed-out label — a click in that window still lands correctly,
 * because middleware bounces signed-in members off /signup.
 */
export function JoinCircleLink({
  children,
  memberLabel = "Your standing",
  variant = "primary",
  className = "",
}: {
  children: React.ReactNode;
  memberLabel?: React.ReactNode;
  variant?: Variant;
  className?: string;
}) {
  const { signedIn } = useSignedIn();

  return (
    <ButtonLink
      href={signedIn ? "/account" : "/signup"}
      variant={variant}
      className={className}
    >
      {signedIn ? memberLabel : children}
    </ButtonLink>
  );
}

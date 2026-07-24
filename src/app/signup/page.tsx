import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForm } from "@/components/AuthForm";

export const metadata: Metadata = {
  title: "Join the Circle",
  description:
    "Create an Arkana account for points on every order, free shipping, and early access to limited runs.",
};

export default function SignupPage() {
  return (
    <div className="mx-auto max-w-sm px-5 py-24 sm:px-8">
      <Suspense fallback={null}>
        <AuthForm mode="signup" />
      </Suspense>
    </div>
  );
}

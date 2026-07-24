import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForm } from "@/components/AuthForm";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your Arkana account.",
};

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-sm px-5 py-24 sm:px-8">
      {/* AuthForm reads ?next= from the URL, so it needs a Suspense boundary. */}
      <Suspense fallback={null}>
        <AuthForm mode="login" />
      </Suspense>
    </div>
  );
}

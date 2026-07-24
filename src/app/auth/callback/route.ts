import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Lands the email-confirmation and password-reset links.
 * Exchanges the one-time code for a session, then forwards the member on.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/account";

  if (code) {
    const supabase = await createClient();
    if (supabase) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        // Only allow same-site redirects — `next` comes from the URL.
        const target = next.startsWith("/") ? next : "/account";
        return NextResponse.redirect(`${origin}${target}`);
      }
    }
  }

  return NextResponse.redirect(`${origin}/login?error=link_expired`);
}

import { createServerClient, type CookieMethodsServer } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  SUPABASE_ANON_KEY,
  SUPABASE_URL,
  isSupabaseConfigured,
} from "@/lib/supabase/config";

/** Routes that require a signed-in member. */
const PROTECTED = ["/account"];

/** Routes that only make sense signed out. */
const AUTH_PAGES = ["/login", "/signup"];

/**
 * Where to send a member who lands on an auth page while already signed in.
 * `?next=` is honoured, but only for same-site paths — never an absolute URL
 * or a protocol-relative one, which would be an open redirect.
 */
function destinationFor(nextParam: string | null): string {
  if (
    nextParam &&
    nextParam.startsWith("/") &&
    !nextParam.startsWith("//") &&
    !AUTH_PAGES.some((p) => nextParam.split("?")[0] === p)
  ) {
    return nextParam;
  }
  return "/account";
}

export async function middleware(request: NextRequest) {
  // No Supabase yet? Let every request through untouched.
  if (!isSupabaseConfigured()) return NextResponse.next();

  let response = NextResponse.next({ request });

  const cookieMethods: CookieMethodsServer = {
    getAll() {
      return request.cookies.getAll();
    },
    setAll(cookiesToSet) {
      cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
      response = NextResponse.next({ request });
      cookiesToSet.forEach(({ name, value, options }) =>
        response.cookies.set(name, value, options),
      );
    },
  };

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: cookieMethods,
  });

  // Refreshes the auth token and writes the rotated cookies onto `response`.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  if (!user && PROTECTED.some((p) => pathname.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Already a member — don't ask them to sign in or join again.
  if (user && AUTH_PAGES.includes(pathname)) {
    return NextResponse.redirect(
      new URL(destinationFor(request.nextUrl.searchParams.get("next")), request.url),
    );
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Everything except static assets and image files — the session only needs
     * refreshing on requests that can render or read auth state.
     */
    "/((?!_next/static|_next/image|favicon.ico|products/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

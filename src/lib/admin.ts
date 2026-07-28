import { cache } from "react";
import { notFound } from "next/navigation";
import { createClient } from "./supabase/server";

/**
 * Admin authorisation.
 *
 * Membership lives in its own `admins` table with no member-writable policy —
 * see supabase/schema.sql for why it deliberately isn't a column on `profiles`.
 *
 * Three things guard the admin area, and each would be sufficient on its own:
 *
 *   1. `/admin/layout.tsx` calls `requireAdmin()` before rendering anything.
 *   2. Every admin API route calls it again — a layout does not protect a POST.
 *   3. Row-level security only exposes other people's rows to `is_admin()`.
 *
 * The third is the one that actually matters: even if a route check were
 * forgotten, the database would still return nothing.
 */

export type AdminUser = {
  id: string;
  email: string | null;
};

/**
 * The signed-in admin, or null.
 *
 * Wrapped in React's `cache` so the layout, the page, and any component that
 * asks all share one lookup per request.
 */
export const getAdmin = cache(async (): Promise<AdminUser | null> => {
  const supabase = await createClient();
  if (!supabase) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  // A missing table means the schema hasn't been re-run. Treat that as "not an
  // admin" rather than crashing — the storefront must stay up either way.
  if (error || !data) return null;

  return { id: user.id, email: user.email ?? null };
});

/**
 * Admin or bust.
 *
 * 404s rather than redirecting to a sign-in page: someone who isn't an admin
 * has no business learning that /admin exists.
 */
export async function requireAdmin(): Promise<AdminUser> {
  const admin = await getAdmin();
  if (!admin) notFound();
  return admin;
}

/** Cheap boolean for UI that only needs to show or hide a link. */
export async function isAdmin(): Promise<boolean> {
  return (await getAdmin()) !== null;
}

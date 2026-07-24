/**
 * Shared Supabase environment access.
 *
 * Every Supabase client in the app funnels through here so that a missing key
 * degrades into "accounts aren't set up yet" instead of a runtime crash. This
 * is what lets the site be browsable and deployable before you've made a
 * Supabase project.
 */

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

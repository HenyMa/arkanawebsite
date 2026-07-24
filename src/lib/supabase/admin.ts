import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "./config";

/**
 * Service-role client. Bypasses row-level security, so it must only ever be
 * constructed in trusted server contexts — currently just the Stripe webhook,
 * which needs to write orders and mint points for a user it isn't logged in as.
 *
 * Never import this from a Client Component.
 */
export function createAdminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !serviceKey) return null;

  return createClient(SUPABASE_URL, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

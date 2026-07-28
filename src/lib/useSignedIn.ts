"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Client-side auth state for pages that stay statically rendered.
 *
 * `ready` is false until the first check resolves, so callers can avoid
 * flashing a "join" call to action at a member who is already signed in.
 */
export function useSignedIn() {
  const [signedIn, setSignedIn] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) {
      setReady(true);
      return;
    }

    supabase.auth.getUser().then(({ data }) => {
      setSignedIn(Boolean(data.user));
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setSignedIn(Boolean(session?.user));
      setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return { signedIn, ready };
}

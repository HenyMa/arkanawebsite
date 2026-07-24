"use client";

import { useEffect } from "react";
import { useCart } from "@/lib/cart";

/**
 * Empties the cart once the order is confirmed. Deliberately runs here rather
 * than before the Stripe redirect, so abandoning checkout leaves the cart intact.
 */
export function ClearCart() {
  const { clear, ready } = useCart();

  useEffect(() => {
    if (ready) clear();
  }, [ready, clear]);

  return null;
}

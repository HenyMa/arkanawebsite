import { redirect } from "next/navigation";

/**
 * Hoodies used to be the whole catalogue and lived at /hoodies. Now that there
 * are four categories they live under /shop, so this keeps old links, bookmarks
 * and search results working.
 */
export default function HoodiesRedirect() {
  redirect("/shop/hoodies");
}

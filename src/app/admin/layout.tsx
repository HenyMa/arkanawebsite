import type { Metadata } from "next";
import { AdminNav } from "@/components/AdminNav";
import { requireAdmin } from "@/lib/admin";

export const metadata: Metadata = {
  title: "Studio",
  robots: { index: false, follow: false },
};

/** Nothing here is cacheable — it is all live operational data. */
export const dynamic = "force-dynamic";

/**
 * Gate for the whole admin section.
 *
 * `requireAdmin()` 404s a non-admin before any child renders. Note that this
 * protects pages only: the API routes under /api/admin re-check for themselves,
 * because a route handler never runs a layout.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requireAdmin();

  return (
    <div className="min-h-screen bg-bone">
      <AdminNav email={admin.email} />
      {children}
    </div>
  );
}

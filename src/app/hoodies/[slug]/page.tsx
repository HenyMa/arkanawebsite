import { notFound, redirect } from "next/navigation";
import { getProduct, productPath } from "@/lib/products";

type Params = { params: Promise<{ slug: string }> };

/** Legacy product URL. See ../page.tsx for why this exists. */
export default async function LegacyProductRedirect({ params }: Params) {
  const product = getProduct((await params).slug);
  if (!product) notFound();
  redirect(productPath(product));
}

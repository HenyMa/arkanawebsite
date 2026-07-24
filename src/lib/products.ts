/**
 * Product catalogue.
 *
 * Kept in code rather than in Stripe or the database on purpose: prices are
 * sent to Stripe Checkout as inline `price_data`, so there is nothing to keep
 * in sync in the Stripe dashboard. When the catalogue outgrows this file, move
 * it to a `products` table in Supabase and swap the lookups below.
 */

export const SIZES = ["S", "M", "L", "XL", "XXL"] as const;
export type Size = (typeof SIZES)[number];

export type Product = {
  slug: string;
  name: string;
  /** Price in cents. Everything downstream stays in cents to avoid float drift. */
  priceCents: number;
  colorway: string;
  /** Short line used on cards and in the cart. */
  tagline: string;
  description: string;
  details: string[];
  /** Paths under /public. Replace with your own photography. */
  images: string[];
  /** Sizes currently sellable. Omit a size here to grey it out on the page. */
  inStock: Size[];
};

export const PRODUCTS: Product[] = [
  {
    slug: "monolith-hoodie",
    name: "Monolith Hoodie",
    priceCents: 12800,
    colorway: "Graphite",
    tagline: "Heavyweight 500gsm fleece, boxy cut",
    description:
      "The anchor of the collection. Cut from 500gsm loopback cotton and garment-dyed in small batches, the Monolith softens without losing its structure. The shoulder sits wide, the body falls straight, and the hem holds its line after wash.",
    details: [
      "500gsm heavyweight loopback cotton",
      "Garment-dyed in small batches",
      "Boxy body with dropped shoulder",
      "Double-lined hood, tonal drawcord",
      "Embroidered gold arkana mark at chest",
      "Made in Portugal",
    ],
    images: ["/products/monolith-1.svg", "/products/monolith-2.svg"],
    inStock: ["S", "M", "L", "XL", "XXL"],
  },
  {
    slug: "vesper-hoodie",
    name: "Vesper Hoodie",
    priceCents: 13400,
    colorway: "Sand",
    tagline: "Brushed interior, relaxed drape",
    description:
      "Named for the hour it was made for. The Vesper uses a brushed 420gsm fleece that drapes rather than stands, finished in a warm sand that shifts with the light. Quieter than the Monolith, and softer against the skin.",
    details: [
      "420gsm brushed cotton fleece",
      "Relaxed body, standard shoulder",
      "Ribbed cuffs and hem",
      "Matte horn-tone tipped drawcord",
      "Tonal woven label at hem",
      "Made in Portugal",
    ],
    images: ["/products/vesper-1.svg", "/products/vesper-2.svg"],
    inStock: ["S", "M", "L", "XL"],
  },
  {
    slug: "ember-hoodie",
    name: "Ember Hoodie",
    priceCents: 14200,
    colorway: "Antique Gold",
    tagline: "Limited run of 120, gold-dyed",
    description:
      "A limited run of 120 pieces. Each hoodie is over-dyed by hand, so no two land on exactly the same tone — expect variation across the body and deeper saturation at the seams. When they are gone, they are gone.",
    details: [
      "460gsm cotton fleece, hand over-dyed",
      "Limited to 120 pieces",
      "Every piece varies in tone",
      "Gold-foil interior neck print",
      "Numbered hem label",
      "Made in Portugal",
    ],
    images: ["/products/ember-1.svg", "/products/ember-2.svg"],
    inStock: ["M", "L", "XL"],
  },
];

export function getProduct(slug: string): Product | undefined {
  return PRODUCTS.find((p) => p.slug === slug);
}

/** Formats cents as USD. Used everywhere a price is rendered. */
export function formatPrice(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

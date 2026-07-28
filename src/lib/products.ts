/**
 * Product catalogue.
 *
 * Kept in code rather than in Stripe or the database on purpose: prices are
 * sent to Stripe Checkout as inline `price_data`, so there is nothing to keep
 * in sync in the Stripe dashboard. When the catalogue outgrows this file, move
 * it to a `products` table in Supabase and swap the lookups below.
 *
 * Price lives on the *category*, not the product. Arkana sells at one price per
 * garment type, so putting it here makes that rule structural — a new hoodie
 * cannot accidentally ship at the wrong price.
 */

export const SIZES = ["S", "M", "L", "XL", "XXL"] as const;
export type Size = (typeof SIZES)[number];

export type CategorySlug = "hoodies" | "sweatshirts" | "sweatpants" | "zip-ups";

export type Category = {
  slug: CategorySlug;
  /** Plural, used for headings and nav. */
  name: string;
  /** Singular, used in body copy. */
  singular: string;
  /** Every piece in this category sells at this price, in cents. */
  priceCents: number;
  tagline: string;
  description: string;
  /**
   * Extra words people actually type when looking for this. Feeds search only —
   * never rendered. Products inherit their category's keywords.
   */
  keywords: string[];
};

export const CATEGORIES: Category[] = [
  {
    slug: "hoodies",
    name: "Hoodies",
    singular: "Hoodie",
    priceCents: 11500,
    tagline: "Heavyweight loopback, garment-dyed",
    description:
      "The anchor of the collection. Heavyweight loopback cotton, garment-dyed after construction so colour settles into the seams and softens honestly with wear.",
    keywords: ["hoodie", "hooded", "pullover", "jumper", "hood", "fleece", "sweater"],
  },
  {
    slug: "sweatshirts",
    name: "Sweatshirts",
    singular: "Sweatshirt",
    priceCents: 8000,
    tagline: "Crewneck fleece, clean shoulder",
    description:
      "The hoodie's quieter sibling. Same fleece, same dye process, cut with a ribbed crew collar and a shoulder that sits where it should.",
    keywords: ["sweatshirt", "crewneck", "crew", "jumper", "sweater", "fleece", "pullover"],
  },
  {
    slug: "sweatpants",
    name: "Sweatpants",
    singular: "Sweatpant",
    priceCents: 8000,
    tagline: "Tapered leg, brushed interior",
    description:
      "Cut to be worn out of the house. A straight thigh, a gentle taper below the knee, and a waistband that holds its shape after the twentieth wash.",
    keywords: ["sweatpants", "joggers", "jogger", "trackpants", "track", "bottoms",
      "pants", "trousers", "lounge"],
  },
  {
    slug: "zip-ups",
    name: "Zip-Up Jackets",
    singular: "Zip-Up Jacket",
    priceCents: 10000,
    tagline: "Full-zip fleece, structured hood",
    description:
      "A layer rather than a pullover. Full-length metal zip, double-lined hood, and enough weight in the fleece to stand on its own over a tee.",
    keywords: ["zip up", "zipup", "zipper", "jacket", "coat", "layer", "outerwear",
      "full zip", "hooded"],
  },
];

export type Product = {
  slug: string;
  name: string;
  category: CategorySlug;
  /**
   * Price in cents, stamped from the category below. Everything downstream
   * stays in cents to avoid float drift.
   */
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

/** A product as authored — price is derived, never written by hand. */
type ProductSeed = Omit<Product, "priceCents">;

const SEEDS: ProductSeed[] = [
  // ------------------------------------------------------------------ Hoodie
  {
    slug: "monolith-hoodie",
    name: "Monolith Hoodie",
    category: "hoodies",
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

  // -------------------------------------------------------------- Sweatshirt
  {
    slug: "meridian-sweatshirt",
    name: "Meridian Sweatshirt",
    category: "sweatshirts",
    colorway: "Oat",
    tagline: "440gsm crewneck, ribbed collar",
    description:
      "A crewneck cut with the same pattern block as the Monolith, minus the hood. The collar is double-ribbed so it holds its shape, and the oat dye is undyed cotton lifted only a shade — the most honest colour we make.",
    details: [
      "440gsm loopback cotton",
      "Double-ribbed crew collar",
      "Straight body, standard shoulder",
      "Twin-needle stitched armhole",
      "Embroidered arkana mark at chest",
      "Made in Portugal",
    ],
    images: ["/products/meridian-1.svg", "/products/meridian-2.svg"],
    inStock: ["S", "M", "L", "XL", "XXL"],
  },

  // --------------------------------------------------------------- Sweatpant
  {
    slug: "monolith-sweatpant",
    name: "Monolith Sweatpant",
    category: "sweatpants",
    colorway: "Graphite",
    tagline: "Tapered leg, matched to the hoodie",
    description:
      "Dyed in the same bath as the Monolith Hoodie so the two actually match — most sets don't. Straight through the thigh, tapered below the knee, and cut long enough to stack slightly over a boot.",
    details: [
      "480gsm loopback cotton",
      "Dye-matched to the Monolith Hoodie",
      "Straight thigh, tapered below the knee",
      "Ribbed waistband with flat drawcord",
      "Deep side seam pockets",
      "Made in Portugal",
    ],
    images: ["/products/monolith-pant-1.svg", "/products/monolith-pant-2.svg"],
    inStock: ["S", "M", "L", "XL", "XXL"],
  },

  // ------------------------------------------------------------ Zip-up jacket
  {
    slug: "threshold-zip",
    name: "Threshold Zip-Up",
    category: "zip-ups",
    colorway: "Graphite",
    tagline: "Full metal zip, structured hood",
    description:
      "Built as outerwear rather than loungewear. A full-length antique brass zip runs to the top of the collar, and the hood is lined and interfaced so it stands up in wind instead of collapsing on your shoulders.",
    details: [
      "500gsm loopback cotton",
      "Full-length antique brass zip",
      "Structured, double-lined hood",
      "Bar-tacked pocket openings",
      "Storm flap behind the zip",
      "Made in Portugal",
    ],
    images: ["/products/threshold-1.svg", "/products/threshold-2.svg"],
    inStock: ["S", "M", "L", "XL", "XXL"],
  },
];

export function getCategory(slug: string): Category | undefined {
  return CATEGORIES.find((c) => c.slug === slug);
}

/** The catalogue, with each product's price stamped from its category. */
export const PRODUCTS: Product[] = SEEDS.map((seed) => {
  const category = getCategory(seed.category);
  if (!category) {
    // Unreachable while CategorySlug is a closed union, but a silently
    // mispriced product is the one failure mode worth being loud about.
    throw new Error(`Unknown category "${seed.category}" on ${seed.slug}`);
  }
  return { ...seed, priceCents: category.priceCents };
});

export function getProduct(slug: string): Product | undefined {
  return PRODUCTS.find((p) => p.slug === slug);
}

export function productsInCategory(slug: string): Product[] {
  return PRODUCTS.filter((p) => p.category === slug);
}

/** Canonical URL for a product page. */
export function productPath(product: Pick<Product, "slug" | "category">): string {
  return `/shop/${product.category}/${product.slug}`;
}

/** Canonical URL for a category listing. */
export function categoryPath(slug: CategorySlug): string {
  return `/shop/${slug}`;
}

/**
 * Path for a product referenced only by slug — order history and returns store
 * the slug, and a product may have been retired since. Falls back to /shop.
 */
export function productPathBySlug(slug: string): string {
  const product = getProduct(slug);
  return product ? productPath(product) : "/shop";
}

/** Formats cents as USD. Used everywhere a price is rendered. */
export function formatPrice(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

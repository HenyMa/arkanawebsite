/**
 * Site search.
 *
 * The catalogue is four products, so this is a scored in-memory scan rather
 * than an index server — no dependency, no build step, and it runs identically
 * on the server (for /search, which works without JavaScript) and in the
 * browser (for the header overlay's as-you-type results).
 *
 * It searches help pages as well as products, because in a shop this small the
 * question people actually arrive with is more often "how do returns work" than
 * "which grey hoodie".
 */

import {
  CATEGORIES,
  PRODUCTS,
  categoryPath,
  getCategory,
  productPath,
  productsInCategory,
} from "./products";

export type SearchResultKind = "product" | "category" | "page";

export type SearchResult = {
  kind: SearchResultKind;
  id: string;
  title: string;
  subtitle: string;
  href: string;
  image?: string;
  priceCents?: number;
  score: number;
};

export type SearchOutcome = {
  results: SearchResult[];
  /**
   * True when nothing matched every word typed and the search fell back to
   * matching any of them. The UI says so rather than passing near-misses off
   * as exact hits.
   */
  relaxed: boolean;
};

/**
 * Folds a string down to lowercase words: strips accents and punctuation, so
 * "Zip-Up" and "zip up" and "ZIPUP" all end up comparable.
 */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Crude singulariser. "hoodies" and "hoodie" have to score the same, and a
 * proper stemmer is far more machinery than four products justify. Only applied
 * to words long enough that dropping an "s" can't destroy them.
 */
function stem(word: string): string {
  if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss")) {
    return word.slice(0, -1);
  }
  return word;
}

function tokenize(text: string): string[] {
  return normalize(text).split(" ").filter(Boolean).map(stem);
}

/**
 * Filler words in a typed question. Stripped from queries only — never from the
 * index, so a keyword like "zip up" keeps both of its words.
 */
const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "of", "for", "to", "in", "on", "at", "is",
  "are", "was", "it", "its", "this", "that", "with", "from", "by", "as",
  "i", "me", "my", "mine", "you", "your", "we", "our",
  "how", "what", "where", "when", "why", "which", "who",
  "do", "does", "did", "can", "could", "should", "would", "will",
  "have", "has", "had", "get", "got", "need", "want", "find", "looking",
  "something", "anything", "some", "any", "please", "there", "back",
]);

/**
 * Terms to actually search on. Strips filler, but falls back to the raw words
 * if that would leave nothing — "how do I" should find nothing rather than
 * everything, but a query made entirely of stopwords still deserves a try.
 */
function queryTerms(query: string): string[] {
  const words = normalize(query).split(" ").filter(Boolean);
  const meaningful = words.filter((w) => !STOPWORDS.has(w));
  return (meaningful.length > 0 ? meaningful : words).map(stem);
}

/** How much each part of an entry counts toward the score. */
const WEIGHTS = {
  title: 10,
  keyword: 6,
  category: 5,
  colorway: 5,
  tagline: 3,
  body: 1.5,
} as const;

type Field = { words: string[]; weight: number };

type IndexEntry = {
  kind: SearchResultKind;
  id: string;
  title: string;
  subtitle: string;
  href: string;
  image?: string;
  priceCents?: number;
  /** Tokenized title, compared against the tokenized query for the exact boost. */
  titleKey: string;
  fields: Field[];
};

function field(text: string, weight: number): Field {
  return { words: tokenize(text), weight };
}

/**
 * Help pages worth surfacing. Declared before the index because building it
 * reads them at module load — a `const` below would still be in its temporal
 * dead zone.
 */
const PAGES: {
  title: string;
  subtitle: string;
  href: string;
  keywords: string[];
}[] = [
  {
    title: "Shipping & returns",
    subtitle: "Free shipping, and how to send something back",
    href: "/shipping",
    keywords: [
      "returns", "return", "refund", "refunds", "exchange", "exchanges",
      "shipping", "delivery", "postage", "tracking", "express", "duties",
      "customs", "policy", "faulty", "damaged", "wrong size",
    ],
  },
  {
    title: "Start a return",
    subtitle: "Open a return on a past order",
    href: "/account",
    keywords: [
      "start a return", "return", "returns", "rma", "send back", "refund",
      "exchange", "wrong size", "doesn't fit", "faulty",
    ],
  },
  {
    title: "The Arkana Circle",
    subtitle: "Points, tiers, and 20% off your first order",
    href: "/rewards",
    keywords: [
      "rewards", "reward", "circle", "points", "point", "tier", "tiers",
      "loyalty", "discount", "member", "membership", "initiate", "adept",
      "oracle", "redeem", "welcome",
    ],
  },
  {
    title: "Your account",
    subtitle: "Orders, points, and returns",
    href: "/account",
    keywords: [
      "account", "orders", "order", "history", "profile", "points",
      "my orders", "order status",
    ],
  },
  {
    title: "Cart",
    subtitle: "What you've picked out so far",
    href: "/cart",
    keywords: ["cart", "bag", "basket", "checkout", "buy", "pay"],
  },
  {
    title: "Create an account",
    subtitle: `Join the Circle and take 20% off your first order`,
    href: "/signup",
    keywords: [
      "sign up", "signup", "join", "register", "create account", "membership",
      "new account",
    ],
  },
  {
    title: "Sign in",
    subtitle: "Already have an account",
    href: "/login",
    keywords: ["sign in", "signin", "login", "log in"],
  },
  {
    title: "About Arkana",
    subtitle: "How and where the clothes are made",
    href: "/about",
    keywords: [
      "about", "story", "brand", "craft", "portugal", "made in", "cotton",
      "garment dyed", "sustainability", "contact",
    ],
  },
];

/** Built once at module load — the catalogue is static. */
const INDEX: IndexEntry[] = buildIndex();

function buildIndex(): IndexEntry[] {
  const entries: IndexEntry[] = [];

  for (const product of PRODUCTS) {
    const category = getCategory(product.category);
    entries.push({
      kind: "product",
      id: product.slug,
      title: product.name,
      subtitle: `${product.colorway} · ${product.tagline}`,
      href: productPath(product),
      image: product.images[0],
      priceCents: product.priceCents,
      titleKey: tokenize(product.name).join(" "),
      fields: [
        field(product.name, WEIGHTS.title),
        field((category?.keywords ?? []).join(" "), WEIGHTS.keyword),
        field(`${category?.name ?? ""} ${category?.singular ?? ""}`, WEIGHTS.category),
        field(product.colorway, WEIGHTS.colorway),
        field(product.tagline, WEIGHTS.tagline),
        field(`${product.description} ${product.details.join(" ")}`, WEIGHTS.body),
      ],
    });
  }

  for (const category of CATEGORIES) {
    /*
     * A category holding a single product is just a slower route to that
     * product, and listing both makes the results read like duplicates. Index
     * the category only once there is a choice to be made inside it — add a
     * second hoodie and "hoodies" starts returning the category again.
     */
    if (productsInCategory(category.slug).length < 2) continue;

    entries.push({
      kind: "category",
      id: category.slug,
      title: category.name,
      subtitle: category.tagline,
      href: categoryPath(category.slug),
      priceCents: category.priceCents,
      titleKey: tokenize(category.name).join(" "),
      fields: [
        field(`${category.name} ${category.singular}`, WEIGHTS.title),
        field(category.keywords.join(" "), WEIGHTS.keyword),
        field(category.tagline, WEIGHTS.tagline),
        field(category.description, WEIGHTS.body),
      ],
    });
  }

  for (const page of PAGES) {
    entries.push({
      kind: "page",
      id: page.href,
      title: page.title,
      subtitle: page.subtitle,
      href: page.href,
      titleKey: tokenize(page.title).join(" "),
      fields: [
        field(page.title, WEIGHTS.title),
        field(page.keywords.join(" "), WEIGHTS.keyword),
        field(page.subtitle, WEIGHTS.body),
      ],
    });
  }

  return entries;
}

/** Best score a single term can earn from one field. */
function scoreTerm(term: string, f: Field): number {
  let best = 0;
  for (const word of f.words) {
    let factor = 0;
    if (word === term) factor = 1;
    else if (word.startsWith(term)) factor = 0.65;
    else if (word.includes(term)) factor = 0.35;

    if (factor > best) best = factor;
    if (best === 1) break;
  }
  return best * f.weight;
}

/** Ties break toward things you can buy. */
const KIND_RANK: Record<SearchResultKind, number> = {
  product: 0,
  category: 1,
  page: 2,
};

/** Scores every entry against the terms. `requireAll` ANDs them. */
function collect(terms: string[], requireAll: boolean): SearchResult[] {
  const key = terms.join(" ");
  const results: SearchResult[] = [];

  for (const entry of INDEX) {
    let total = 0;
    let matched = 0;

    for (const term of terms) {
      let best = 0;
      for (const f of entry.fields) {
        const score = scoreTerm(term, f);
        if (score > best) best = score;
      }
      if (best > 0) {
        matched++;
        total += best;
      } else if (requireAll) {
        total = 0;
        break;
      }
    }

    if (matched === 0) continue;
    if (requireAll && matched < terms.length) continue;

    // Typing a title in full should always win over an incidental body match.
    if (entry.titleKey === key) total += 25;

    results.push({
      kind: entry.kind,
      id: entry.id,
      title: entry.title,
      subtitle: entry.subtitle,
      href: entry.href,
      image: entry.image,
      priceCents: entry.priceCents,
      score: total,
    });
  }

  return results;
}

/**
 * Scores the catalogue against a query.
 *
 * Terms are ANDed first, so "graphite hoodie" won't return an oat sweatshirt
 * just because "hoodie" matched somewhere. If nothing survives that, it falls
 * back to matching any term — a long, chatty query should return the best it
 * can rather than an empty page.
 *
 * Results are deduplicated by destination: several entries point at /account
 * for different reasons, and showing the same URL twice reads as a bug.
 */
export function search(query: string, limit = 8): SearchOutcome {
  const terms = queryTerms(query);
  if (terms.length === 0) return { results: [], relaxed: false };

  let relaxed = false;
  let results = collect(terms, true);
  if (results.length === 0 && terms.length > 1) {
    results = collect(terms, false);
    relaxed = results.length > 0;
  }

  results.sort(
    (a, b) =>
      b.score - a.score ||
      KIND_RANK[a.kind] - KIND_RANK[b.kind] ||
      a.title.localeCompare(b.title),
  );

  const seen = new Set<string>();
  const deduped: SearchResult[] = [];
  for (const result of results) {
    if (seen.has(result.href)) continue;
    seen.add(result.href);
    deduped.push(result);
    if (deduped.length === limit) break;
  }

  return { results: deduped, relaxed };
}

/** Shown as starting points when the search box is still empty. */
export const SUGGESTED_QUERIES = [
  "hoodie",
  "sweatpants",
  "zip-up",
  "returns",
  "rewards",
];

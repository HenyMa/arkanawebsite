"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { PRODUCTS, type Size, getProduct } from "./products";

const STORAGE_KEY = "arkana.cart.v1";

/** Only the identity of the line is stored — price is always re-read from the
 * catalogue so a stale localStorage entry can never carry an outdated price. */
export type CartLine = {
  slug: string;
  size: Size;
  quantity: number;
};

export type ResolvedLine = CartLine & {
  name: string;
  colorway: string;
  priceCents: number;
  image: string;
  lineTotalCents: number;
};

type CartContext = {
  lines: CartLine[];
  resolved: ResolvedLine[];
  subtotalCents: number;
  count: number;
  /** True once localStorage has been read, so the UI can avoid a hydration flash. */
  ready: boolean;
  add: (slug: string, size: Size, quantity?: number) => void;
  setQuantity: (slug: string, size: Size, quantity: number) => void;
  remove: (slug: string, size: Size) => void;
  clear: () => void;
};

const Ctx = createContext<CartContext | null>(null);

const MAX_PER_LINE = 10;

function isSameLine(a: CartLine, slug: string, size: Size) {
  return a.slug === slug && a.size === size;
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);

  // Load once on mount. Unknown slugs are dropped so a removed product cannot
  // wedge the cart.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: CartLine[] = JSON.parse(raw);
        setLines(
          parsed.filter(
            (l) =>
              PRODUCTS.some((p) => p.slug === l.slug) &&
              Number.isFinite(l.quantity) &&
              l.quantity > 0,
          ),
        );
      }
    } catch {
      // Corrupt or unavailable storage — start empty rather than break the page.
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch {
      // Private browsing / quota. Cart still works for this session.
    }
  }, [lines, ready]);

  const add = useCallback((slug: string, size: Size, quantity = 1) => {
    setLines((prev) => {
      const existing = prev.find((l) => isSameLine(l, slug, size));
      if (existing) {
        return prev.map((l) =>
          isSameLine(l, slug, size)
            ? { ...l, quantity: Math.min(MAX_PER_LINE, l.quantity + quantity) }
            : l,
        );
      }
      return [...prev, { slug, size, quantity: Math.min(MAX_PER_LINE, quantity) }];
    });
  }, []);

  const setQuantity = useCallback((slug: string, size: Size, quantity: number) => {
    setLines((prev) =>
      quantity <= 0
        ? prev.filter((l) => !isSameLine(l, slug, size))
        : prev.map((l) =>
            isSameLine(l, slug, size)
              ? { ...l, quantity: Math.min(MAX_PER_LINE, quantity) }
              : l,
          ),
    );
  }, []);

  const remove = useCallback((slug: string, size: Size) => {
    setLines((prev) => prev.filter((l) => !isSameLine(l, slug, size)));
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const resolved = useMemo<ResolvedLine[]>(() => {
    return lines.flatMap((line) => {
      const product = getProduct(line.slug);
      if (!product) return [];
      return [
        {
          ...line,
          name: product.name,
          colorway: product.colorway,
          priceCents: product.priceCents,
          image: product.images[0],
          lineTotalCents: product.priceCents * line.quantity,
        },
      ];
    });
  }, [lines]);

  const subtotalCents = useMemo(
    () => resolved.reduce((sum, l) => sum + l.lineTotalCents, 0),
    [resolved],
  );

  const count = useMemo(
    () => lines.reduce((sum, l) => sum + l.quantity, 0),
    [lines],
  );

  const value = useMemo(
    () => ({
      lines,
      resolved,
      subtotalCents,
      count,
      ready,
      add,
      setQuantity,
      remove,
      clear,
    }),
    [lines, resolved, subtotalCents, count, ready, add, setQuantity, remove, clear],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}

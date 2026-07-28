"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SearchResultRow } from "./SearchResultRow";
import { SUGGESTED_QUERIES, search } from "@/lib/search";

const MAX_RESULTS = 6;

export function SearchIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      className={className}
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M16.5 16.5 L21 21" strokeLinecap="round" />
    </svg>
  );
}

/**
 * The header's search affordance: a button, and the overlay it opens.
 *
 * The overlay is a convenience layer over /search — everything it does can be
 * done by submitting the form on that page, so losing JavaScript costs the
 * as-you-type results and nothing else.
 */
export function SearchOverlay() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const { results, relaxed } = useMemo(
    () => search(query, MAX_RESULTS),
    [query],
  );

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActiveIndex(0);
  }, []);

  // ⌘K / Ctrl+K anywhere, and "/" when the caret isn't already in a field.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((o) => !o);
        return;
      }

      if (event.key === "/" && !typing && !open) {
        event.preventDefault();
        setOpen(true);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  /*
   * Hold the page still behind the overlay, and take focus immediately.
   *
   * Focus is claimed synchronously here (and via autoFocus on the input) rather
   * than in a requestAnimationFrame: opening with "/" and typing straight away
   * is the whole point of a keyboard shortcut, and a frame's delay is long
   * enough to swallow the first character or two.
   */
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    inputRef.current?.focus();
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  // A new query invalidates wherever the highlight was.
  useEffect(() => setActiveIndex(0), [query]);

  function go(href: string) {
    close();
    router.push(href);
  }

  function onInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (results.length === 0) return;
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((i) => (i + step + results.length) % results.length);
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const chosen = results[activeIndex];
      if (chosen) go(chosen.href);
      else if (query.trim()) go(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 text-slate transition-colors hover:text-graphite"
        aria-label="Search"
      >
        <SearchIcon />
        <span className="eyebrow hidden lg:inline">Search</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[100]">
          {/* Backdrop. Clicking anywhere off the panel dismisses. */}
          <button
            type="button"
            aria-label="Close search"
            onClick={close}
            className="absolute inset-0 h-full w-full cursor-default bg-graphite/40 backdrop-blur-[2px]"
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-label="Search Arkana"
            /* Deliberately not `animate-rise` — its 0.9s entrance is right for
               a hero, and far too slow for something you opened to type into. */
            className="relative mx-auto mt-[12vh] w-[min(42rem,calc(100%-2rem))] border border-parchment bg-bone shadow-xl"
          >
            <div className="flex items-center gap-3 border-b border-parchment px-5">
              <SearchIcon className="shrink-0 text-ash" />
              <input
                ref={inputRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onInputKeyDown}
                placeholder="Hoodie, sweatpants, returns…"
                autoComplete="off"
                autoFocus
                aria-label="Search Arkana"
                className="w-full bg-transparent py-4 text-sm text-graphite placeholder:text-mist focus:outline-none"
              />
              <button
                type="button"
                onClick={close}
                className="shrink-0 text-xs text-ash hover:text-slate"
              >
                Esc
              </button>
            </div>

            {query.trim() === "" ? (
              <div className="px-5 py-6">
                <p className="eyebrow text-clay">Try</p>
                <ul className="mt-4 flex flex-wrap gap-2">
                  {SUGGESTED_QUERIES.map((suggestion) => (
                    <li key={suggestion}>
                      <button
                        type="button"
                        onClick={() => setQuery(suggestion)}
                        className="border border-sand px-3 py-1.5 text-sm text-graphite transition-colors hover:border-gold hover:bg-linen"
                      >
                        {suggestion}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : results.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <p className="text-sm text-slate">
                  Nothing matches &ldquo;{query.trim()}&rdquo;.
                </p>
                <Link
                  href="/shop"
                  onClick={close}
                  className="link-underline mt-3 inline-block text-xs text-gold-deep"
                >
                  Browse everything instead
                </Link>
              </div>
            ) : (
              <>
                {relaxed && (
                  <p className="border-b border-parchment px-5 py-3 text-xs text-ash">
                    Nothing matched everything you typed — showing the closest.
                  </p>
                )}
                <div className="max-h-[52vh] overflow-y-auto">
                  {results.map((result, i) => (
                    <div
                      key={`${result.kind}-${result.id}`}
                      onClick={close}
                      onMouseEnter={() => setActiveIndex(i)}
                    >
                      <SearchResultRow result={result} active={i === activeIndex} />
                    </div>
                  ))}
                </div>
                <Link
                  href={`/search?q=${encodeURIComponent(query.trim())}`}
                  onClick={close}
                  className="block border-t border-parchment px-5 py-3.5 text-center text-xs text-slate transition-colors hover:bg-linen hover:text-graphite"
                >
                  See all results for &ldquo;{query.trim()}&rdquo;
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

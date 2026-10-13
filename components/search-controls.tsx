"use client";

import { Input } from "@/components/ui/input";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

/**
 * Each example shares no words with the film it should return, and none of them
 * appear as a substring anywhere in the 4,799 titles and overviews — so a
 * `LIKE`-style search would find nothing. Each one puts the obvious film first
 * here. Checked, not guessed.
 */
const EXAMPLES = [
  "dinosaurs escape and hunt people",
  "a robot learns to feel",
  "a man relives the same day over and over",
];

const DEBOUNCE_MS = 300;

export function SearchControls({ query }: { query: string }) {
  const router = useRouter();
  const [value, setValue] = useState(query);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const navigate = (nextQuery: string) => {
    const params = new URLSearchParams();
    if (nextQuery) {
      params.set("q", nextQuery);
    }
    const search = params.toString();
    startTransition(() => {
      router.replace(search ? `/?${search}` : "/", { scroll: false });
    });
  };

  // Debounced so a search is not issued — and an embedding not paid for — on
  // every keystroke.
  useEffect(() => {
    if (value === query) {
      return;
    }
    const timer = setTimeout(() => navigate(value), DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // "/" focuses the search box, matching the sibling AWS demos.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "/" && document.activeElement !== inputRef.current) {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Input
          ref={inputRef}
          value={value}
          placeholder="Describe a movie..."
          aria-label="Search movies"
          // Cosmetic only — lib/db/search.ts enforces the real limit, since `q`
          // can be set directly in the URL without going through this input.
          maxLength={200}
          className="text-base bg-white dark:bg-gray-950 text-black dark:text-white focus:border-black dark:border-gray-700 dark:focus:border-gray-200 w-full pr-8"
          onChange={(event) => setValue(event.target.value)}
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 h-5 w-5 items-center justify-center bg-gray-100 dark:bg-gray-900 rounded text-gray-700 dark:text-gray-400 border border-gray-200 dark:border-gray-700 md:flex hidden">
          <span className="font-mono text-xs">/</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-xs text-gray-500">
        <span className="py-1">Try:</span>
        {EXAMPLES.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => {
              setValue(example);
              navigate(example);
            }}
            className="px-2 py-1 border border-dashed border-gray-300 dark:border-gray-700 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            {example}
          </button>
        ))}
        {isPending ? <span className="py-1 italic">searching...</span> : null}
      </div>
    </div>
  );
}

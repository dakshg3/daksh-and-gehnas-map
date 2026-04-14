"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Option = {
  display_name: string;
  lat: string;
  lon: string;
};

export function LocationSearch({
  value,
  onPick,
}: {
  value: string;
  onPick: (locationName: string, lat: number, lon: number) => void;
}) {
  const [q, setQ] = useState(value);
  const [loading, setLoading] = useState(false);
  const [opts, setOpts] = useState<Option[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setQ(value), [value]);

  const canSearch = useMemo(() => q.trim().length >= 3, [q]);

  const runSearch = useCallback(async (query: string) => {
    if (query.trim().length < 3) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setHasSearched(true);
    setErrorMsg("");

    try {
      const url = new URL("https://nominatim.openstreetmap.org/search");
      url.searchParams.set("format", "jsonv2");
      url.searchParams.set("q", query);
      url.searchParams.set("limit", "5");

      const res = await fetch(url, {
        signal: controller.signal,
        headers: { "User-Agent": "our-story-map/1.0 (client)" },
      });
      if (!res.ok) throw new Error(`Search failed (${res.status})`);
      const data = (await res.json()) as Option[];
      setOpts(Array.isArray(data) ? data : []);
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setOpts([]);
      setErrorMsg("Could not search right now. Try again in a moment.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!canSearch) {
      setOpts([]);
      setHasSearched(false);
      setErrorMsg("");
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void runSearch(q.trim());
    }, 320);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [canSearch, q, runSearch]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!canSearch) return;
          void runSearch(q.trim());
        }}
      >
        <input
          className="w-full rounded-2xl bg-white/70 px-3 py-2 text-sm ring-1 ring-white/60 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-violet-300"
          placeholder="Search a place (e.g., Paris, Kyoto, Big Sur)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button
          type="button"
          className="shrink-0 rounded-2xl bg-violet-500 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-violet-600 disabled:opacity-50"
          disabled={!canSearch || loading}
          onClick={() => {
            if (!canSearch) return;
            void runSearch(q.trim());
          }}
        >
          {loading ? "…" : "Search"}
        </button>
      </form>

      {opts.length ? (
        <div className="mt-2 overflow-hidden rounded-2xl bg-white/70 ring-1 ring-white/60">
          {opts.map((o) => (
            <button
              key={`${o.lat},${o.lon}`}
              className="block w-full px-3 py-2 text-left text-sm hover:bg-white/80"
              type="button"
              onClick={() =>
                onPick(o.display_name, Number(o.lat), Number(o.lon))
              }
            >
              {o.display_name}
            </button>
          ))}
        </div>
      ) : null}

      {!loading && !errorMsg && hasSearched && canSearch && !opts.length ? (
        <div className="mt-2 rounded-2xl bg-white/60 px-3 py-2 text-xs text-zinc-600 ring-1 ring-white/60">
          No results found. Try a broader search.
        </div>
      ) : null}

      {errorMsg ? (
        <div className="mt-2 rounded-2xl bg-violet-50 px-3 py-2 text-xs text-violet-700 ring-1 ring-violet-200">
          {errorMsg}
        </div>
      ) : null}

      <div className="mt-1 text-xs text-zinc-500">Tip: you can also click on the mini map to drop a pin.</div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Option = {
  display_name: string;
  lat: string;
  lon: string;
};

const INITIAL_LIMIT = 8;
const MAX_LIMIT = 20;

function normalizeQuery(query: string) {
  return query
    .replace(/[()\[\]{}]/g, " ")
    .replace(/["'`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildPhotonDisplayName(properties: Record<string, unknown>) {
  const parts = [
    properties.name,
    properties.city,
    properties.state,
    properties.country,
  ]
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter(Boolean);

  return parts.join(", ");
}

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
  const [resultLimit, setResultLimit] = useState(INITIAL_LIMIT);

  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setQ(value), [value]);

  const canSearch = useMemo(() => q.trim().length >= 2, [q]);

  const runSearch = useCallback(async (query: string, limit = resultLimit) => {
    if (query.trim().length < 2) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setHasSearched(true);
    setErrorMsg("");

    try {
      const seen = new Set<string>();
      let hadProviderError = false;

      const withDedup = (list: Option[]) => {
        return list.filter((o) => {
          const key = `${o.display_name}|${o.lat}|${o.lon}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      };

      const safeFetch = async (providerFetch: () => Promise<Option[]>) => {
        try {
          return await providerFetch();
        } catch (e) {
          if ((e as Error).name === "AbortError") throw e;
          hadProviderError = true;
          return [];
        }
      };

      const fetchNominatimOptions = async (qValue: string) => {
        const url = new URL("https://nominatim.openstreetmap.org/search");
        url.searchParams.set("format", "jsonv2");
        url.searchParams.set("q", qValue);
        url.searchParams.set("limit", String(limit));
        url.searchParams.set("dedupe", "0");
        url.searchParams.set("addressdetails", "1");

        const res = await fetch(url, {
          signal: controller.signal,
          headers: {
            "User-Agent": "our-story-map/1.0 (client)",
            "Accept-Language": "en",
          },
        });
        if (!res.ok) throw new Error(`Search failed (${res.status})`);

        const data = (await res.json()) as Option[];
        return withDedup(Array.isArray(data) ? data : []);
      };

      const fetchPhotonOptions = async (qValue: string) => {
        const url = new URL("https://photon.komoot.io/api/");
        url.searchParams.set("q", qValue);
        url.searchParams.set("limit", String(limit));
        url.searchParams.set("lang", "en");

        const res = await fetch(url, {
          signal: controller.signal,
          headers: {
            "Accept-Language": "en",
          },
        });
        if (!res.ok) throw new Error(`Photon search failed (${res.status})`);

        const payload = (await res.json()) as {
          features?: Array<{
            geometry?: { coordinates?: [number, number] };
            properties?: Record<string, unknown>;
          }>;
        };

        const raw = Array.isArray(payload.features) ? payload.features : [];
        const mapped: Option[] = raw
          .map((feature) => {
            const coords = feature.geometry?.coordinates;
            if (!Array.isArray(coords) || coords.length < 2) return null;

            const lon = Number(coords[0]);
            const lat = Number(coords[1]);
            if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

            const props = feature.properties ?? {};
            const display = buildPhotonDisplayName(props) || qValue;

            return {
              display_name: display,
              lat: String(lat),
              lon: String(lon),
            };
          })
          .filter((v): v is Option => Boolean(v));

        return withDedup(mapped);
      };

      const normalized = normalizeQuery(query);
      const firstPass = await safeFetch(() => fetchNominatimOptions(query));
      let merged = [...firstPass];

      if (merged.length < Math.min(limit, INITIAL_LIMIT) && normalized !== query) {
        const normalizedPass = await safeFetch(() => fetchNominatimOptions(normalized));
        merged = [...merged, ...normalizedPass];
      }

      if (merged.length < Math.min(limit, INITIAL_LIMIT)) {
        const photonPass = await safeFetch(() => fetchPhotonOptions(normalized || query));
        merged = [...merged, ...photonPass];
      }

      setOpts(merged.slice(0, limit));

      if (!merged.length && hadProviderError) {
        setErrorMsg("Could not search right now. Try again in a moment.");
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setOpts([]);
      setErrorMsg("Could not search right now. Try again in a moment.");
    } finally {
      setLoading(false);
    }
  }, [resultLimit]);

  useEffect(() => {
    if (!canSearch) {
      setOpts([]);
      setHasSearched(false);
      setErrorMsg("");
      setResultLimit(INITIAL_LIMIT);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void runSearch(q.trim(), resultLimit);
    }, 320);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [canSearch, q, runSearch, resultLimit]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const canShowMore =
    canSearch &&
    hasSearched &&
    !loading &&
    opts.length >= resultLimit &&
    resultLimit < MAX_LIMIT;

  return (
    <div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!canSearch) return;
          void runSearch(q.trim(), resultLimit);
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
            void runSearch(q.trim(), resultLimit);
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
          {canShowMore ? (
            <button
              type="button"
              className="block w-full border-t border-white/70 px-3 py-2 text-left text-xs font-medium text-violet-700 hover:bg-white/80"
              onClick={() => {
                const nextLimit = Math.min(MAX_LIMIT, resultLimit + 6);
                setResultLimit(nextLimit);
                void runSearch(q.trim(), nextLimit);
              }}
            >
              Show more options
            </button>
          ) : null}
        </div>
      ) : null}

      {!loading && !errorMsg && hasSearched && canSearch && !opts.length ? (
        <div className="mt-2 rounded-2xl bg-white/60 px-3 py-2 text-xs text-zinc-600 ring-1 ring-white/60">
          No results found. Try city and country together, like "Mysuru, India", or correct typos like "Plateau".
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

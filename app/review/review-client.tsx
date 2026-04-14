"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Memory } from "@/components/types";
import { MemoryEditorCard } from "@/components/MemoryEditorCard";
import { DownloadButton } from "@/components/DownloadButton";
import { byDateAsc, isEditedComparedToDetected } from "@/components/utils";
import {
  applyDraftToMemories,
  clearDraftMemories,
  loadDraftMemories,
  saveDraftMemories,
} from "@/components/memoryDraft";

type MemoriesJson = Memory[];
const INITIAL_VISIBLE_CARDS = 28;
const LOAD_MORE_STEP = 28;
const AUTOSAVE_DEBOUNCE_MS = 450;

function withDerivedState(memory: Memory) {
  const needsReview =
    !memory.date ||
    memory.latitude == null ||
    memory.longitude == null ||
    !memory.locationName;

  return {
    ...memory,
    needsReview,
    isEdited: isEditedComparedToDetected(memory),
  };
}

export function ReviewClient() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [reloadKey, setReloadKey] = useState(0);
  const [autosavedAt, setAutosavedAt] = useState<number | null>(null);
  const [usingLocalDraft, setUsingLocalDraft] = useState(false);
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_CARDS);
  const [showNeedsReviewOnly, setShowNeedsReviewOnly] = useState(false);

  useEffect(() => {
    let alive = true;

    const load = async () => {
      setStatus("loading");
      try {
        const res = await fetch("/data/memories.json", { cache: "force-cache" });
        if (!res.ok) throw new Error(`Failed to load memories (${res.status})`);
        const data = (await res.json()) as MemoriesJson;
        if (!alive) return;

        const normalized = (Array.isArray(data) ? data : [])
          .map((m) => {
            const entry: Memory = {
              ...m,
              detectedDate: m.detectedDate ?? m.date ?? "",
              detectedLatitude: m.detectedLatitude ?? m.latitude ?? null,
              detectedLongitude: m.detectedLongitude ?? m.longitude ?? null,
              detectedLocationName: m.detectedLocationName ?? m.locationName ?? "",
              isEdited: Boolean(m.isEdited),
            };

            const derived = withDerivedState(entry);
            return entry.isEdited ? { ...derived, isEdited: true } : derived;
          })
          .sort(byDateAsc);

        const draft = loadDraftMemories();
        const withDraft = applyDraftToMemories(normalized, draft);
        const derivedWithDraft = withDraft.map((m) => {
          const derived = withDerivedState(m);
          return m.isEdited ? { ...derived, isEdited: true } : derived;
        });

        // Keep the initial load order stable so editing fields doesn't reshuffle
        // cards and trigger Leaflet map container reuse races.
        setMemories(derivedWithDraft);
        setVisibleCount(INITIAL_VISIBLE_CARDS);
        setUsingLocalDraft(Boolean(draft?.length));
        setStatus("ready");
      } catch {
        if (!alive) return;
        setMemories([]);
        setVisibleCount(INITIAL_VISIBLE_CARDS);
        setStatus("error");
      }
    };

    void load();

    return () => {
      alive = false;
    };
  }, [reloadKey]);

  useEffect(() => {
    if (status !== "ready") return;

    const timer = window.setTimeout(() => {
      saveDraftMemories(memories);
      setAutosavedAt(Date.now());
    }, AUTOSAVE_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [memories, status]);

  const sorted = memories;
  const filtered = useMemo(
    () =>
      showNeedsReviewOnly
        ? sorted.filter((m) => m.needsReview)
        : sorted,
    [showNeedsReviewOnly, sorted]
  );
  const visibleMemories = useMemo(
    () => filtered.slice(0, visibleCount),
    [filtered, visibleCount]
  );
  const remainingCount = Math.max(0, filtered.length - visibleMemories.length);

  const needsCount = useMemo(
    () => sorted.filter((m) => m.needsReview).length,
    [sorted]
  );

  const editedCount = useMemo(
    () => sorted.filter((m) => m.isEdited).length,
    [sorted]
  );

  const update = useCallback((id: string, file: string, next: Memory) => {
    setMemories((prev) =>
      prev.map((m) => {
        if (m.id !== id || m.file !== file) return m;
        const merged = {
          ...next,
          detectedDate: next.detectedDate ?? m.detectedDate ?? "",
          detectedLatitude: next.detectedLatitude ?? m.detectedLatitude ?? null,
          detectedLongitude: next.detectedLongitude ?? m.detectedLongitude ?? null,
          detectedLocationName: next.detectedLocationName ?? m.detectedLocationName ?? "",
        };
        return withDerivedState(merged);
      })
    );
  }, []);

  const resetToDetected = useCallback((id: string, file: string) => {
    setMemories((prev) =>
      prev.map((m) => {
        if (m.id !== id || m.file !== file) return m;
        return withDerivedState({
          ...m,
          date: m.detectedDate ?? "",
          latitude: m.detectedLatitude ?? null,
          longitude: m.detectedLongitude ?? null,
          locationName: m.detectedLocationName ?? "",
          caption: "",
          isEdited: false,
        });
      })
    );
  }, []);

  if (status === "loading") {
    return (
      <div className="space-y-4">
        <div className="h-24 animate-pulse rounded-3xl bg-white/55 ring-1 ring-white/60" />
        <div className="h-24 animate-pulse rounded-3xl bg-white/55 ring-1 ring-white/60" />
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="rounded-3xl bg-white/75 p-5 ring-1 ring-white/70">
        <div className="text-sm font-semibold text-violet-700">Could not load review data.</div>
        <div className="mt-1 text-sm text-zinc-600">Check that <code>/public/data/memories.json</code> exists and is valid JSON.</div>
        <button
          type="button"
          onClick={() => setReloadKey((v) => v + 1)}
          className="mt-3 inline-flex items-center rounded-full bg-violet-500 px-4 py-2 text-sm font-medium text-white hover:bg-violet-600"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!sorted.length) {
    return (
      <div className="rounded-3xl bg-white/75 p-5 ring-1 ring-white/70">
        <div className="text-sm font-semibold text-zinc-900">No photos to review yet.</div>
        <div className="mt-1 text-sm text-zinc-600">Add files to <code>/public/photos</code>, then run <code>npm run memories:extract</code>.</div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1 text-sm text-zinc-700">
          {sorted.length} photos •{" "}
          <span className={needsCount ? "font-semibold text-violet-700" : ""}>
            {needsCount} need review
          </span>
          {" • "}
          <span className={editedCount ? "font-semibold text-purple-700" : ""}>
            {editedCount} edited
          </span>
          <div className="text-xs text-zinc-500">
            Autosave: {autosavedAt ? "saved locally" : "waiting"}
            {usingLocalDraft ? " (loaded local draft)" : ""}
          </div>
          <div className="text-xs text-zinc-500">
            Showing {visibleMemories.length} of {filtered.length}
            {showNeedsReviewOnly ? " needing review" : " photos"}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setShowNeedsReviewOnly((v) => !v);
              setVisibleCount(INITIAL_VISIBLE_CARDS);
            }}
            className={
              "inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-medium shadow-sm ring-1 backdrop-blur " +
              (showNeedsReviewOnly
                ? "bg-violet-500 text-white ring-violet-400 hover:bg-violet-600"
                : "bg-white/70 text-zinc-700 ring-white/50 hover:bg-white/90")
            }
            aria-pressed={showNeedsReviewOnly}
          >
            {showNeedsReviewOnly ? "Showing: Needs review" : "Filter: Needs review"}
          </button>
          <button
            type="button"
            onClick={() => {
              clearDraftMemories();
              setUsingLocalDraft(false);
              setReloadKey((v) => v + 1);
            }}
            className="inline-flex items-center justify-center rounded-full bg-white/70 px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm ring-1 ring-white/50 backdrop-blur hover:bg-white/90"
          >
            Reset local autosave
          </button>
          <DownloadButton memories={memories} />
        </div>
      </div>

      {!visibleMemories.length && showNeedsReviewOnly ? (
        <div className="mb-4 rounded-3xl bg-white/75 p-5 text-sm text-zinc-700 ring-1 ring-white/70">
          Everything looks good. No photos currently need review.
        </div>
      ) : null}

      <div className="space-y-4">
        {visibleMemories.map((m) => (
          <MemoryEditorCard
            key={`${m.id}|${m.file}`}
            memory={m}
            onChange={update}
            onResetToOriginal={resetToDetected}
          />
        ))}
      </div>

      {remainingCount > 0 ? (
        <div className="mt-4 flex items-center justify-center">
          <button
            type="button"
            onClick={() =>
              setVisibleCount((count) =>
                Math.min(count + LOAD_MORE_STEP, filtered.length)
              )
            }
            className="inline-flex items-center rounded-full bg-white/80 px-5 py-2.5 text-sm font-medium text-zinc-800 ring-1 ring-white/70 hover:bg-white"
          >
            Load more ({remainingCount} remaining)
          </button>
        </div>
      ) : null}

      <div className="mt-8 text-center text-sm text-zinc-600">
        Edits are autosaved in this browser. Use download when you want to
        update <code>data/memories.json</code> in the project permanently.
      </div>
    </div>
  );
}

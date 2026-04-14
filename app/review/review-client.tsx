"use client";

import { useEffect, useMemo, useState } from "react";
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

export function ReviewClient() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [reloadKey, setReloadKey] = useState(0);
  const [autosavedAt, setAutosavedAt] = useState<number | null>(null);
  const [usingLocalDraft, setUsingLocalDraft] = useState(false);

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

  useEffect(() => {
    let alive = true;

    const load = async () => {
      setStatus("loading");
      try {
        const res = await fetch("/data/memories.json", { cache: "no-store" });
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
        setUsingLocalDraft(Boolean(draft?.length));
        setStatus("ready");
      } catch {
        if (!alive) return;
        setMemories([]);
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
    saveDraftMemories(memories);
    setAutosavedAt(Date.now());
  }, [memories, status]);

  const sorted = memories;

  const needsCount = useMemo(
    () => sorted.filter((m) => m.needsReview).length,
    [sorted]
  );

  const editedCount = useMemo(
    () => sorted.filter((m) => m.isEdited).length,
    [sorted]
  );

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

  function update(id: string, next: Memory) {
    setMemories((prev) =>
      prev.map((m) => {
        if (m.id !== id) return m;
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
  }

  function resetToDetected(id: string) {
    setMemories((prev) =>
      prev.map((m) => {
        if (m.id !== id) return m;
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
        </div>
        <div className="flex flex-wrap items-center gap-2">
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

      <div className="space-y-4">
        {sorted.map((m) => (
          <MemoryEditorCard
            key={m.id}
            memory={m}
            onChange={(next) => update(m.id, next)}
            onResetToOriginal={() => resetToDetected(m.id)}
          />
        ))}
      </div>

      <div className="mt-8 text-center text-sm text-zinc-600">
        Edits are autosaved in this browser. Use download when you want to
        update <code>data/memories.json</code> in the project permanently.
      </div>
    </div>
  );
}

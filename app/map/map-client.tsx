"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Memory, MemoryCluster } from "@/components/types";
import { Card } from "@/components/ui";
import { TimelineSlider } from "@/components/TimelineSlider";
import { byDateAsc, clusterMemoriesByDistance, withinRange } from "@/components/utils";
import { MemoryModal } from "@/components/MemoryModal";
import { applyDraftToMemories, loadDraftMemories } from "@/components/memoryDraft";

const MapView = dynamic(() => import("@/components/MapView").then((m) => m.MapView), { ssr: false });

type MemoriesJson = Memory[];

export function MapClient() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string | undefined>(undefined);
  const [timelineStart, setTimelineStart] = useState<string>("");
  const [timelineEnd, setTimelineEnd] = useState<string>("");
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;

    const load = async () => {
      setStatus("loading");
      try {
        const res = await fetch("/data/memories.json", { cache: "no-store" });
        if (!res.ok) throw new Error(`Failed to load memories (${res.status})`);
        const data = (await res.json()) as MemoriesJson;
        if (!alive) return;
        const base = (Array.isArray(data) ? data : []).slice().sort(byDateAsc);
        const withDraft = applyDraftToMemories(base, loadDraftMemories()).slice().sort(byDateAsc);
        setMemories(withDraft);
        const dated = withDraft.map((m) => m.date).filter(Boolean);
        setTimelineStart(dated[0] ?? "");
        setTimelineEnd(dated.slice(-1)[0] ?? "");
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

  const filtered = useMemo(() => {
    if (!timelineStart && !timelineEnd) return memories;
    return memories.filter((m) => !m.date || withinRange(m.date, timelineStart, timelineEnd));
  }, [memories, timelineStart, timelineEnd]);

  const clustered = useMemo<MemoryCluster[]>(
    () => clusterMemoriesByDistance(filtered, 220),
    [filtered]
  );

  const selectedCluster = useMemo(
    () => clustered.find((c) => c.locationId === selectedLocationId),
    [clustered, selectedLocationId]
  );

  if (status === "loading") {
    return (
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="h-[62vh] min-h-[420px] animate-pulse rounded-3xl bg-white/55 ring-1 ring-white/60" />
        <Card className="p-4">
          <div className="h-4 w-24 animate-pulse rounded bg-zinc-200/70" />
          <div className="mt-3 h-2 w-full animate-pulse rounded bg-zinc-200/70" />
          <div className="mt-2 h-2 w-5/6 animate-pulse rounded bg-zinc-200/70" />
        </Card>
      </div>
    );
  }

  if (status === "error") {
    return (
      <Card className="p-5">
        <div className="text-sm font-semibold text-violet-700">Could not load your memories map.</div>
        <div className="mt-1 text-sm text-zinc-600">Check that <code>/public/data/memories.json</code> exists and is valid JSON.</div>
        <button
          type="button"
          onClick={() => setReloadKey((v) => v + 1)}
          className="mt-3 inline-flex items-center rounded-full bg-violet-500 px-4 py-2 text-sm font-medium text-white hover:bg-violet-600"
        >
          Retry
        </button>
      </Card>
    );
  }

  if (!memories.length) {
    return (
      <Card className="p-5">
        <div className="text-sm font-semibold text-zinc-900">No memories yet.</div>
        <div className="mt-1 text-sm text-zinc-600">Add photos to <code>/public/photos</code>, run <code>npm run memories:extract</code>, then come back.</div>
        <Link
          href="/review"
          className="mt-3 inline-flex items-center rounded-full bg-white/80 px-4 py-2 text-sm font-medium text-violet-700 ring-1 ring-white/70 hover:bg-white"
        >
          Open Metadata Review
        </Link>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-3">
        <div className="text-xs tracking-[0.2em] text-zinc-500 uppercase">
          {clustered.length} places pinned
        </div>
      </div>

      <div className="rounded-[2rem] bg-white/70 p-2 shadow-[0_24px_60px_-40px_rgba(0,0,0,0.4)] ring-1 ring-white/60 backdrop-blur">
        <div className="relative z-0 h-[62vh] min-h-[420px] overflow-hidden rounded-[1.6rem]">
          <MapView
            memories={filtered}
            selectedId={selectedLocationId}
            onSelect={(locationId) => setSelectedLocationId(locationId)}
            groupNearby
            groupDistanceMeters={220}
            coupleMode={false}
            posterMode={false}
            className="h-full"
          />
        </div>
      </div>

      <Card className="p-4">
        <div className="text-sm font-semibold">Timeline</div>
        <div className="mt-3">
          <TimelineSlider
            memories={memories}
            startValue={timelineStart}
            endValue={timelineEnd}
            onChange={(startDate, endDate) => {
              setTimelineStart(startDate);
              setTimelineEnd(endDate);
            }}
          />
        </div>
        <div className="mt-3 text-xs text-zinc-600">
          Showing <span className="font-medium">{filtered.length}</span> memories in{" "}
          <span className="font-medium">{clustered.length}</span> locations.
        </div>
      </Card>

      <MemoryModal
        open={!!selectedLocationId}
        cluster={selectedCluster}
        onClose={() => setSelectedLocationId(undefined)}
      />
    </div>
  );
}

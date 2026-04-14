"use client";

import Image from "next/image";
import { useMemo } from "react";
import type { Memory } from "./types";
import { Card, Pill } from "./ui";
import dynamic from "next/dynamic";
import { LocationSearch } from "./LocationSearch";

const MapView = dynamic(() => import("./MapView").then((m) => m.MapView), { ssr: false });

export function MemoryEditorCard({
  memory,
  onChange,
  onResetToOriginal,
}: {
  memory: Memory;
  onChange: (next: Memory) => void;
  onResetToOriginal?: () => void;
}) {
  const missingDate = !memory.date;
  const missingLoc = memory.latitude == null || memory.longitude == null;
  const missingName = !memory.locationName;

  const miniMem = useMemo(
    () => [
      {
        id: memory.id,
        file: memory.file,
        latitude: memory.latitude,
        longitude: memory.longitude,
        locationName: memory.locationName,
        date: "",
        caption: "",
      },
    ],
    [memory.id, memory.file, memory.latitude, memory.longitude, memory.locationName]
  );

  return (
    <Card className={"p-4 " + (memory.needsReview ? "ring-2 ring-violet-300" : "") }>
      <div className="grid gap-4 md:grid-cols-[220px_1fr]">
        <div>
          <Image
            src={memory.file}
            alt={memory.locationName ? `Memory at ${memory.locationName}` : "Memory photo"}
            width={640}
            height={512}
            sizes="(max-width: 768px) 100vw, 220px"
            className="h-48 w-full rounded-2xl object-cover ring-1 ring-black/5 md:h-56"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            {memory.needsReview ? <Pill className="bg-violet-500/10">Needs review</Pill> : <Pill>Ready</Pill>}
            {memory.isEdited ? <Pill className="bg-purple-500/10 text-purple-800 ring-purple-500/15">Edited</Pill> : null}
            {missingDate ? <Pill className="bg-amber-500/10 text-amber-800 ring-amber-500/10">Missing date</Pill> : null}
            {missingLoc ? <Pill className="bg-amber-500/10 text-amber-800 ring-amber-500/10">Missing pin</Pill> : null}
            {missingName ? <Pill className="bg-amber-500/10 text-amber-800 ring-amber-500/10">Missing place</Pill> : null}
          </div>
        </div>

        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <div className="mb-1 text-xs font-medium text-zinc-700">Date</div>
              <input
                type="date"
                value={memory.date}
                onChange={(e) => onChange({ ...memory, date: e.target.value })}
                className={
                  "w-full rounded-2xl bg-white/70 px-3 py-2 text-sm ring-1 ring-white/60 focus:outline-none focus:ring-2 focus:ring-violet-300 " +
                  (missingDate ? "ring-2 ring-amber-300" : "")
                }
              />
            </label>

            <label className="block">
              <div className="mb-1 text-xs font-medium text-zinc-700">Caption</div>
              <input
                value={memory.caption}
                onChange={(e) => onChange({ ...memory, caption: e.target.value })}
                placeholder="A tiny note you’ll smile at later…"
                className="w-full rounded-2xl bg-white/70 px-3 py-2 text-sm ring-1 ring-white/60 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-violet-300"
              />
            </label>
          </div>

          <div>
            <div className="mb-1 text-xs font-medium text-zinc-700">Location</div>
            <LocationSearch
              value={memory.locationName}
              onPick={(name, lat, lon) =>
                onChange({
                  ...memory,
                  locationName: name,
                  latitude: lat,
                  longitude: lon,
                })
              }
            />
          </div>

          <div className="h-56">
            <MapView
              key={memory.id}
              memories={miniMem}
              onPickLocation={(lat, lon) =>
                onChange({
                  ...memory,
                  latitude: lat,
                  longitude: lon,
                  locationName: memory.locationName || "",
                })
              }
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <div className="mb-1 text-xs font-medium text-zinc-700">Latitude</div>
              <input
                inputMode="decimal"
                value={memory.latitude ?? ""}
                onChange={(e) =>
                  onChange({
                    ...memory,
                    latitude: e.target.value ? Number(e.target.value) : null,
                  })
                }
                className={
                  "w-full rounded-2xl bg-white/70 px-3 py-2 text-sm ring-1 ring-white/60 focus:outline-none focus:ring-2 focus:ring-violet-300 " +
                  (missingLoc ? "ring-2 ring-amber-300" : "")
                }
              />
            </label>
            <label className="block">
              <div className="mb-1 text-xs font-medium text-zinc-700">Longitude</div>
              <input
                inputMode="decimal"
                value={memory.longitude ?? ""}
                onChange={(e) =>
                  onChange({
                    ...memory,
                    longitude: e.target.value ? Number(e.target.value) : null,
                  })
                }
                className={
                  "w-full rounded-2xl bg-white/70 px-3 py-2 text-sm ring-1 ring-white/60 focus:outline-none focus:ring-2 focus:ring-violet-300 " +
                  (missingLoc ? "ring-2 ring-amber-300" : "")
                }
              />
            </label>
          </div>

          <div className="text-xs text-zinc-500">
            Changes are kept in your browser for this session. Use “Download updated memories.json”.
          </div>
          {onResetToOriginal ? (
            <button
              type="button"
              className="inline-flex items-center rounded-full bg-white/70 px-3 py-1.5 text-xs font-medium text-zinc-700 ring-1 ring-white/60 hover:bg-white"
              onClick={onResetToOriginal}
            >
              Reset to original metadata
            </button>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

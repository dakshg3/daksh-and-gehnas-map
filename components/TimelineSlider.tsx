"use client";

import { motion } from "framer-motion";
import { useMemo } from "react";
import type { Memory } from "./types";
import { getDateRange } from "./utils";

export function TimelineSlider({
  memories,
  startValue,
  endValue,
  onChange,
}: {
  memories: Memory[];
  startValue: string;
  endValue: string;
  onChange: (startDate: string, endDate: string) => void;
}) {
  const range = useMemo(() => getDateRange(memories), [memories]);

  const dates = useMemo(() => {
    const uniq = Array.from(new Set(memories.map((m) => m.date).filter(Boolean)));
    uniq.sort();
    return uniq;
  }, [memories]);

  const maxIdx = Math.max(0, dates.length - 1);

  const rawStartIdx = dates.indexOf(startValue);
  const rawEndIdx = dates.indexOf(endValue);
  const startIdx = rawStartIdx >= 0 ? rawStartIdx : 0;
  const endIdx = rawEndIdx >= 0 ? rawEndIdx : maxIdx;
  const safeStartIdx = Math.min(startIdx, endIdx);
  const safeEndIdx = Math.max(startIdx, endIdx);

  const startPct = maxIdx <= 0 ? 0 : (safeStartIdx / maxIdx) * 100;
  const endPct = maxIdx <= 0 ? 100 : (safeEndIdx / maxIdx) * 100;

  return (
    <div className="w-full">
      <div className="mb-2 flex items-center justify-between text-xs text-zinc-600">
        <span>{range.min || "—"}</span>
        <span>Filter range</span>
        <span>{range.max || "—"}</span>
      </div>

      <div className="relative">
        <div className="h-2 rounded-full bg-white/70 ring-1 ring-white/60" />
        <motion.div
          className="absolute left-0 top-0 h-2 rounded-full bg-gradient-to-r from-violet-400 via-purple-400 to-indigo-300"
          initial={false}
          animate={{ left: `${startPct}%`, width: `${Math.max(2, endPct - startPct)}%` }}
          transition={{ type: "spring", stiffness: 140, damping: 20 }}
        />
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <label className="block">
          <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
            Start
          </div>
          <input
            className="timeline-range w-full appearance-none bg-transparent"
            type="range"
            aria-label="Start date"
            aria-valuetext={dates[safeStartIdx] || "No start date selected"}
            min={0}
            max={safeEndIdx}
            step={1}
            value={safeStartIdx}
            disabled={maxIdx <= 0}
            onChange={(e) => {
              const nextStart = Number(e.target.value);
              const startDate = dates[nextStart] ?? "";
              const endDate = dates[safeEndIdx] ?? "";
              if (startDate && endDate) onChange(startDate, endDate);
            }}
          />
        </label>

        <label className="block">
          <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
            End
          </div>
          <input
            className="timeline-range w-full appearance-none bg-transparent"
            type="range"
            aria-label="End date"
            aria-valuetext={dates[safeEndIdx] || "No end date selected"}
            min={safeStartIdx}
            max={maxIdx}
            step={1}
            value={safeEndIdx}
            disabled={maxIdx <= 0}
            onChange={(e) => {
              const nextEnd = Number(e.target.value);
              const startDate = dates[safeStartIdx] ?? "";
              const endDate = dates[nextEnd] ?? "";
              if (startDate && endDate) onChange(startDate, endDate);
            }}
          />
        </label>
      </div>

      <div className="mt-2 text-center text-sm font-medium text-zinc-800">
        {(dates[safeStartIdx] || "") + "  —  " + (dates[safeEndIdx] || "")}
      </div>
    </div>
  );
}

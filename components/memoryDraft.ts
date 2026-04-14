import type { Memory } from "./types";

export const MEMORIES_DRAFT_KEY = "dg-memories-draft-v1";

function normalizeMemory(entry: Memory): Memory {
  return {
    ...entry,
    detectedDate: entry.detectedDate ?? entry.date ?? "",
    detectedLatitude: entry.detectedLatitude ?? entry.latitude ?? null,
    detectedLongitude: entry.detectedLongitude ?? entry.longitude ?? null,
    detectedLocationName: entry.detectedLocationName ?? entry.locationName ?? "",
  };
}

export function loadDraftMemories(): Memory[] | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(MEMORIES_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed as Memory[];
  } catch {
    return null;
  }
}

export function saveDraftMemories(memories: Memory[]) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(MEMORIES_DRAFT_KEY, JSON.stringify(memories));
  } catch {
    // Ignore quota/private-mode failures; draft persistence is best-effort.
  }
}

export function clearDraftMemories() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(MEMORIES_DRAFT_KEY);
  } catch {
    // no-op
  }
}

export function applyDraftToMemories(base: Memory[], draft: Memory[] | null): Memory[] {
  if (!draft?.length) return base;

  const baseById = new Map(base.map((m) => [m.id, m]));
  const used = new Set<string>();
  const merged: Memory[] = [];

  for (const draftEntry of draft) {
    const baseEntry = baseById.get(draftEntry.id);
    if (!baseEntry) continue;

    used.add(draftEntry.id);
    merged.push(
      normalizeMemory({
        ...baseEntry,
        ...draftEntry,
      })
    );
  }

  for (const baseEntry of base) {
    if (!used.has(baseEntry.id)) {
      merged.push(normalizeMemory(baseEntry));
    }
  }

  return merged;
}

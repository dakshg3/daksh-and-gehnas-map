import type { Memory } from "./types";

export const MEMORIES_DRAFT_KEY = "dg-memories-draft-v1";

type DraftMemory = Pick<
  Memory,
  "id" | "file" | "date" | "latitude" | "longitude" | "locationName" | "caption" | "isEdited"
>;

function sameCoord(a: number | null | undefined, b: number | null | undefined) {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return Math.abs(a - b) < 1e-7;
}

function isEditedInDraft(entry: Memory) {
  const detectedDate = entry.detectedDate ?? "";
  const detectedLat = entry.detectedLatitude ?? null;
  const detectedLon = entry.detectedLongitude ?? null;
  const detectedLocationName = entry.detectedLocationName ?? "";

  return (
    (entry.date || "") !== detectedDate ||
    !sameCoord(entry.latitude, detectedLat) ||
    !sameCoord(entry.longitude, detectedLon) ||
    (entry.locationName || "") !== detectedLocationName ||
    Boolean((entry.caption || "").trim()) ||
    Boolean(entry.isEdited)
  );
}

function draftKey(entry: Pick<Memory, "id" | "file">) {
  return `${entry.id}|${entry.file}`;
}

function toDraftMemory(entry: Memory): DraftMemory {
  return {
    id: entry.id,
    file: entry.file,
    date: entry.date,
    latitude: entry.latitude,
    longitude: entry.longitude,
    locationName: entry.locationName,
    caption: entry.caption,
    isEdited: entry.isEdited,
  };
}

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
    const draft = memories.filter(isEditedInDraft).map(toDraftMemory);
    if (!draft.length) {
      window.localStorage.removeItem(MEMORIES_DRAFT_KEY);
      return;
    }
    window.localStorage.setItem(MEMORIES_DRAFT_KEY, JSON.stringify(draft));
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

  const baseById = new Map(base.map((m) => [draftKey(m), m]));
  const used = new Set<string>();
  const merged: Memory[] = [];

  for (const draftEntry of draft) {
    const key = draftKey(draftEntry);
    const baseEntry = baseById.get(key);
    if (!baseEntry) continue;

    used.add(key);
    merged.push(
      normalizeMemory({
        ...baseEntry,
        ...draftEntry,
      })
    );
  }

  for (const baseEntry of base) {
    if (!used.has(draftKey(baseEntry))) {
      merged.push(normalizeMemory(baseEntry));
    }
  }

  return merged;
}

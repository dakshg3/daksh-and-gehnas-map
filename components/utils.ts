import type { Memory, MemoryCluster } from "./types";

export function byDateAsc(a: Memory, b: Memory) {
  return (a.date || "9999-99-99").localeCompare(b.date || "9999-99-99");
}

export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function getDateRange(memories: Memory[]) {
  const dates = memories.map((m) => m.date).filter(Boolean).sort();
  return {
    min: dates[0] ?? "",
    max: dates[dates.length - 1] ?? "",
  };
}

export function withinRange(date: string, min: string, max: string) {
  if (!date) return false;
  if (min && date < min) return false;
  if (max && date > max) return false;
  return true;
}

export function formatPrettyDate(date: string) {
  if (!date) return "";
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) return date;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const EARTH_RADIUS_M = 6_371_000;

function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}

export function haversineMeters(
  aLat: number,
  aLon: number,
  bLat: number,
  bLon: number
) {
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);

  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return EARTH_RADIUS_M * c;
}

function sameCoord(a: number | null | undefined, b: number | null | undefined) {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return Math.abs(a - b) < 1e-7;
}

type MutableCluster = {
  latitude: number;
  longitude: number;
  photos: Memory[];
};

function pickClusterLocationName(cluster: MutableCluster) {
  const counts = new Map<string, number>();
  for (const p of cluster.photos) {
    const name = (p.locationName || "").trim();
    if (!name) continue;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }

  let best = "";
  let bestCount = -1;
  for (const [name, count] of counts) {
    if (count > bestCount) {
      best = name;
      bestCount = count;
    }
  }
  return best;
}

export function clusterMemoriesByDistance(
  memories: Memory[],
  maxDistanceMeters = 220
): MemoryCluster[] {
  const withCoords = memories
    .filter((m) => m.latitude != null && m.longitude != null)
    .slice()
    .sort(byDateAsc);

  const clusters: MutableCluster[] = [];

  for (const memory of withCoords) {
    const lat = memory.latitude!;
    const lon = memory.longitude!;

    let nearestIndex = -1;
    let nearestDistance = Number.POSITIVE_INFINITY;

    for (let i = 0; i < clusters.length; i++) {
      const c = clusters[i];
      const d = haversineMeters(lat, lon, c.latitude, c.longitude);
      if (d < nearestDistance) {
        nearestDistance = d;
        nearestIndex = i;
      }
    }

    if (nearestIndex !== -1 && nearestDistance <= maxDistanceMeters) {
      const c = clusters[nearestIndex];
      c.photos.push(memory);
      const n = c.photos.length;
      c.latitude = c.latitude + (lat - c.latitude) / n;
      c.longitude = c.longitude + (lon - c.longitude) / n;
    } else {
      clusters.push({ latitude: lat, longitude: lon, photos: [memory] });
    }
  }

  return clusters.map((cluster) => {
    const photos = cluster.photos.slice().sort(byDateAsc);
    const locationId = `loc-${photos.map((p) => p.id).sort()[0] ?? "unknown"}`;
    const locationName = pickClusterLocationName(cluster) || photos[0]?.locationName || "";

    return {
      locationId,
      latitude: cluster.latitude,
      longitude: cluster.longitude,
      locationName,
      photos,
    };
  });
}

export function isEditedComparedToDetected(memory: Memory) {
  const detectedDate = memory.detectedDate ?? "";
  const detectedLocationName = memory.detectedLocationName ?? "";
  const detectedLat = memory.detectedLatitude ?? null;
  const detectedLon = memory.detectedLongitude ?? null;

  const dateEdited = (memory.date || "") !== detectedDate;
  const nameEdited = (memory.locationName || "") !== detectedLocationName;
  const latEdited = !sameCoord(memory.latitude, detectedLat);
  const lonEdited = !sameCoord(memory.longitude, detectedLon);
  const captionEdited = Boolean((memory.caption || "").trim());

  return dateEdited || nameEdited || latEdited || lonEdited || captionEdited;
}

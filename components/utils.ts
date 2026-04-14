import type { Memory, MemoryCluster } from "./types";

export function byDateAsc(a: Memory, b: Memory) {
  return (a.date || "9999-99-99").localeCompare(b.date || "9999-99-99");
}

export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
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
  cellX: number;
  cellY: number;
};

function getCellFor(lat: number, lon: number, cellSizeMeters: number) {
  const latRad = toRad(lat);
  const lonRad = toRad(lon);

  // Approximate world position in meters for fast neighborhood bucketing.
  const xMeters = EARTH_RADIUS_M * lonRad * Math.cos(latRad);
  const yMeters = EARTH_RADIUS_M * latRad;

  return {
    cellX: Math.floor(xMeters / cellSizeMeters),
    cellY: Math.floor(yMeters / cellSizeMeters),
  };
}

function cellKey(x: number, y: number) {
  return `${x}:${y}`;
}

function addClusterToCell(
  grid: Map<string, Set<number>>,
  x: number,
  y: number,
  index: number
) {
  const key = cellKey(x, y);
  const bucket = grid.get(key);
  if (bucket) {
    bucket.add(index);
    return;
  }
  grid.set(key, new Set([index]));
}

function removeClusterFromCell(
  grid: Map<string, Set<number>>,
  x: number,
  y: number,
  index: number
) {
  const key = cellKey(x, y);
  const bucket = grid.get(key);
  if (!bucket) return;
  bucket.delete(index);
  if (!bucket.size) grid.delete(key);
}

function hashString(input: string) {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

function buildClusterLocationId(cluster: MutableCluster, photos: Memory[]) {
  const identitySource = photos
    .map((p) => `${p.id}|${p.file}`)
    .sort()
    .join("~");
  const latBucket = Math.round(cluster.latitude * 1e5);
  const lonBucket = Math.round(cluster.longitude * 1e5);
  return `loc-${hashString(identitySource)}-${latBucket}-${lonBucket}`;
}

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
  const cellSizeMeters = Math.max(1, maxDistanceMeters);
  const withCoords = memories
    .filter((m) => m.latitude != null && m.longitude != null)
    .slice()
    .sort(byDateAsc);

  const clusters: MutableCluster[] = [];
  const grid = new Map<string, Set<number>>();

  for (const memory of withCoords) {
    const lat = memory.latitude!;
    const lon = memory.longitude!;
    const originCell = getCellFor(lat, lon, cellSizeMeters);

    let nearestIndex = -1;
    let nearestDistance = Number.POSITIVE_INFINITY;

    const candidateIndices = new Set<number>();
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const bucket = grid.get(cellKey(originCell.cellX + dx, originCell.cellY + dy));
        if (!bucket) continue;
        for (const idx of bucket) candidateIndices.add(idx);
      }
    }

    for (const idx of candidateIndices) {
      const c = clusters[idx];
      const d = haversineMeters(lat, lon, c.latitude, c.longitude);
      if (d < nearestDistance) {
        nearestDistance = d;
        nearestIndex = idx;
      }
    }

    if (nearestIndex !== -1 && nearestDistance <= maxDistanceMeters) {
      const c = clusters[nearestIndex];
      const prevCellX = c.cellX;
      const prevCellY = c.cellY;

      c.photos.push(memory);
      const n = c.photos.length;
      c.latitude = c.latitude + (lat - c.latitude) / n;
      c.longitude = c.longitude + (lon - c.longitude) / n;

      const nextCell = getCellFor(c.latitude, c.longitude, cellSizeMeters);
      if (nextCell.cellX !== prevCellX || nextCell.cellY !== prevCellY) {
        c.cellX = nextCell.cellX;
        c.cellY = nextCell.cellY;
        removeClusterFromCell(grid, prevCellX, prevCellY, nearestIndex);
        addClusterToCell(grid, c.cellX, c.cellY, nearestIndex);
      }
    } else {
      const clusterIndex = clusters.length;
      clusters.push({
        latitude: lat,
        longitude: lon,
        photos: [memory],
        cellX: originCell.cellX,
        cellY: originCell.cellY,
      });
      addClusterToCell(grid, originCell.cellX, originCell.cellY, clusterIndex);
    }
  }

  return clusters.map((cluster) => {
    const photos = cluster.photos.slice().sort(byDateAsc);
    const locationId = buildClusterLocationId(cluster, photos);
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

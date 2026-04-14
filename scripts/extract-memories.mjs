#!/usr/bin/env node
/**
 * Our Story Map – preprocessing with merge-safe regeneration.
 *
 * - Scans /public/photos for image files
 * - Extracts EXIF date + GPS
 * - Reverse geocodes coordinates
 * - Merges with existing memories.json by stable photo ID
 * - Preserves manual edits (date/location/caption)
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { exiftool } from "exiftool-vendored";
import pLimit from "p-limit";

const root = process.cwd();
const photosDir = path.join(root, "public", "photos");
const outFile = path.join(root, "data", "memories.json");
const publicOutFile = path.join(root, "public", "data", "memories.json");
const SKIP_REVERSE_GEOCODE = process.env.MEMORIES_SKIP_REVERSE_GEOCODE === "1";
const GEOCODE_DELAY_MS = Number(process.env.MEMORIES_GEOCODE_DELAY_MS ?? "1100");

const IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".heic", ".webp"]);

function toIsoDate(dateTimeOriginal) {
  if (!dateTimeOriginal) return "";
  if (dateTimeOriginal instanceof Date) return dateTimeOriginal.toISOString().slice(0, 10);
  const s = String(dateTimeOriginal);
  const m = s.match(/(\d{4})[:/-](\d{2})[:/-](\d{2})/);
  if (!m) return "";
  return `${m[1]}-${m[2]}-${m[3]}`;
}

function normalizeGps(lat, lon) {
  const latitude = typeof lat === "number" ? lat : null;
  const longitude = typeof lon === "number" ? lon : null;
  return { latitude, longitude };
}

function sameCoord(a, b) {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return Math.abs(a - b) < 1e-7;
}

function listImagesRecursive(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...listImagesRecursive(p));
    else {
      const ext = path.extname(ent.name).toLowerCase();
      if (IMAGE_EXTS.has(ext)) out.push(p);
    }
  }
  return out;
}

async function hashFile(absPath) {
  return await new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha1");
    const stream = fs.createReadStream(absPath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(hash.digest("hex").slice(0, 16)));
  });
}

async function reverseGeocode(latitude, longitude) {
  if (latitude == null || longitude == null) return "";

  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("lat", String(latitude));
  url.searchParams.set("lon", String(longitude));
  url.searchParams.set("zoom", "10");
  url.searchParams.set("addressdetails", "1");

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "our-story-map/1.0 (local preprocessing)",
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const a = data.address || {};
    const city = a.city || a.town || a.village || a.hamlet || a.county || "";
    const country = a.country || "";
    const label = [city, country].filter(Boolean).join(", ");
    return label || data.display_name || "";
  } catch {
    return `(${latitude.toFixed(3)}, ${longitude.toFixed(3)})`;
  }
}

function geocodeKey(latitude, longitude) {
  // Round slightly so near-identical EXIF values share one lookup.
  return `${latitude.toFixed(5)},${longitude.toFixed(5)}`;
}

function readMemoriesIfExists(filePath) {
  if (!fs.existsSync(filePath)) return [];
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeEntry(entry) {
  return {
    id: String(entry.id || ""),
    file: String(entry.file || ""),
    latitude: typeof entry.latitude === "number" ? entry.latitude : null,
    longitude: typeof entry.longitude === "number" ? entry.longitude : null,
    locationName: String(entry.locationName || ""),
    date: String(entry.date || ""),
    caption: String(entry.caption || ""),
    detectedLatitude: typeof entry.detectedLatitude === "number" ? entry.detectedLatitude : null,
    detectedLongitude: typeof entry.detectedLongitude === "number" ? entry.detectedLongitude : null,
    detectedLocationName: typeof entry.detectedLocationName === "string" ? entry.detectedLocationName : "",
    detectedDate: typeof entry.detectedDate === "string" ? entry.detectedDate : "",
    isEdited: Boolean(entry.isEdited),
  };
}

function choosePreferred(existing, candidate) {
  if (!existing) return candidate;
  if (candidate.isEdited && !existing.isEdited) return candidate;
  if ((candidate.caption || "").trim() && !(existing.caption || "").trim()) return candidate;
  return existing;
}

function buildExistingMap() {
  const map = new Map();
  const sources = [publicOutFile, outFile];

  for (const source of sources) {
    const entries = readMemoriesIfExists(source).map(normalizeEntry);
    for (const entry of entries) {
      if (!entry.id) continue;
      map.set(entry.id, choosePreferred(map.get(entry.id), entry));
    }
  }

  return map;
}

function mergeWithExisting(base, existing) {
  if (!existing) {
    const needsReview =
      !base.date ||
      base.latitude == null ||
      base.longitude == null ||
      !base.locationName;

    return {
      ...base,
      caption: "",
      isEdited: false,
      needsReview,
    };
  }

  const hasLegacyDetected =
    Boolean(existing.detectedDate) ||
    Boolean(existing.detectedLocationName) ||
    existing.detectedLatitude != null ||
    existing.detectedLongitude != null;

  const inferredDateEdited = hasLegacyDetected
    ? existing.date !== (existing.detectedDate || "")
    : Boolean(existing.date) && existing.date !== base.date;

  const inferredLocationEdited = hasLegacyDetected
    ? existing.locationName !== (existing.detectedLocationName || "") ||
      !sameCoord(existing.latitude, existing.detectedLatitude) ||
      !sameCoord(existing.longitude, existing.detectedLongitude)
    : (Boolean(existing.locationName) && existing.locationName !== base.locationName) ||
      !sameCoord(existing.latitude, base.latitude) ||
      !sameCoord(existing.longitude, base.longitude);

  const inferredCaptionEdited = Boolean((existing.caption || "").trim());
  const edited = Boolean(existing.isEdited || inferredDateEdited || inferredLocationEdited || inferredCaptionEdited);

  const date = inferredDateEdited || existing.isEdited
    ? (existing.date || "")
    : (base.date || existing.date || "");

  const latitude = inferredLocationEdited || existing.isEdited
    ? (existing.latitude ?? null)
    : (base.latitude ?? existing.latitude ?? null);

  const longitude = inferredLocationEdited || existing.isEdited
    ? (existing.longitude ?? null)
    : (base.longitude ?? existing.longitude ?? null);

  const locationName = inferredLocationEdited || existing.isEdited
    ? (existing.locationName || "")
    : (base.locationName || existing.locationName || "");

  const caption = inferredCaptionEdited || existing.isEdited ? (existing.caption || "") : "";

  const needsReview = !date || latitude == null || longitude == null || !locationName;

  return {
    ...base,
    date,
    latitude,
    longitude,
    locationName,
    caption,
    isEdited: edited,
    needsReview,
  };
}

async function main() {
  if (!fs.existsSync(photosDir)) {
    console.error(`Missing photos dir: ${photosDir}`);
    process.exit(1);
  }

  const existingMap = buildExistingMap();

  const filesAbs = listImagesRecursive(photosDir);
  const filesRel = filesAbs
    .map((abs) => path.relative(path.join(root, "public"), abs))
    .map((rel) => rel.split(path.sep).join("/"));

  const limit = pLimit(1);
  const geocodeCache = new Map();
  const memories = [];

  for (const rel of filesRel) {
    const abs = path.join(root, "public", rel);
    const id = await hashFile(abs);
    const exif = await exiftool.read(abs).catch(() => ({}));

    const detectedDate = toIsoDate(exif.DateTimeOriginal || exif.CreateDate || exif.ModifyDate);
    const { latitude: detectedLatitude, longitude: detectedLongitude } = normalizeGps(
      exif.GPSLatitude,
      exif.GPSLongitude
    );

    let detectedLocationName = "";
    if (!SKIP_REVERSE_GEOCODE && detectedLatitude != null && detectedLongitude != null) {
      const key = geocodeKey(detectedLatitude, detectedLongitude);
      const cached = geocodeCache.get(key);
      if (typeof cached === "string") {
        detectedLocationName = cached;
      } else {
        detectedLocationName = await limit(async () => {
          await new Promise((r) => setTimeout(r, GEOCODE_DELAY_MS));
          return reverseGeocode(detectedLatitude, detectedLongitude);
        });
        geocodeCache.set(key, detectedLocationName);
      }
    }

    const base = {
      id,
      file: `/${rel}`.replace(/^\/\//, "/"),
      date: detectedDate,
      latitude: detectedLatitude,
      longitude: detectedLongitude,
      locationName: detectedLocationName,
      detectedDate,
      detectedLatitude,
      detectedLongitude,
      detectedLocationName,
    };

    const existing = existingMap.get(id);
    memories.push(mergeWithExisting(base, existing));
  }

  memories.sort((a, b) => (a.date || "9999-99-99").localeCompare(b.date || "9999-99-99"));

  for (const filePath of [outFile, publicOutFile]) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(memories, null, 2) + "\n", "utf8");
  }

  console.log(`Wrote ${memories.length} merged memories → ${path.relative(root, outFile)}`);
  console.log(`Synced static data → ${path.relative(root, publicOutFile)}`);
  if (SKIP_REVERSE_GEOCODE) {
    console.log("Reverse geocoding was skipped (MEMORIES_SKIP_REVERSE_GEOCODE=1).");
  }

  await exiftool.end();
}

main().catch(async (e) => {
  console.error(e);
  try {
    await exiftool.end();
  } finally {
    process.exit(1);
  }
});

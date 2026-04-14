"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  useMap,
  useMapEvents,
} from "react-leaflet";
import type { LeafletMouseEvent, LatLngExpression } from "leaflet";
import L from "leaflet";
import type { Memory, MemoryCluster } from "./types";
import { clusterMemoriesByDistance } from "./utils";

const CARTO_LIGHT_NO_LABELS = "https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png";
const CARTO_VOYAGER_NO_LABELS = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png";
const OSM_STANDARD = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const OVERLAP_ZOOM_STEP = 2;
const OVERLAP_MAX_ZOOM = 16;
const OVERLAP_PIXEL_THRESHOLD = 30;
const MARKER_CLICK_THROTTLE_MS = 220;
const SELECT_AFTER_FLY_FALLBACK_MS = 850;
const FLY_DURATION_SECONDS = 0.55;

const photoPinIconCache = new Map<string, L.DivIcon>();

function getPhotoPinIcon(
  previewFile: string | undefined,
  photoCount: number,
  posterMode: boolean
) {
  const safeFile = previewFile ? encodeURI(previewFile).replace(/'/g, "%27") : "";
  const key = `${safeFile}|${photoCount}|${posterMode ? "poster" : "normal"}`;
  if (photoPinIconCache.has(key)) return photoPinIconCache.get(key)!;

  const badge =
    photoCount > 1
      ? `<span style="
          position:absolute;
          right:-7px;
          top:-7px;
          min-width:18px;
          height:18px;
          border-radius:9999px;
          background:#ffffff;
          border:1px solid rgba(161,161,170,.45);
          color:#3f3f46;
          font-size:11px;
          font-weight:700;
          line-height:16px;
          text-align:center;
          padding:0 4px;
          box-shadow:0 8px 20px -12px rgba(0,0,0,.6);
        ">${photoCount}</span>`
      : "";

  const photoStyle = safeFile
    ? `background-image:url('${safeFile}');background-size:cover;background-position:center;`
    : "background:linear-gradient(135deg,#d4d4d8,#e5e7eb);";

  const icon = new L.DivIcon({
    className: "photo-pin-wrapper",
    html: `
      <div style="
        position:relative;
        width:44px;
        height:52px;
        display:flex;
        align-items:flex-start;
        justify-content:center;
      ">
        <div style="
          position:absolute;
          top:0;
          width:38px;
          height:38px;
          border-radius:9999px;
          border:2px solid rgba(255,255,255,.95);
          ${photoStyle}
          box-shadow:0 10px 18px -12px rgba(0,0,0,.55);
        "></div>
        <div style="
          position:absolute;
          top:30px;
          width:14px;
          height:14px;
          border-radius:3px;
          transform:rotate(45deg);
          background:${posterMode ? "rgba(161,161,170,.95)" : "rgba(167,139,250,.92)"};
          box-shadow:0 8px 16px -12px rgba(0,0,0,.5);
        "></div>
        ${badge}
      </div>
    `,
    iconSize: [44, 52],
    iconAnchor: [22, 52],
  });

  photoPinIconCache.set(key, icon);
  return icon;
}

function CaptureMap({ onReady }: { onReady: (map: L.Map) => void }) {
  const map = useMap();
  useEffect(() => {
    onReady(map);
  }, [map, onReady]);
  return null;
}

function EnsureMapSized() {
  const map = useMap();

  useEffect(() => {
    const tick = () => map.invalidateSize();
    tick();
    const t1 = window.setTimeout(tick, 120);
    const t2 = window.setTimeout(tick, 380);

    const onResize = () => map.invalidateSize();
    window.addEventListener("resize", onResize);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.removeEventListener("resize", onResize);
    };
  }, [map]);

  return null;
}

function ClickToSetMarker({ onPick }: { onPick?: (lat: number, lon: number) => void }) {
  useMapEvents({
    click(e: LeafletMouseEvent) {
      onPick?.(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function hasOverlappingLocation(
  map: L.Map,
  cluster: MemoryCluster,
  points: MemoryCluster[]
) {
  const clicked = map.latLngToLayerPoint([cluster.latitude, cluster.longitude]);
  return points.some((other) => {
    if (other.locationId === cluster.locationId) return false;
    const otherPoint = map.latLngToLayerPoint([other.latitude, other.longitude]);
    return clicked.distanceTo(otherPoint) <= OVERLAP_PIXEL_THRESHOLD;
  });
}

export function MapView({
  memories,
  precomputedClusters,
  selectedId,
  onSelect,
  onPickLocation,
  coupleMode = true,
  posterMode = false,
  showPath = false,
  groupNearby = false,
  groupDistanceMeters = 220,
  className = "",
}: {
  memories: Memory[];
  precomputedClusters?: MemoryCluster[];
  selectedId?: string;
  onSelect?: (locationId: string) => void;
  onPickLocation?: (lat: number, lon: number) => void;
  coupleMode?: boolean;
  posterMode?: boolean;
  showPath?: boolean;
  groupNearby?: boolean;
  groupDistanceMeters?: number;
  className?: string;
}) {
  const points = useMemo<MemoryCluster[]>(() => {
    if (precomputedClusters) return precomputedClusters;

    if (groupNearby) {
      return clusterMemoriesByDistance(memories, groupDistanceMeters);
    }
    return memories
      .filter((m) => m.latitude != null && m.longitude != null)
      .map((m) => ({
        locationId: `${m.id}|${m.file}`,
        latitude: m.latitude!,
        longitude: m.longitude!,
        locationName: m.locationName,
        photos: [m],
      }));
  }, [groupNearby, groupDistanceMeters, memories, precomputedClusters]);
  const mapRef = useRef<L.Map | null>(null);
  const lastMarkerClickAtRef = useRef(0);
  const lastMarkerIdRef = useRef<string | null>(null);
  const selectTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (selectTimeoutRef.current != null) {
        window.clearTimeout(selectTimeoutRef.current);
      }
    };
  }, []);

  const path = useMemo(() => {
    if (!showPath) return null;
    const coords = points
      .slice()
      .sort((a, b) => {
        const aDate = a.photos.find((p) => p.date)?.date || "9999-99-99";
        const bDate = b.photos.find((p) => p.date)?.date || "9999-99-99";
        return aDate.localeCompare(bDate);
      })
      .map((m) => [m.latitude, m.longitude] as [number, number]);
    return coords.length >= 2 ? coords : null;
  }, [points, showPath]);

  const center = (points[0]
    ? ([points[0].latitude, points[0].longitude] as [number, number])
    : ([20, 0] as [number, number])) satisfies LatLngExpression as unknown as [number, number];

  const tileAttribution = "&copy; OpenStreetMap contributors, &copy; CARTO";

  return (
    <div className={"relative overflow-hidden rounded-3xl ring-1 ring-white/50 " + className}>
      {posterMode ? (
        <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-b from-white/10 via-transparent to-zinc-200/12" />
      ) : coupleMode ? (
        <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-b from-violet-100/25 via-transparent to-indigo-100/20" />
      ) : null}
      <MapContainer
        className={
          (coupleMode ? "romantic-map" : "minimal-map") +
          (posterMode ? " poster-map" : "") +
          " z-0"
        }
        center={center}
        zoom={2}
        minZoom={1}
        maxZoom={18}
        scrollWheelZoom
        style={{ height: "100%", width: "100%" }}
      >
        <CaptureMap onReady={(map) => (mapRef.current = map)} />
        <EnsureMapSized />
        <ClickToSetMarker onPick={onPickLocation} />
        <TileLayer
          attribution={tileAttribution}
          url={CARTO_LIGHT_NO_LABELS}
          opacity={posterMode ? 0.92 : 0.86}
          eventHandlers={{
            tileerror: (e) => {
              const layer = e.target as L.TileLayer & { _url?: string };
              if (layer._url?.includes("light_nolabels")) {
                layer.setUrl(CARTO_VOYAGER_NO_LABELS);
                return;
              }
              if (layer._url?.includes("voyager_nolabels")) {
                layer.setUrl(OSM_STANDARD);
              }
            },
          }}
        />

        {path ? (
          <Polyline
            positions={path}
            pathOptions={{ color: "#8b5cf6", weight: 4, opacity: 0.72 }}
          />
        ) : null}

        {points.map((cluster) => (
          <Marker
            key={cluster.locationId}
            position={[cluster.latitude, cluster.longitude]}
            icon={getPhotoPinIcon(cluster.photos[0]?.file, cluster.photos.length, posterMode)}
            eventHandlers={{
              click: () => {
                const map = mapRef.current;
                const now = Date.now();

                if (!map) {
                  onSelect?.(cluster.locationId);
                  return;
                }

                const repeatedSameMarker =
                  lastMarkerIdRef.current === cluster.locationId &&
                  now - lastMarkerClickAtRef.current < MARKER_CLICK_THROTTLE_MS;

                if (repeatedSameMarker) return;

                lastMarkerClickAtRef.current = now;
                lastMarkerIdRef.current = cluster.locationId;

                if (selectTimeoutRef.current != null) {
                  window.clearTimeout(selectTimeoutRef.current);
                  selectTimeoutRef.current = null;
                }

                // Stop any in-progress fly animation before applying a new target.
                map.stop();

                const currentZoom = map.getZoom();
                const shouldZoomForOverlap =
                  hasOverlappingLocation(map, cluster, points) && currentZoom < OVERLAP_MAX_ZOOM;

                const nextZoom = shouldZoomForOverlap
                  ? Math.min(currentZoom + OVERLAP_ZOOM_STEP, OVERLAP_MAX_ZOOM)
                  : currentZoom;

                const target = L.latLng(cluster.latitude, cluster.longitude);
                const distanceToTarget = map.getCenter().distanceTo(target);
                const requiresMotion = nextZoom !== currentZoom || distanceToTarget > 4;
                const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

                if (!requiresMotion) {
                  if (!shouldZoomForOverlap) onSelect?.(cluster.locationId);
                  return;
                }

                const runFlyTo = () => {
                  map.flyTo([cluster.latitude, cluster.longitude], nextZoom, {
                    animate: !prefersReducedMotion,
                    duration: prefersReducedMotion ? 0 : FLY_DURATION_SECONDS,
                  });
                };

                runFlyTo();

                if (shouldZoomForOverlap) return;

                let selected = false;
                const selectOnce = () => {
                  if (selected) return;
                  selected = true;
                  if (selectTimeoutRef.current != null) {
                    window.clearTimeout(selectTimeoutRef.current);
                    selectTimeoutRef.current = null;
                  }
                  onSelect?.(cluster.locationId);
                };

                map.once("moveend", selectOnce);
                selectTimeoutRef.current = window.setTimeout(() => {
                  map.off("moveend", selectOnce);
                  selectOnce();
                }, SELECT_AFTER_FLY_FALLBACK_MS);
              },
            }}
            opacity={selectedId && selectedId !== cluster.locationId ? 0.75 : 1}
          />
        ))}
      </MapContainer>
    </div>
  );
}

"use client";

import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type {
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
} from "react";
import type { MemoryCluster } from "./types";
import { formatPrettyDate } from "./utils";

function ClusterCarousel({
  cluster,
  onClose,
}: {
  cluster: MemoryCluster;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  const startX = useRef<number | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  const total = cluster.photos.length;
  const safeIndex = total ? Math.max(0, Math.min(index, total - 1)) : 0;
  const current = cluster.photos[safeIndex];
  const nextPhoto = total > 1 ? cluster.photos[(safeIndex + 1) % total] : undefined;
  const prevPhoto = total > 1 ? cluster.photos[(safeIndex - 1 + total) % total] : undefined;

  function go(delta: number) {
    if (total <= 1) return;
    setIndex((prev) => (prev + delta + total) % total);
  }

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    startX.current = e.clientX;
  }

  function onPointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    if (startX.current == null) return;
    const dx = e.clientX - startX.current;
    startX.current = null;
    if (Math.abs(dx) < 40) return;
    if (dx < 0) go(1);
    else go(-1);
  }

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  useEffect(() => {
    if (total <= 1) return;
    const preloadFiles = [nextPhoto?.file, prevPhoto?.file].filter(Boolean) as string[];

    for (const src of preloadFiles) {
      const img = new window.Image();
      img.decoding = "async";
      img.loading = "eager";
      img.src = src;
    }
  }, [nextPhoto?.file, prevPhoto?.file, total]);

  function trapTabKey(e: ReactKeyboardEvent<HTMLDivElement>) {
    if (e.key !== "Tab") return;

    const root = dialogRef.current;
    if (!root) return;

    const focusables = root.querySelectorAll<HTMLElement>(
      'button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])'
    );
    if (!focusables.length) return;

    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;

    if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }

  function onDialogKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      go(-1);
      return;
    }
    if (e.key === "ArrowRight") {
      e.preventDefault();
      go(1);
      return;
    }
    trapTabKey(e);
  }

  if (!current) return null;

  return (
    <motion.div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={cluster.locationName || "Memory gallery"}
      tabIndex={-1}
      className="w-full max-w-none rounded-t-3xl bg-white/95 p-4 shadow-2xl ring-1 ring-white/60 sm:max-w-3xl sm:rounded-3xl"
      initial={{ y: 24, scale: 0.96, opacity: 0 }}
      animate={{ y: 0, scale: 1, opacity: 1 }}
      exit={{ y: 24, scale: 0.98, opacity: 0 }}
      transition={{ type: "spring", stiffness: 180, damping: 22 }}
      onKeyDown={onDialogKeyDown}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-lg font-semibold">{cluster.locationName || current.locationName || "A memory"}</div>
          <div className="text-sm text-zinc-600">{total} photo{total === 1 ? "" : "s"}</div>
        </div>
        <button
          aria-label="Close gallery"
          className="rounded-full bg-zinc-900/5 px-3 py-1 text-sm font-medium text-zinc-800 hover:bg-zinc-900/10"
          onClick={onClose}
        >
          Close
        </button>
      </div>

      <div
        className="relative mt-3 overflow-hidden rounded-2xl bg-zinc-100 ring-1 ring-black/5"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
      >
        <div className="flex h-[50vh] min-h-[280px] w-full items-center justify-center p-2 sm:h-[58vh]">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${current.id}|${current.file}`}
              className="relative h-full w-full"
              initial={{ opacity: 0, scale: 0.985 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.015 }}
              transition={{ duration: 0.2 }}
            >
              <Image
                src={current.file}
                alt={current.locationName ? `Memory at ${current.locationName}` : "Memory photo"}
                fill
                sizes="(max-width: 640px) 100vw, 960px"
                className="object-contain"
                priority={safeIndex === 0}
                loading={safeIndex === 0 ? "eager" : "lazy"}
              />
            </motion.div>
          </AnimatePresence>
        </div>

        {total > 1 ? (
          <>
            <button
              type="button"
              aria-label="Previous photo"
              onClick={() => go(-1)}
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/85 px-3 py-2 text-sm font-semibold text-zinc-700 shadow ring-1 ring-white/80 hover:bg-white"
            >
              ←
            </button>
            <button
              type="button"
              aria-label="Next photo"
              onClick={() => go(1)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/85 px-3 py-2 text-sm font-semibold text-zinc-700 shadow ring-1 ring-white/80 hover:bg-white"
            >
              →
            </button>
          </>
        ) : null}
      </div>

      {total > 1 ? (
        <div className="mt-3 flex items-center justify-center gap-1.5">
          {cluster.photos.map((p, i) => (
            <button
              key={`${p.id}|${p.file}`}
              type="button"
              aria-label={`Go to photo ${i + 1}`}
              onClick={() => setIndex(i)}
              className={
                "h-2.5 rounded-full transition-all " +
                (i === safeIndex ? "w-6 bg-violet-500" : "w-2.5 bg-violet-200 hover:bg-violet-300")
              }
            />
          ))}
        </div>
      ) : null}

      <div className="mt-3 space-y-1">
        <div className="text-sm font-medium text-zinc-700">
          {formatPrettyDate(current.date) || "Date missing"} • {safeIndex + 1}/{total}
        </div>
        <div className="text-sm text-zinc-500">{current.locationName || cluster.locationName || "Location missing"}</div>
        <div className="text-sm leading-relaxed text-zinc-800">
          {current.caption || "Add a caption to make this memory sparkle."}
        </div>
      </div>
    </motion.div>
  );
}

export function MemoryModal({
  open,
  cluster,
  onClose,
}: {
  open: boolean;
  cluster?: MemoryCluster;
  onClose: () => void;
}) {
  const canUseDOM = typeof document !== "undefined";

  useEffect(() => {
    if (!canUseDOM) return;
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [canUseDOM, open]);

  if (!canUseDOM) return null;

  return createPortal(
    <AnimatePresence>
      {open && cluster ? (
        <motion.div
          className="fixed inset-0 z-[999] flex items-end justify-center bg-black/45 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <ClusterCarousel key={cluster.locationId} cluster={cluster} onClose={onClose} />
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}

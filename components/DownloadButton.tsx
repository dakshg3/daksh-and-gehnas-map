"use client";

import { useCallback } from "react";
import type { Memory } from "./types";

export function DownloadButton({
  memories,
  filename = "memories.json",
  className = "",
}: {
  memories: Memory[];
  filename?: string;
  className?: string;
}) {
  const onDownload = useCallback(() => {
    const blob = new Blob([JSON.stringify(memories, null, 2) + "\n"], {
      type: "application/json",
    });
    const href = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = href;
    a.download = filename;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // Delay revoke a bit so Safari has enough time to start the download.
    window.setTimeout(() => URL.revokeObjectURL(href), 1500);
  }, [filename, memories]);

  return (
    <button
      type="button"
      className={
        "inline-flex items-center justify-center rounded-full bg-white/70 px-4 py-2 text-sm font-medium text-zinc-900 shadow-sm ring-1 ring-white/50 backdrop-blur hover:bg-white/90 " +
        className
      }
      onClick={onDownload}
    >
      Download updated {filename}
    </button>
  );
}

import Link from "next/link";
import { Cormorant_Garamond, Dancing_Script } from "next/font/google";
import { Container, PageShell, Pill } from "@/components/ui";
import { MapClient } from "./map-client";

const mapScript = Dancing_Script({ subsets: ["latin"], weight: ["700"] });
const mapSubtitle = Cormorant_Garamond({ subsets: ["latin"], weight: ["500"] });

export default function StoryMapPage() {
  return (
    <PageShell className="map-poster-shell">
      <Link
        href="/review"
        style={{ top: "max(0.75rem, env(safe-area-inset-top))" }}
        className="fixed right-4 z-40 inline-flex items-center rounded-full bg-white/80 px-4 py-2 text-sm font-medium text-violet-700 shadow-[0_14px_36px_-20px_rgba(0,0,0,0.45)] ring-1 ring-white/70 backdrop-blur transition hover:bg-white"
      >
        Edit Memories
      </Link>
      <Container className="py-8 sm:py-10">
        <div className="text-center">
          <Pill className="bg-zinc-900/5 text-zinc-700 ring-zinc-900/10">
            Daksh and Gehna
          </Pill>
          <h1 className={mapScript.className + " mt-4 text-5xl leading-none text-zinc-900 sm:text-7xl"}>
            Daksh &amp; Gehna
          </h1>
          <div className={mapSubtitle.className + " mt-2 text-xs uppercase tracking-[0.45em] text-zinc-600 sm:text-sm"}>
            Our Adventures
          </div>
        </div>

        <div className="mt-8">
          <MapClient />
        </div>
      </Container>
    </PageShell>
  );
}

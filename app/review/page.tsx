import Link from "next/link";
import { Container, PageShell, Card, Pill } from "@/components/ui";
import { ReviewClient } from "./review-client";

export default function ReviewPage() {
  return (
    <PageShell>
      <Link
        href="/map"
        style={{ top: "max(0.75rem, env(safe-area-inset-top))" }}
        className="fixed right-4 z-40 inline-flex items-center rounded-full bg-white/80 px-4 py-2 text-sm font-medium text-violet-700 shadow-[0_14px_36px_-20px_rgba(0,0,0,0.45)] ring-1 ring-white/70 backdrop-blur transition hover:bg-white"
      >
        Back to Map
      </Link>
      <Container className="py-8 sm:py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Pill>Metadata Review</Pill>
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              Make every memory find its place.
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-700 sm:text-base">
              Edit dates, search locations, or click on the map to drop a pin.
              Missing fields are highlighted.
            </p>
          </div>
          <Card className="p-3">
            <div className="text-xs text-zinc-600">
              Tip: run <code>npm run memories:extract</code> after adding photos.
            </div>
          </Card>
        </div>

        <div className="mt-6">
          <ReviewClient />
        </div>
      </Container>
    </PageShell>
  );
}

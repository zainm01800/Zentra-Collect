"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Error({ reset }: { reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
      <div
        className="size-10 rounded-full flex items-center justify-center"
        style={{ background: "var(--zn-risk-soft)" }}
      >
        <AlertTriangle className="size-5" style={{ color: "var(--zn-risk)" }} />
      </div>
      <div>
        <p className="text-[15px] font-semibold" style={{ color: "var(--zn-ink)" }}>
          MTD data failed to load
        </p>
        <p className="mt-1 text-[13px]" style={{ color: "var(--zn-ink-3)" }}>
          Could not load your Making Tax Digital summary. Try again.
        </p>
      </div>
      <Button
        onClick={reset}
        variant="outline"
        className="rounded-full border-black/10 dark:border-white/10 mt-1"
      >
        Retry
      </Button>
    </div>
  );
}

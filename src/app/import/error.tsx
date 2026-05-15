"use client";
import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

export default function ImportError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => { console.error("[import] boundary caught:", error); }, [error]);

  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl p-14 text-center"
      style={{ border: "1px solid var(--zn-line-soft)", background: "var(--zn-surface)" }}>
      <div className="size-12 rounded-2xl flex items-center justify-center"
        style={{ background: "var(--zn-risk-soft)" }}>
        <AlertTriangle className="size-5" style={{ color: "var(--zn-risk)" }} />
      </div>
      <div>
        <p className="text-[15px] font-semibold" style={{ color: "var(--zn-ink)" }}>
          Something went wrong during import
        </p>
        <p className="mt-1 text-[13px]" style={{ color: "var(--zn-ink-3)" }}>
          Your file was not saved. Please try again.
        </p>
      </div>
      <button onClick={reset} className="zn-pill text-[13px]">Try again</button>
    </div>
  );
}

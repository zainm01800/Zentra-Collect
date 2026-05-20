"use client";
import { useEffect } from "react";
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 text-center">
      <p className="text-[15px] font-medium" style={{ color: "var(--zn-ink)" }}>Something went wrong.</p>
      <button onClick={reset} className="zn-pill-btn text-[13px]">Try again</button>
    </div>
  );
}

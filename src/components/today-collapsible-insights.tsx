"use client";

/**
 * Collapsible "More insights" container for /today. Hides Payment
 * Patterns + future below-the-fold cards behind a single disclosure
 * so the default view stays focused. State persists in localStorage.
 */

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";

const KEY = "zn:today-insights-expanded:v1";

export function CollapsibleInsights({ children }: { children: React.ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(KEY);
    if (saved === "1") setExpanded(true);
  }, []);

  function toggle() {
    const next = !expanded;
    setExpanded(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(KEY, next ? "1" : "0");
    }
  }

  return (
    <div className="border-t pt-4" style={{ borderColor: "var(--zn-line-soft)" }}>
      <button
        type="button"
        onClick={toggle}
        className="flex items-center gap-2 text-[12.5px] font-semibold uppercase tracking-wider"
        style={{ color: "var(--zn-ink-3)" }}
      >
        <ChevronDown
          className="size-3.5 transition-transform"
          style={{ transform: expanded ? "rotate(0deg)" : "rotate(-90deg)" }}
        />
        More insights
      </button>
      {expanded && <div className="mt-4 flex flex-col gap-5">{children}</div>}
    </div>
  );
}

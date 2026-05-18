"use client";

/**
 * Tiny "X opens / Y clicks today" pill for the chase queue header.
 *
 * Reads from /api/track/open + /api/track/click event totals via the
 * recentEmailEventSummary server action. Renders nothing when there
 * are no events in the window — keeps the UI calm when there's
 * nothing to say.
 */

import { useEffect, useState } from "react";
import { Eye, MousePointer2 } from "lucide-react";
import { recentEmailEventSummary, type EmailEventSummary } from "@/actions/email-events";

export function EmailEventsPill({ windowHours = 24 }: { windowHours?: number }) {
  const [data, setData] = useState<EmailEventSummary | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await recentEmailEventSummary(windowHours);
        if (!cancelled) setData(r);
      } catch {
        if (!cancelled) setData(null);
      }
    })();
    return () => { cancelled = true; };
  }, [windowHours]);

  if (!data || (data.opens === 0 && data.clicks === 0)) return null;

  return (
    <div
      className="inline-flex items-center gap-3 rounded-full px-3 py-1.5 text-[11.5px]"
      style={{
        background: "var(--zn-surface-2)",
        border:     "1px solid var(--zn-line-soft)",
        color:      "var(--zn-ink-2)",
      }}
      title={`In the last ${data.windowHours}h`}
    >
      <span className="inline-flex items-center gap-1">
        <Eye className="size-3" style={{ color: "var(--zn-safe)" }} />
        <strong style={{ color: "var(--zn-ink)" }} className="tabular-nums">{data.opens}</strong>
        <span style={{ color: "var(--zn-ink-3)" }}>opens</span>
      </span>
      <span style={{ color: "var(--zn-line)" }}>·</span>
      <span className="inline-flex items-center gap-1">
        <MousePointer2 className="size-3" style={{ color: "var(--zn-accent)" }} />
        <strong style={{ color: "var(--zn-ink)" }} className="tabular-nums">{data.clicks}</strong>
        <span style={{ color: "var(--zn-ink-3)" }}>clicks</span>
      </span>
      <span style={{ color: "var(--zn-ink-3)" }}>· today</span>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";

/**
 * Landing-page "Today's focus" card.
 *
 * Audit §3 UX-9: the static hero card read as a stock screenshot. Now
 * the top row subtly pulses, the rank rotates every 6s, and the
 * "likely this week" stat ticks up — small signals that the product
 * is alive.
 *
 * Renders client-side. Server-only fallback (no JS) shows the first
 * frame's static content via SSR.
 */

const ROWS = [
  { name: "Ashford Digital",       amount: "£12,750", sub: "54d overdue · Send payment reminder"  },
  { name: "BluePeak Design",       amount: "£8,900",  sub: "77d overdue · Call customer"           },
  { name: "Northline Creative",    amount: "£6,400",  sub: "63d overdue · Send final reminder"     },
  { name: "Redfern Architecture",  amount: "£11,200", sub: "61d overdue · Escalation candidate"    },
];

const ROTATE_MS = 6000;
const LIKELY_BASE = 39_450;

export function LandingFocusCard() {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    // Respect users who prefer reduced motion.
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) return;
    const id = setInterval(() => setTick((t) => t + 1), ROTATE_MS);
    return () => clearInterval(id);
  }, []);

  // Subtle ticker — the "likely this week" amount inches up by £500
  // every cycle, capping at +£2.5k so it never looks fake.
  const likely = LIKELY_BASE + Math.min(tick % 6, 5) * 500;

  return (
    <div className="zn-card p-3 sm:p-4">
      <div
        className="rounded-[12px] p-5"
        style={{ background: "var(--zn-ink)", color: "var(--zn-surface)" }}
      >
        <div className="zn-label !p-0 opacity-55">Today&apos;s focus</div>
        <p
          className="mt-1.5 text-[17px] leading-[1.4] italic"
          style={{ fontFamily: "var(--font-newsreader), ui-serif, Georgia, serif" }}
        >
          Recover £105,940 sitting overdue. Two calls likely move the needle most.
        </p>
      </div>
      <div className="mt-3 grid gap-2.5">
        {ROWS.map((row, idx) => {
          const isTop = idx === tick % ROWS.length;
          return (
            <div
              key={row.name}
              className="flex items-center gap-3 rounded-[10px] p-3 transition-all duration-500"
              style={{
                background: "var(--zn-surface)",
                border: isTop
                  ? "1px solid var(--zn-accent)"
                  : "1px solid var(--zn-line-soft)",
                boxShadow: isTop ? "0 0 0 3px var(--zn-accent-soft, rgba(201,122,57,0.10))" : "none",
              }}
            >
              <span
                className="text-[16px] italic flex-shrink-0 w-5 text-center"
                style={{
                  fontFamily: "var(--font-newsreader), ui-serif, Georgia, serif",
                  color: "var(--zn-ink-3)",
                }}
              >
                {idx + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold truncate text-[#1d1813] dark:text-[#f0e8d5]">
                  {row.name}
                </div>
                <div className="text-[11.5px] truncate" style={{ color: "var(--zn-ink-3)" }}>
                  {row.sub}
                </div>
              </div>
              <div className="text-[13px] font-semibold tabular-nums flex-shrink-0 text-[#1d1813] dark:text-[#f0e8d5]">
                {row.amount}
              </div>
              <span
                className="zn-pill flex-shrink-0"
                style={{ height: 24, fontSize: 11, padding: "0 10px" }}
              >
                Review
              </span>
            </div>
          );
        })}
      </div>
      <div
        className="mt-3 flex items-center justify-between rounded-[10px] px-3 py-2"
        style={{ background: "var(--zn-surface-2)", border: "1px solid var(--zn-line-soft)" }}
      >
        <span className="text-[11.5px]" style={{ color: "var(--zn-ink-3)" }}>29 more in queue</span>
        <span
          className="text-[11.5px] font-medium tabular-nums transition-colors"
          style={{ color: "var(--zn-safe)" }}
        >
          ↑ £{likely.toLocaleString("en-GB")} likely this week
        </span>
      </div>
    </div>
  );
}

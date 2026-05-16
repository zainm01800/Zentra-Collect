"use client";

/**
 * Chase streak badge — small habit-loop indicator that sits in the chase
 * queue header. Shows the user's current streak, this-week count, and
 * personal best. Quietly encouraging — never demands.
 *
 * Hides itself entirely when the user has logged zero outcomes ever
 * (so first-time users don't see a "Streak: 0" reminder of nothing).
 */

import { useEffect, useState } from "react";
import { Flame, Trophy } from "lucide-react";
import { readStreakSnapshot, type StreakSnapshot } from "@/lib/chase-streak";
import { useReview } from "@/components/review-context";

export function ChaseStreakBadge() {
  const [snapshot, setSnapshot] = useState<StreakSnapshot | null>(null);
  const { outcomesLogged } = useReview();

  // Re-read from localStorage on mount + whenever a new outcome lands
  // (outcomesLogged increments) so the streak updates immediately.
  useEffect(() => {
    setSnapshot(readStreakSnapshot());
  }, [outcomesLogged]);

  if (!snapshot) return null;
  if (snapshot.currentStreak === 0 && snapshot.thisWeek === 0) return null;

  const isStrong = snapshot.currentStreak >= 3;

  return (
    <div
      className="flex items-center gap-3 rounded-full px-3 py-1.5 text-[12px]"
      style={{
        background: "var(--zn-surface-2)",
        border:     "1px solid var(--zn-line-soft)",
      }}
      title={`Logged ${snapshot.thisWeek} outcome${snapshot.thisWeek === 1 ? "" : "s"} this week. Best streak: ${snapshot.bestStreak} day${snapshot.bestStreak === 1 ? "" : "s"}.`}
    >
      {snapshot.currentStreak > 0 && (
        <span className="flex items-center gap-1 font-semibold tabular-nums" style={{ color: isStrong ? "var(--zn-accent)" : "var(--zn-ink-2)" }}>
          <Flame className="size-3.5" />
          {snapshot.currentStreak} day{snapshot.currentStreak === 1 ? "" : "s"}
        </span>
      )}
      <span style={{ color: "var(--zn-ink-3)" }}>
        <span className="tabular-nums font-medium" style={{ color: "var(--zn-ink-2)" }}>
          {snapshot.thisWeek}
        </span>
        {" "}this week
      </span>
      {snapshot.bestStreak >= 7 && snapshot.bestStreak === snapshot.currentStreak && (
        <span className="flex items-center gap-1 text-[11px]" style={{ color: "var(--zn-accent)" }}>
          <Trophy className="size-3" />
          Personal best
        </span>
      )}
    </div>
  );
}

"use client";

/**
 * Celebration system — confetti burst + milestone toast.
 *
 * Usage:
 *   import { celebrate, MilestoneToast } from "@/components/celebration";
 *   celebrate("paid");           // confetti only
 *   celebrate("first_paid");     // confetti + milestone toast
 *
 * Mount <MilestoneToast /> once in the app shell (or layout).
 * Call celebrate() from anywhere on the client.
 */

import { useEffect, useState } from "react";
import { PartyPopper, X } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

export type CelebrationEvent =
  | "paid"
  | "first_paid"
  | "first_import"
  | "first_review"
  | "chase_100"
  | "streak_5";

interface Milestone {
  heading: string;
  body: string;
  emoji: string;
}

const MILESTONES: Record<string, Milestone> = {
  first_paid: {
    emoji: "🎉",
    heading: "First invoice recovered!",
    body: "That's real money back in your account. Keep the momentum going.",
  },
  first_import: {
    emoji: "📂",
    heading: "First import complete",
    body: "Your chase plan is ready. Work from the top — the most urgent invoice is #1.",
  },
  first_review: {
    emoji: "✅",
    heading: "First review done",
    body: "You've just done the hardest part. Record the outcome and move to #2.",
  },
  chase_100: {
    emoji: "💯",
    heading: "100 chases logged",
    body: "You're in the top 8% of Zentra users. Consistent chasing changes cashflow.",
  },
  streak_5: {
    emoji: "🔥",
    heading: "5-day chase streak",
    body: "Five days in a row. Customers notice the pattern — this accelerates recovery.",
  },
};

// ── Global event bus (avoids prop-drilling) ───────────────────────────────────

type CelebrationListener = (event: CelebrationEvent) => void;
const listeners = new Set<CelebrationListener>();

export function celebrate(event: CelebrationEvent) {
  listeners.forEach((l) => l(event));
}

// ── Confetti burst (CSS-only, no dependencies) ────────────────────────────────

const COLORS = ["#f59e0b", "#10b981", "#3b82f6", "#f97316", "#8b5cf6", "#ec4899"];

function ConfettiPiece({ style }: { style: React.CSSProperties }) {
  return (
    <div
      className="pointer-events-none fixed z-[9999] rounded-sm"
      style={{ width: 8, height: 10, ...style }}
    />
  );
}

interface Piece {
  id: number;
  x: number;
  color: string;
  delay: number;
  duration: number;
  rotation: number;
  size: number;
}

function ConfettiBurst({ onDone }: { onDone: () => void }) {
  const [pieces] = useState<Piece[]>(() =>
    Array.from({ length: 48 }, (_, i) => ({
      id: i,
      x: 30 + Math.random() * 40, // spread across 30-70% width
      color: COLORS[i % COLORS.length],
      delay: Math.random() * 0.3,
      duration: 1.2 + Math.random() * 0.8,
      rotation: Math.random() * 720 - 360,
      size: 6 + Math.random() * 6,
    }))
  );

  useEffect(() => {
    const t = setTimeout(onDone, 2500);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <>
      {pieces.map((p) => (
        <div
          key={p.id}
          className="pointer-events-none fixed z-[9999]"
          style={{
            left: `${p.x}vw`,
            top: "-10px",
            width: p.size,
            height: p.size * 1.3,
            background: p.color,
            borderRadius: 2,
            animation: `confetti-fall ${p.duration}s ease-in ${p.delay}s forwards`,
            transform: `rotate(${p.rotation}deg)`,
          }}
        />
      ))}
      <style>{`
        @keyframes confetti-fall {
          0%   { transform: translateY(0) rotate(0deg) scaleX(1); opacity: 1; }
          70%  { opacity: 1; }
          100% { transform: translateY(100vh) rotate(${Math.random() * 720}deg) scaleX(0.3); opacity: 0; }
        }
      `}</style>
    </>
  );
}

// ── Milestone toast ───────────────────────────────────────────────────────────

function Toast({ milestone, onClose }: { milestone: Milestone; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 6000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div
      className="fixed bottom-6 right-6 z-[9998] flex items-start gap-3 rounded-2xl px-4 py-4 shadow-lg max-w-[320px] animate-in slide-in-from-bottom-4 fade-in duration-300"
      style={{ background: "var(--zn-surface)", border: "1px solid var(--zn-line)" }}
    >
      <div className="text-[24px] leading-none mt-0.5 flex-shrink-0">{milestone.emoji}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[13.5px] font-semibold" style={{ color: "var(--zn-ink)" }}>
            {milestone.heading}
          </p>
          <button
            onClick={onClose}
            className="flex-shrink-0 rounded-md p-0.5 transition-colors hover:bg-[var(--zn-surface-2)] mt-0.5"
            aria-label="Dismiss"
          >
            <X className="size-3.5" style={{ color: "var(--zn-ink-3)" }} />
          </button>
        </div>
        <p className="text-[12.5px] mt-1 leading-5" style={{ color: "var(--zn-ink-3)" }}>
          {milestone.body}
        </p>
      </div>
    </div>
  );
}

// ── Mount once in the layout ──────────────────────────────────────────────────

export function MilestoneToast() {
  const [confetti, setConfetti] = useState(false);
  const [toast, setToast] = useState<Milestone | null>(null);

  useEffect(() => {
    const handler = (event: CelebrationEvent) => {
      setConfetti(true);
      const m = MILESTONES[event];
      if (m) setToast(m);
    };
    listeners.add(handler);
    return () => { listeners.delete(handler); };
  }, []);

  return (
    <>
      {confetti && <ConfettiBurst onDone={() => setConfetti(false)} />}
      {toast && <Toast milestone={toast} onClose={() => setToast(null)} />}
    </>
  );
}

// ── Milestone tracking (localStorage-based) ───────────────────────────────────

const MILESTONES_KEY = "zentra.milestones.v1";

function getAchieved(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(MILESTONES_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
}

function markAchieved(key: string) {
  if (typeof window === "undefined") return;
  const achieved = getAchieved();
  achieved.add(key);
  try { localStorage.setItem(MILESTONES_KEY, JSON.stringify([...achieved])); } catch {}
}

/**
 * Call after recording any outcome. Fires the appropriate celebration
 * if a milestone is hit for the first time.
 */
export function checkAndCelebrate(event: "paid" | "import" | "review" | "chase") {
  if (typeof window === "undefined") return;

  const achieved = getAchieved();

  if (event === "paid" && !achieved.has("first_paid")) {
    markAchieved("first_paid");
    celebrate("first_paid");
    return;
  }
  if (event === "paid") {
    celebrate("paid"); // always do confetti on paid
  }
  if (event === "import" && !achieved.has("first_import")) {
    markAchieved("first_import");
    celebrate("first_import");
  }
  if (event === "review" && !achieved.has("first_review")) {
    markAchieved("first_review");
    celebrate("first_review");
  }

  // Chase count milestone
  if (event === "chase") {
    const count = parseInt(localStorage.getItem("zentra.chaseCount.v1") ?? "0", 10) + 1;
    localStorage.setItem("zentra.chaseCount.v1", String(count));
    if (count === 100 && !achieved.has("chase_100")) {
      markAchieved("chase_100");
      celebrate("chase_100");
    }
  }
}

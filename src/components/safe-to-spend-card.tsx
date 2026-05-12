"use client";

import { useEffect, useRef, useState } from "react";
import type { SafeToSpendResult } from "@/lib/finance/safe-to-spend";

// ── Count-up animation hook ───────────────────────────────────────────────────

/**
 * Counts a number from 0 to `target` over `duration` ms using
 * requestAnimationFrame and an easeOutCubic curve.
 * Re-animates from 0 whenever `target` changes (e.g. after a balance update).
 */
function useCountUp(target: number, duration = 1_100): number {
  const [current, setCurrent] = useState(0);
  const rafRef   = useRef<number>(0);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    // Reset start time so each new target begins a fresh animation.
    startRef.current = null;

    function tick(timestamp: number) {
      if (startRef.current === null) startRef.current = timestamp;

      const elapsed  = timestamp - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const eased    = 1 - Math.pow(1 - progress, 3); // easeOutCubic

      setCurrent(Math.round(eased * target));

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  return current;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatGBP(amount: number): string {
  return new Intl.NumberFormat("en-GB", {
    style:                 "currency",
    currency:              "GBP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

const STATUS_CONFIG = {
  safe: {
    bg:    "var(--zn-safe-soft)",
    color: "var(--zn-safe)",
    label: "Safe zone",
    pulse: false,
  },
  caution: {
    bg:    "var(--zn-warn-soft)",
    color: "var(--zn-warn)",
    label: "Spend carefully",
    pulse: false,
  },
  low: {
    bg:    "var(--zn-risk-soft)",
    color: "var(--zn-risk)",
    label: "Keep spending low",
    pulse: true,
  },
} as const;

// ── Dark-background skeleton ──────────────────────────────────────────────────

function DarkSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-md ${className ?? ""}`}
      style={{ background: "rgba(255,255,255,0.10)" }}
    />
  );
}

// ── Column sub-component ──────────────────────────────────────────────────────

function Column({
  label,
  value,
  valueColor = "rgba(255,255,255,0.85)",
}: {
  label:       string;
  value:       string;
  valueColor?: string;
}) {
  return (
    <div>
      <p
        className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.09em]"
        style={{ color: "rgba(255,255,255,0.38)" }}
      >
        {label}
      </p>
      <p
        className="text-[15px] font-semibold leading-none tracking-tight"
        style={{ color: valueColor, fontVariantNumeric: "tabular-nums" }}
      >
        {value}
      </p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export interface SafeToSpendCardProps {
  result?:    SafeToSpendResult;
  isLoading?: boolean;
}

export function SafeToSpendCard({
  result,
  isLoading = false,
}: SafeToSpendCardProps) {
  // ── Hooks (must be called unconditionally before any early return) ─────────

  // Feed 0 while loading so the animation is ready to fire the moment result lands.
  const animatedValue = useCountUp(isLoading ? 0 : (result?.safeToSpend ?? 0));

  // ── Loading skeleton ───────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div
        className="relative overflow-hidden rounded-[18px] px-6 py-6"
        style={{ background: "var(--zn-bg-inverse)" }}
        aria-busy="true"
        aria-label="Safe to spend — loading"
      >
        <div className="mb-5 flex items-center justify-between gap-3">
          <DarkSkeleton className="h-2.5 w-24" />
          <DarkSkeleton className="h-6 w-28 rounded-full" />
        </div>

        <DarkSkeleton className="mb-2 h-14 w-52" />
        <DarkSkeleton className="mb-8 h-3 w-36" />

        <div className="mb-5 h-px" style={{ background: "rgba(255,255,255,0.08)" }} />

        <div className="grid grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-2">
              <DarkSkeleton className="h-2.5 w-16" />
              <DarkSkeleton className="h-5 w-20" />
            </div>
          ))}
        </div>

        <DarkSkeleton className="mt-5 h-2.5 w-52" />
      </div>
    );
  }

  // ── Empty guard ────────────────────────────────────────────────────────────

  if (!result) return null;

  // ── Derived values (result is narrowed to non-null from here) ─────────────

  // Bank balance lives as the first "income" entry in the breakdown array.
  const bankBalance =
    result.breakdown.find((b) => b.label === "Bank balance")?.amount ?? 0;

  const status = STATUS_CONFIG[result.statusLabel];

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      className="relative overflow-hidden rounded-[18px] px-6 py-6"
      style={{ background: "var(--zn-bg-inverse)" }}
    >
      {/*
        Subtle warm radial glow at top-left.
        Uses the terracotta accent at very low opacity to give the dark
        surface depth without competing with the hero number.
      */}
      <div
        className="pointer-events-none absolute -left-20 -top-20 h-64 w-64 rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(184,72,31,0.22) 0%, transparent 70%)",
        }}
        aria-hidden
      />

      {/* ── Header: label + status badge ──────────────────────────── */}
      <div className="relative mb-5 flex items-start justify-between gap-3">
        <span
          className="zn-label"
          style={{ color: "rgba(255,255,255,0.42)" }}
        >
          Safe to spend
        </span>

        <div
          className="flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1"
          style={{ background: status.bg }}
          role="status"
          aria-label={`Status: ${status.label}`}
        >
          <span
            className={`block size-1.5 rounded-full${status.pulse ? " animate-pulse" : ""}`}
            style={{ background: status.color }}
            aria-hidden
          />
          <span
            className="text-[11px] font-semibold leading-none tracking-[0.03em]"
            style={{ color: status.color }}
          >
            {status.label}
          </span>
        </div>
      </div>

      {/* ── Hero number ───────────────────────────────────────────── */}
      <div className="relative mb-6">
        {/*
          font-serif resolves to --font-newsreader via the @theme inline config.
          aria-label carries the real value so screen readers skip the
          animated intermediate figures.
        */}
        <p
          className="font-serif leading-none tracking-tight"
          style={{
            fontSize:           "clamp(42px, 7vw, 60px)",
            fontWeight:         500,
            color:              "#ffffff",
            fontVariantNumeric: "tabular-nums",
          }}
          aria-label={`Safe to spend: ${formatGBP(result.safeToSpend)}`}
          aria-live="polite"
        >
          {formatGBP(animatedValue)}
        </p>

        <p
          className="mt-2.5 text-[13px] leading-none"
          style={{ color: "rgba(255,255,255,0.46)" }}
        >
          {result.statusMessage}
        </p>
      </div>

      {/* ── Divider ───────────────────────────────────────────────── */}
      <div
        className="mb-5 h-px w-full"
        style={{ background: "rgba(255,255,255,0.08)" }}
      />

      {/* ── 3-column breakdown ────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">
        <Column
          label="Bank balance"
          value={formatGBP(bankBalance)}
        />

        {/*
          Tax reserve is shown in amber so it reads as "committed / off-limits"
          even at a glance — a different colour breaks the visual grouping and
          reinforces the message without extra copy.
        */}
        <Column
          label="Tax reserve"
          value={formatGBP(result.taxSetAside)}
          valueColor="#a07522"   /* --zn-warn */
        />

        <Column
          label="Bills due"
          value={result.billsDueSoon > 0 ? formatGBP(result.billsDueSoon) : "—"}
        />
      </div>

      {/* ── Footer note ───────────────────────────────────────────── */}
      <p
        className="mt-5 text-[11px] leading-none tracking-[0.01em]"
        style={{ color: "rgba(255,255,255,0.26)" }}
      >
        ~ estimate · updates with new invoices
      </p>
    </div>
  );
}

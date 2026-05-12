"use client";

/**
 * DashboardGreeting
 *
 * Standalone greeting + customise control + adaptive quick-action links.
 * Always renders (even if all modules are off), so the dashboard always has
 * a header. Quick links only show for enabled modules so a tax-focused user
 * never sees a "Chase queue" link.
 */

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronRight, SlidersHorizontal } from "lucide-react";

import {
  readWorkspacePrefs,
  setWidget,
  type WorkspacePrefs,
} from "@/lib/prefs";

// ── Quick action map (one per module) ─────────────────────────────────────────

const QUICK_ACTIONS: Array<{
  module: keyof WorkspacePrefs["modules"];
  href:   string;
  label:  string;
}> = [
  { module: "collections", href: "/chase-today", label: "Chase queue"   },
  { module: "cashflow",    href: "/banking",     label: "Bank feed"     },
  { module: "expenses",    href: "/expenses",    label: "Expenses"      },
  { module: "tax",         href: "/tax",         label: "Tax reserve"   },
  { module: "reports",     href: "/reports",     label: "Reports"       },
];

export function DashboardGreeting() {
  const [prefs, setPrefs] = useState<WorkspacePrefs | null>(null);
  const [showCustomizer, setShowCustomizer] = useState(false);
  const customizerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPrefs(readWorkspacePrefs());
    function onPrefs(e: Event) {
      setPrefs((e as CustomEvent<WorkspacePrefs>).detail);
    }
    function onClick(e: MouseEvent) {
      if (customizerRef.current && !customizerRef.current.contains(e.target as Node)) {
        setShowCustomizer(false);
      }
    }
    window.addEventListener("zentra:workspaceprefs", onPrefs);
    document.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("zentra:workspaceprefs", onPrefs);
      document.removeEventListener("mousedown", onClick);
    };
  }, []);

  const dateLabel = new Date().toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long",
  });
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning." :
    hour < 18 ? "Good afternoon." : "Good evening.";

  // Show the first enabled module's quick action as the primary CTA
  const enabledActions = prefs
    ? QUICK_ACTIONS.filter((a) => prefs.modules[a.module])
    : [];
  const primaryAction   = enabledActions[0];
  const secondaryAction = enabledActions[1];

  function toggleWidget<K extends keyof WorkspacePrefs["widgets"]>(key: K) {
    if (!prefs) return;
    setPrefs(setWidget(key, !prefs.widgets[key]));
  }

  return (
    <section className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <div className="zn-label mb-1.5">{dateLabel}</div>
        <h1 className="zn-page-h1 zn-page-h1-lg">{greeting}</h1>
      </div>

      <div className="flex items-center gap-2">
        {secondaryAction && (
          <Link
            href={secondaryAction.href}
            className="zn-pill zn-pill-ghost"
          >
            {secondaryAction.label}
          </Link>
        )}
        {primaryAction && (
          <Link href={primaryAction.href} className="zn-pill">
            {primaryAction.label} <ChevronRight className="size-3" />
          </Link>
        )}

        {/* Dashboard customiser */}
        <div className="relative" ref={customizerRef}>
          <button
            type="button"
            onClick={() => setShowCustomizer((v) => !v)}
            className="zn-pill zn-pill-ghost"
            title="Customise dashboard sections"
            style={{ height: 30, fontSize: 12, padding: "0 10px", gap: 5 }}
          >
            <SlidersHorizontal className="size-3.5" />
            <span className="hidden sm:inline">Customise</span>
          </button>

          {showCustomizer && prefs && (
            <div
              className="absolute right-0 top-[calc(100%+6px)] z-50 w-[240px] rounded-[14px] shadow-lg p-4 flex flex-col gap-3"
              style={{
                background: "var(--zn-surface)",
                border: "1px solid var(--zn-line)",
              }}
            >
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em]" style={{ color: "var(--zn-ink-3)" }}>
                Dashboard widgets
              </p>

              {([
                { key: "riskInsights",   label: "Risk insights",     requires: "collections" as const },
                { key: "weeklyBrief",    label: "Weekly brief",      requires: "collections" as const },
                { key: "financialPanel", label: "Financial position", requires: "cashflow"    as const },
              ] as Array<{
                key: keyof WorkspacePrefs["widgets"];
                label: string;
                requires: keyof WorkspacePrefs["modules"];
              }>).map(({ key, label, requires }) => {
                const moduleOff = !prefs.modules[requires];
                return (
                  <label
                    key={key}
                    className="flex items-center justify-between gap-3 cursor-pointer select-none"
                    style={{ opacity: moduleOff ? 0.45 : 1 }}
                  >
                    <span className="text-[13px]" style={{ color: "var(--zn-ink-2)" }}>{label}</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={prefs.widgets[key] && !moduleOff}
                      disabled={moduleOff}
                      onClick={() => !moduleOff && toggleWidget(key)}
                      className="relative flex-shrink-0 rounded-full transition-colors"
                      style={{
                        width: 34, height: 20,
                        background: (prefs.widgets[key] && !moduleOff)
                          ? "var(--zn-accent)"
                          : "var(--zn-line-hard)",
                      }}
                    >
                      <span
                        className="absolute top-[3px] left-[3px] size-[14px] rounded-full bg-white transition-transform"
                        style={{
                          transform: (prefs.widgets[key] && !moduleOff) ? "translateX(14px)" : "none",
                        }}
                      />
                    </button>
                  </label>
                );
              })}

              <div className="border-t pt-2" style={{ borderColor: "var(--zn-line-soft)" }}>
                <Link
                  href="/settings?tab=workspace"
                  className="text-[11.5px] underline-offset-2 hover:underline"
                  style={{ color: "var(--zn-ink-3)" }}
                  onClick={() => setShowCustomizer(false)}
                >
                  Workspace setup — enable modules →
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

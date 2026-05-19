/**
 * Unified workspace preferences — module-based.
 *
 * One key drives the entire sidebar + dashboard configuration:
 *   zentra.workspacePrefs.v1
 *
 * Migration: reads from legacy keys (zentra.navPrefs.v1, zentra.dashPrefs.v1)
 * on first load and upgrades them to the unified shape.
 */

import { ALL_MODULE_KEYS, MODULES, type ModuleKey } from "@/lib/modules";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface WorkspacePrefs {
  /** Which modules the user has enabled. Collections is always on. */
  modules: Record<ModuleKey, boolean>;
  /** Within-module widget visibility on the dashboard. */
  widgets: {
    weeklyBrief:    boolean;  // part of collections
    riskInsights:   boolean;  // part of collections
    financialPanel: boolean;  // part of cashflow
  };
  /** Whether the user has been shown the first-run module picker. */
  setupCompleted: boolean;
}

// ── Defaults ─────────────────────────────────────────────────────────────────
//
// UX-1: previously defaulted every module on, so first-time visitors saw
// Expenses / P&L / Bills / Tax in the sidebar of what is marketed as a
// collections decisioning tool. Now defaults to collections + reports
// only; books/cashflow are opt-in via Settings → Workspace.
//
// Bookkeeper plans flip the rest on after onboarding via the
// `defaultModulesForPlan` helper in lib/modules.ts.
const DEFAULTS: WorkspacePrefs = {
  modules: {
    collections: true,
    cashflow:    false,
    expenses:    true,
    tax:         true,
    reports:     true,
  },
  widgets: {
    weeklyBrief:    true,
    riskInsights:   true,
    financialPanel: false,
  },
  setupCompleted: false,
};

// ── Keys ──────────────────────────────────────────────────────────────────────

const KEY        = "zentra.workspacePrefs.v1";
const LEGACY_NAV = "zentra.navPrefs.v1";
const LEGACY_DASH = "zentra.dashPrefs.v1";

// ── Migration ────────────────────────────────────────────────────────────────

function migrateFromLegacy(): WorkspacePrefs | null {
  if (typeof window === "undefined") return null;
  try {
    const nav  = window.localStorage.getItem(LEGACY_NAV);
    const dash = window.localStorage.getItem(LEGACY_DASH);
    if (!nav && !dash) return null;

    const parsedNav  = nav  ? JSON.parse(nav)  : {};
    const parsedDash = dash ? JSON.parse(dash) : {};

    const next: WorkspacePrefs = {
      modules: {
        collections: true,
        cashflow:    parsedNav.showFinance !== false,
        expenses:    parsedNav.showFinance !== false,
        tax:         parsedNav.showFinance !== false,
        reports:     parsedNav.showFinance !== false,
      },
      widgets: {
        weeklyBrief:    parsedDash.showWeeklyBrief    !== false,
        riskInsights:   parsedDash.showRiskInsights   !== false,
        financialPanel: parsedDash.showFinancialPanel !== false,
      },
      setupCompleted: true,
    };

    window.localStorage.setItem(KEY, JSON.stringify(next));
    window.localStorage.removeItem(LEGACY_NAV);
    window.localStorage.removeItem(LEGACY_DASH);
    return next;
  } catch {
    return null;
  }
}

// ── Read / write ─────────────────────────────────────────────────────────────

export function readWorkspacePrefs(): WorkspacePrefs {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const s = window.localStorage.getItem(KEY);
    if (s) {
      const parsed = JSON.parse(s) as Partial<WorkspacePrefs>;
      return {
        modules: { ...DEFAULTS.modules, ...(parsed.modules ?? {}) },
        widgets: { ...DEFAULTS.widgets, ...(parsed.widgets ?? {}) },
        setupCompleted: parsed.setupCompleted ?? false,
      };
    }
    const migrated = migrateFromLegacy();
    return migrated ?? DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

export function writeWorkspacePrefs(prefs: WorkspacePrefs): void {
  try { window.localStorage.setItem(KEY, JSON.stringify(prefs)); } catch {}
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("zentra:workspaceprefs", { detail: prefs }));
  }
}

// ── Convenience updaters ─────────────────────────────────────────────────────

export function setModule(key: ModuleKey, enabled: boolean): WorkspacePrefs {
  const current = readWorkspacePrefs();
  if (MODULES[key].alwaysOn && !enabled) return current; // ignore
  const next: WorkspacePrefs = {
    ...current,
    modules: { ...current.modules, [key]: enabled },
  };
  writeWorkspacePrefs(next);
  return next;
}

export function setWidget(key: keyof WorkspacePrefs["widgets"], enabled: boolean): WorkspacePrefs {
  const current = readWorkspacePrefs();
  const next: WorkspacePrefs = {
    ...current,
    widgets: { ...current.widgets, [key]: enabled },
  };
  writeWorkspacePrefs(next);
  return next;
}

export function applyModuleSet(modules: Record<ModuleKey, boolean>): WorkspacePrefs {
  const current = readWorkspacePrefs();
  // Force always-on modules on
  const merged: Record<ModuleKey, boolean> = { ...modules };
  ALL_MODULE_KEYS.forEach((k) => {
    if (MODULES[k].alwaysOn) merged[k] = true;
  });
  const next: WorkspacePrefs = {
    ...current,
    modules: merged,
    setupCompleted: true,
  };
  writeWorkspacePrefs(next);
  return next;
}

export function markSetupCompleted(): WorkspacePrefs {
  const current = readWorkspacePrefs();
  const next = { ...current, setupCompleted: true };
  writeWorkspacePrefs(next);
  return next;
}

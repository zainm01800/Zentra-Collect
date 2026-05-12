"use client";

/**
 * Workspace setup — the unified place users configure:
 *   - Personas (one-click presets)
 *   - Modules (Cash flow, Expenses, Tax & MTD, Reports)
 *   - Dashboard widgets (Weekly brief, Risk insights, Financial position)
 *
 * Modules above the user's plan tier are shown locked with an upgrade prompt.
 */

import { useEffect, useState } from "react";
import { Check, Lock } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";

import {
  ALL_MODULE_KEYS,
  MODULES,
  PERSONAS,
  planUnlocksModule,
  type ModuleKey,
} from "@/lib/modules";
import {
  applyModuleSet,
  readWorkspacePrefs,
  setModule,
  setWidget,
  type WorkspacePrefs,
} from "@/lib/prefs";
import { useLocalAccount } from "@/lib/billing/use-local-account";

// ── Helpers ───────────────────────────────────────────────────────────────────

function modulesMatch(a: Record<ModuleKey, boolean>, b: Record<ModuleKey, boolean>): boolean {
  return ALL_MODULE_KEYS.every((k) => a[k] === b[k]);
}

// ── Component ─────────────────────────────────────────────────────────────────

export function WorkspaceSetupCard() {
  const { account } = useLocalAccount();
  const planId = account?.planId;

  const [prefs, setPrefs] = useState<WorkspacePrefs | null>(null);

  useEffect(() => {
    setPrefs(readWorkspacePrefs());
    function onPrefs(e: Event) {
      setPrefs((e as CustomEvent<WorkspacePrefs>).detail);
    }
    window.addEventListener("zentra:workspaceprefs", onPrefs);
    return () => window.removeEventListener("zentra:workspaceprefs", onPrefs);
  }, []);

  if (!prefs) {
    return (
      <Card className="rounded-lg" id="workspace-setup">
        <CardHeader>
          <CardTitle>Workspace setup</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading preferences…</p>
        </CardContent>
      </Card>
    );
  }

  function applyPersona(modules: Record<ModuleKey, boolean>) {
    // Strip out modules the current plan can't unlock
    const filtered: Record<ModuleKey, boolean> = { ...modules };
    ALL_MODULE_KEYS.forEach((k) => {
      if (!planUnlocksModule(planId, k)) filtered[k] = false;
    });
    setPrefs(applyModuleSet(filtered));
  }

  function toggleModule(key: ModuleKey, enabled: boolean) {
    setPrefs(setModule(key, enabled));
  }

  function toggleWidget(key: keyof WorkspacePrefs["widgets"], enabled: boolean) {
    setPrefs(setWidget(key, enabled));
  }

  return (
    <div id="workspace-setup" className="grid gap-5 lg:grid-cols-[1fr_280px]">
      {/* ── Left: Modules + Widgets ─────────────────────────────────── */}
      <Card className="rounded-lg">
        <CardHeader className="pb-3">
          <CardTitle>Modules</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground -mt-1">
            Choose what Zentra helps you with. Sidebar and dashboard configure themselves.
          </p>

          <div className="divide-y" style={{ borderColor: "var(--zn-line)" }}>
            {ALL_MODULE_KEYS.map((key) => {
              const mod      = MODULES[key];
              const unlocked = planUnlocksModule(planId, key);
              const enabled  = prefs.modules[key];

              return (
                <div
                  key={key}
                  className="flex items-center justify-between gap-3 py-2.5"
                  style={{ opacity: unlocked ? 1 : 0.65 }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[13px] font-medium" style={{ color: "var(--zn-ink)" }}>
                        {mod.label}
                      </span>
                      {!unlocked && (
                        <span
                          className="inline-flex items-center gap-0.5 text-[10px] font-semibold uppercase tracking-wide rounded px-1.5 py-0.5"
                          style={{ background: "var(--zn-surface-2)", color: "var(--zn-ink-3)" }}
                        >
                          <Lock className="size-2.5" /> Upgrade
                        </span>
                      )}
                    </div>
                    <p className="text-[11.5px] leading-snug" style={{ color: "var(--zn-ink-3)" }}>
                      {mod.description}
                    </p>
                  </div>
                  <Switch
                    checked={enabled && unlocked}
                    disabled={!unlocked}
                    onCheckedChange={(checked) => toggleModule(key, checked)}
                  />
                </div>
              );
            })}
          </div>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground mb-2">
              Dashboard widgets
            </p>
            <div className="divide-y" style={{ borderColor: "var(--zn-line)" }}>
              {([
                { key: "weeklyBrief",    label: "Weekly brief",       hint: "Focus statement + top 3 attention needed." },
                { key: "riskInsights",   label: "Risk insights",      hint: "Exposure, repeat late payers, promises." },
                { key: "financialPanel", label: "Financial position",  hint: "Bank balance, cash flow, monthly snapshot." },
              ] as Array<{ key: keyof WorkspacePrefs["widgets"]; label: string; hint: string }>).map(({ key, label, hint }) => {
                const isFinancial = key === "financialPanel";
                const cashflowOff = isFinancial && !prefs.modules.cashflow;

                return (
                  <div
                    key={key}
                    className="flex items-center justify-between gap-3 py-2.5"
                    style={{ opacity: cashflowOff ? 0.5 : 1 }}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium" style={{ color: "var(--zn-ink)" }}>
                        {label}
                      </p>
                      <p className="text-[11.5px] leading-snug" style={{ color: "var(--zn-ink-3)" }}>
                        {cashflowOff ? "Enable Cash flow to use this widget." : hint}
                      </p>
                    </div>
                    <Switch
                      checked={prefs.widgets[key] && !cashflowOff}
                      disabled={cashflowOff}
                      onCheckedChange={(checked) => toggleWidget(key, checked)}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Right: Persona presets ──────────────────────────────────── */}
      <Card className="rounded-lg h-fit">
        <CardHeader className="pb-3">
          <CardTitle>Quick presets</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-[12px] text-muted-foreground mb-3 -mt-1">
            One click sets up all modules for your role.
          </p>
          <div className="space-y-2">
            {PERSONAS.map((persona) => {
              const isCurrent = modulesMatch(prefs.modules, persona.modules);
              return (
                <button
                  key={persona.id}
                  type="button"
                  onClick={() => applyPersona(persona.modules)}
                  className="w-full flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left transition-colors hover:bg-[#f3ecd8] dark:hover:bg-[#28231c]"
                  style={{
                    borderColor: isCurrent ? "var(--zn-accent)" : "var(--zn-line)",
                    background: isCurrent ? "var(--zn-accent-soft)" : "transparent",
                  }}
                >
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold leading-tight" style={{ color: "var(--zn-ink)" }}>
                      {persona.label}
                    </p>
                    <p className="text-[11px] leading-snug" style={{ color: "var(--zn-ink-3)" }}>
                      {persona.description}
                    </p>
                  </div>
                  {isCurrent && (
                    <Check className="size-3.5 shrink-0" style={{ color: "var(--zn-accent)" }} />
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

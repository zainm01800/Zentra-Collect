"use client";

/**
 * Dismissible banner shown on the dashboard until the user completes
 * the first-run workspace setup (i.e. picks a persona or modules).
 *
 * One click on a persona presets the modules and marks setup complete.
 * "Customise modules" sends them to the full Workspace setup card in Settings.
 */

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Settings as SettingsIcon, X } from "lucide-react";

import { PERSONAS, type ModuleKey } from "@/lib/modules";
import {
  applyModuleSet,
  markSetupCompleted,
  readWorkspacePrefs,
  type WorkspacePrefs,
} from "@/lib/prefs";

export function WorkspaceSetupBanner() {
  const [prefs, setPrefs] = useState<WorkspacePrefs | null>(null);

  useEffect(() => {
    setPrefs(readWorkspacePrefs());
    function onPrefs(e: Event) {
      setPrefs((e as CustomEvent<WorkspacePrefs>).detail);
    }
    window.addEventListener("zentra:workspaceprefs", onPrefs);
    return () => window.removeEventListener("zentra:workspaceprefs", onPrefs);
  }, []);

  if (!prefs || prefs.setupCompleted) return null;

  function pickPersona(modules: Record<ModuleKey, boolean>) {
    setPrefs(applyModuleSet(modules));
  }

  function dismiss() {
    setPrefs(markSetupCompleted());
  }

  return (
    <div
      className="zn-card p-5 flex flex-col gap-4"
      style={{ background: "var(--zn-bg-2)", borderColor: "var(--zn-line)" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="zn-label !p-0 mb-1.5">Workspace setup</div>
          <h2
            className="text-[18px] leading-[1.3]"
            style={{
              fontFamily: "var(--font-newsreader), ui-serif, Georgia, serif",
              color: "var(--zn-ink)",
              fontWeight: 500,
            }}
          >
            What do you want Zentra to help you with?
          </h2>
          <p className="text-[12.5px] mt-1.5" style={{ color: "var(--zn-ink-3)" }}>
            Pick a preset to set up your sidebar and dashboard. You can change it anytime in Settings.
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="rounded p-1 transition-colors hover:bg-[#ece3cc] dark:hover:bg-[#28231c]"
          aria-label="Dismiss workspace setup"
          title="Dismiss"
        >
          <X className="size-3.5" style={{ color: "var(--zn-ink-3)" }} />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {PERSONAS.map((persona) => (
          <button
            key={persona.id}
            type="button"
            onClick={() => pickPersona(persona.modules)}
            className="flex flex-col gap-1 rounded-lg border p-3 text-left transition-all hover:border-[var(--zn-accent)] hover:shadow-sm"
            style={{ borderColor: "var(--zn-line)", background: "var(--zn-surface)" }}
          >
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-semibold" style={{ color: "var(--zn-ink)" }}>
                {persona.label}
              </span>
              <ArrowRight className="size-3.5" style={{ color: "var(--zn-ink-3)" }} />
            </div>
            <span className="text-[11.5px] leading-snug" style={{ color: "var(--zn-ink-3)" }}>
              {persona.description}
            </span>
          </button>
        ))}
      </div>

      <Link
        href="/settings?tab=workspace"
        className="self-start zn-pill zn-pill-ghost"
        style={{ height: 28, fontSize: 12, padding: "0 11px" }}
      >
        <SettingsIcon className="size-3.5" />
        Customise modules individually
      </Link>
    </div>
  );
}

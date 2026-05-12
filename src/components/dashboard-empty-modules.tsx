"use client";

/**
 * Empty state shown when the user has disabled every module — the dashboard
 * would otherwise be a blank page. Nudges them back to Workspace setup.
 */

import Link from "next/link";
import { useEffect, useState } from "react";
import { Settings as SettingsIcon, Sparkles } from "lucide-react";

import { readWorkspacePrefs, type WorkspacePrefs } from "@/lib/prefs";

export function DashboardEmptyModules() {
  const [prefs, setPrefs] = useState<WorkspacePrefs | null>(null);

  useEffect(() => {
    setPrefs(readWorkspacePrefs());
    function onPrefs(e: Event) {
      setPrefs((e as CustomEvent<WorkspacePrefs>).detail);
    }
    window.addEventListener("zentra:workspaceprefs", onPrefs);
    return () => window.removeEventListener("zentra:workspaceprefs", onPrefs);
  }, []);

  if (!prefs) return null;

  const noneEnabled = Object.values(prefs.modules).every((v) => !v);
  if (!noneEnabled) return null;

  return (
    <div
      className="zn-card overflow-hidden p-0 flex flex-col md:flex-row"
      style={{ background: "var(--zn-bg-inverse)", borderColor: "var(--zn-bg-inverse)" }}
    >
      <div className="flex-1 p-7" style={{ color: "var(--zn-surface)" }}>
        <div
          className="zn-label !p-0 mb-2 inline-flex items-center gap-1.5"
          style={{ color: "rgba(250,245,232,0.55)" }}
        >
          <Sparkles className="size-3.5" />
          Workspace empty
        </div>
        <h2
          className="text-[22px] md:text-[24px] leading-[1.2] mb-3"
          style={{
            fontFamily: "var(--font-newsreader), ui-serif, Georgia, serif",
            fontWeight: 500,
          }}
        >
          Nothing's turned on yet.
        </h2>
        <p className="text-[13.5px] leading-relaxed max-w-[55ch]" style={{ color: "rgba(250,245,232,0.7)" }}>
          Pick the parts of Zentra you want to use — chasing overdue invoices,
          tracking cash flow, logging expenses, planning tax, or running reports.
          You can enable as many or as few as you need.
        </p>
        <div className="flex flex-wrap items-center gap-2 mt-5">
          <Link
            href="/settings?tab=workspace"
            className="zn-pill"
            style={{ background: "var(--zn-accent)", color: "var(--zn-accent-ink)" }}
          >
            <SettingsIcon className="size-3.5" />
            Set up workspace
          </Link>
        </div>
      </div>
    </div>
  );
}

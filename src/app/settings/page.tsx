import Link from "next/link";
import { ArrowRight, Plug } from "lucide-react";
import { SettingsForm } from "@/components/settings-form";
import { AddonSuccessBanner } from "@/components/addon-success-banner";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Settings",
  description: "Tone defaults, integrations, plan, and account preferences.",
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  return (
    <div className="flex flex-col gap-4">
      <AddonSuccessBanner addonSuccess={params.addon_success} />

      {/* Integrations discoverability strip */}
      <Link
        href="/settings/integrations"
        className="group flex items-center justify-between gap-4 rounded-xl px-4 py-3 transition-colors hover:bg-[var(--zn-surface-2)]"
        style={{
          background: "var(--zn-surface)",
          border:     "1px solid var(--zn-line-soft)",
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="size-8 rounded-lg flex items-center justify-center"
            style={{ background: "var(--zn-bg-2)", color: "var(--zn-ink-2)" }}
          >
            <Plug className="size-4" />
          </div>
          <div>
            <p className="text-[13.5px] font-semibold" style={{ color: "var(--zn-ink)" }}>
              Integrations
            </p>
            <p className="text-[12px]" style={{ color: "var(--zn-ink-3)" }}>
              Connect Xero or QuickBooks to skip CSV imports.
            </p>
          </div>
        </div>
        <ArrowRight
          className="size-4 transition-transform group-hover:translate-x-0.5"
          style={{ color: "var(--zn-ink-3)" }}
        />
      </Link>

      <SettingsForm defaultTab={params.tab} />
    </div>
  );
}

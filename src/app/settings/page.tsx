import Link from "next/link";
import { ArrowRight, Plug, FileText, Mail, Eye } from "lucide-react";
import { SettingsForm } from "@/components/settings-form";
import { AddonSuccessBanner } from "@/components/addon-success-banner";
import { ReferralCard } from "@/components/referral-card";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Settings",
  description: "Tone defaults, integrations, plan, and account preferences.",
};

/**
 * UX-4: Settings page used to render 4 large discoverability strips
 * stacked vertically above the form, then a ReferralCard, then the
 * 4-sub-tab SettingsForm. That was 9 visual blocks before the user
 * reached real settings. Now those discover cards are a compact 2×2
 * grid; ReferralCard moves to its own collapsed-by-default row.
 */

const DISCOVER_LINKS = [
  {
    href: "/settings/integrations",
    icon: Plug,
    label: "Integrations",
    desc: "Xero, QuickBooks, Sage, FreeAgent & GoCardless.",
    external: false,
  },
  {
    href: "/settings/templates",
    icon: FileText,
    label: "Email templates",
    desc: "Starter chase templates you can fork and save.",
    external: false,
  },
  {
    href: "/digest",
    icon: Mail,
    label: "Weekly digest",
    desc: "Sunday-evening summary of the week ahead.",
    external: false,
  },
  {
    href: "/demo/portal",
    icon: Eye,
    label: "Customer portal preview",
    desc: "See what your customers see when you send a chase.",
    external: true,
  },
] as const;

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  return (
    <div className="flex flex-col gap-5">
      <AddonSuccessBanner addonSuccess={params.addon_success} />

      {/* Discover — compact 2×2 grid instead of 4 stacked banners */}
      <div className="grid gap-3 sm:grid-cols-2">
        {DISCOVER_LINKS.map((l) => {
          const Icon = l.icon;
          const target = l.external ? { target: "_blank", rel: "noopener noreferrer" } : {};
          return (
            <Link
              key={l.href}
              href={l.href}
              {...target}
              className="group flex items-center justify-between gap-3 rounded-xl px-3.5 py-2.5 transition-colors hover:bg-[var(--zn-surface-2)]"
              style={{
                background: "var(--zn-surface)",
                border: "1px solid var(--zn-line-soft)",
              }}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className="size-7 rounded-md flex items-center justify-center shrink-0"
                  style={{ background: "var(--zn-bg-2)", color: "var(--zn-ink-2)" }}
                >
                  <Icon className="size-3.5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold truncate" style={{ color: "var(--zn-ink)" }}>
                    {l.label}
                  </p>
                  <p className="text-[11.5px] truncate" style={{ color: "var(--zn-ink-3)" }}>
                    {l.desc}
                  </p>
                </div>
              </div>
              <ArrowRight
                className="size-3.5 transition-transform group-hover:translate-x-0.5 shrink-0"
                style={{ color: "var(--zn-ink-3)" }}
              />
            </Link>
          );
        })}
      </div>

      {/* Referral flywheel — invite a colleague, earn +1 ledger slot */}
      <ReferralCard />

      <SettingsForm defaultTab={params.tab} />
    </div>
  );
}

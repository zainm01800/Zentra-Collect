/**
 * src/components/demo-banner.tsx
 *
 * Rich demo-mode banner shown across demo-accessible pages.
 *
 * Variants:
 *   "dashboard" — full width with computed stats summary line and all three CTAs.
 *   "compact"   — single-line with badge + copy + primary CTA. Used on digest/portfolio.
 *
 * The banner is deliberately non-alarming (not amber/red). It should
 * feel like an invitation to try the real product, not a restriction.
 */

import Link from "next/link";
import { ArrowRight, DatabaseZap, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

// ── CTA definitions ───────────────────────────────────────────────────────────

const TRIAL_CTA = {
  href: "/onboarding",
  label: "Start 14-day trial",
};

const BOOKKEEPER_CTA = {
  href: "/pricing#bookkeeper",
  label: "Bookkeeper plans",
};

const PRICING_CTA = {
  href: "/pricing",
  label: "View pricing",
};

// ── Dashboard variant ─────────────────────────────────────────────────────────

export function DemoDashboardBanner() {
  return (
    <div className="rounded-2xl border border-black/8 bg-white dark:bg-[#211d17] p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-[#f3ecd8] dark:bg-[#28231c]">
            <DatabaseZap className="size-3.5 text-[#6b6253] dark:text-[#8a7d69]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-[#1d1813] dark:text-[#f0e8d5]">
                Sample data — Acme Studio Ltd
              </p>
              <span className="rounded-full bg-[#1d1813] px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-white">
                Demo
              </span>
            </div>
            <p className="text-xs leading-5 text-[#8d8472] dark:text-[#6a5f4e]">
              Realistic sample invoices. Status changes persist in this session. No real data is saved.
            </p>
          </div>
        </div>

        {/* CTAs */}
        <div className="flex shrink-0 flex-wrap items-center gap-2 pl-11 sm:pl-0">
          <Button
            asChild
            size="sm"
            className="rounded-full bg-[#1d1813] text-white hover:bg-[#3d3428]"
          >
            <Link href={TRIAL_CTA.href}>
              {TRIAL_CTA.label}
              <ArrowRight className="size-3.5" />
            </Link>
          </Button>
          <Button
            asChild
            size="sm"
            variant="outline"
            className="rounded-full border-black/15 hover:bg-[#faf5e8] dark:bg-[#211d17]"
          >
            <Link href={BOOKKEEPER_CTA.href}>
              <Users className="size-3.5" />
              {BOOKKEEPER_CTA.label}
            </Link>
          </Button>
          <Link
            href={PRICING_CTA.href}
            className="text-xs font-medium text-[#a09885] dark:text-[#8a7d69] underline underline-offset-2 hover:text-[#3d3428] dark:text-[#d8ccb5]"
          >
            {PRICING_CTA.label}
          </Link>
        </div>
      </div>
    </div>
  );
}

// ── Compact variant (digest, portfolio) ───────────────────────────────────────

interface CompactBannerProps {
  /** Short context line after the badge. Defaults to the generic demo copy. */
  message?: string;
}

export function DemoCompactBanner({
  message = "You're viewing sample data. Start a trial to upload your own invoices.",
}: CompactBannerProps) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-black/8 bg-white dark:bg-[#211d17] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2.5">
        <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-[#f3ecd8] dark:bg-[#28231c]">
          <DatabaseZap className="size-3.5 text-[#8d8472] dark:text-[#6a5f4e]" />
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-[#1d1813] px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-white">
            Demo
          </span>
          <p className="text-sm text-[#6b6253] dark:text-[#8a7d69]">{message}</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3 pl-9 sm:pl-0">
        <Button
          asChild
          size="sm"
          className="rounded-full bg-[#1d1813] text-white hover:bg-[#3d3428]"
        >
          <Link href={TRIAL_CTA.href}>
            Start free trial
            <ArrowRight className="size-3.5" />
          </Link>
        </Button>
        <Link
          href={PRICING_CTA.href}
          className="text-xs font-medium text-[#a09885] dark:text-[#8a7d69] underline underline-offset-2 hover:text-[#3d3428] dark:text-[#d8ccb5]"
        >
          View pricing
        </Link>
      </div>
    </div>
  );
}

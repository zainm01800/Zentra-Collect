/**
 * src/components/access/upgrade-screen.tsx
 *
 * Shown in place of a gated page when the user's plan doesn't include
 * the requested feature. Renders within the AppShell (nav stays visible).
 *
 * Design principles:
 * - Calm and helpful — not a hard wall, not a scary error
 * - Show what the feature does, not just what they can't access
 * - One clear primary action, one secondary escape hatch
 * - Plan/price context so the decision is easy to make
 */

import Link from "next/link";
import { ArrowRight, Check, FileText, FileUp, LayoutGrid, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { UpgradePromptConfig } from "@/lib/access/features";
import { upgradeTargetLabel } from "@/lib/access/features";
import type { Feature } from "@/lib/access/features";

// ── Feature icon map ──────────────────────────────────────────────────────────

function FeatureIcon({ feature }: { feature: Feature }) {
  const cls = "size-6 text-neutral-600 dark:text-[#8a7d69]";
  switch (feature) {
    case "real_import":
      return <FileUp className={cls} />;
    case "weekly_digest":
      return <FileText className={cls} />;
    case "bookkeeper_portfolio":
      return <LayoutGrid className={cls} />;
    default:
      return <Lock className={cls} />;
  }
}

// ── Main component ────────────────────────────────────────────────────────────

interface UpgradeScreenProps {
  feature: Feature;
  config: UpgradePromptConfig;
}

export function UpgradeScreen({ feature, config }: UpgradeScreenProps) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-lg">

        {/* Icon */}
        <div className="mb-6 flex size-14 items-center justify-center rounded-2xl border border-black/8 bg-white dark:bg-[#211d17] shadow-sm">
          <FeatureIcon feature={feature} />
        </div>

        {/* Heading + description */}
        <h1 className="text-3xl font-semibold tracking-tight text-neutral-950 dark:text-[#f0e8d5]">
          {config.heading}
        </h1>
        <p className="mt-3 text-base leading-7 text-neutral-500 dark:text-[#8a7d69]">
          {config.description}
        </p>

        {/* Feature bullets */}
        {config.bullets.length > 0 && (
          <ul className="mt-6 space-y-2.5">
            {config.bullets.map((bullet) => (
              <li key={bullet} className="flex items-start gap-2.5">
                <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                <span className="text-sm text-neutral-700 dark:text-[#d8ccb5]">{bullet}</span>
              </li>
            ))}
          </ul>
        )}

        {/* CTAs */}
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Button
            asChild
            className="rounded-full bg-neutral-950 px-5 text-white hover:bg-neutral-800"
          >
            <Link href={config.ctaPrimary.href}>
              {config.ctaPrimary.text}
              <ArrowRight className="size-3.5" />
            </Link>
          </Button>
          <Link
            href={config.ctaSecondary.href}
            className="text-sm font-medium text-neutral-500 dark:text-[#8a7d69] underline underline-offset-2 hover:text-neutral-800"
          >
            {config.ctaSecondary.text}
          </Link>
        </div>

        {/* Plan/price note */}
        {config.upgradeTarget && (
          <p className="mt-6 text-xs text-neutral-400">
            {feature === "real_import"
              ? "Included from "
              : "Included in "}
            <span className="font-medium text-neutral-600 dark:text-[#8a7d69]">
              {upgradeTargetLabel(config.upgradeTarget)}
            </span>
            {" · "}
            All prices exclude VAT
          </p>
        )}
      </div>
    </div>
  );
}

// ── Portfolio preview banner ──────────────────────────────────────────────────

/**
 * A soft top-of-page banner shown on the portfolio page for users whose plan
 * doesn't include the bookkeeper portfolio feature. The page content (demo
 * data) remains visible so they can evaluate the feature before upgrading.
 *
 * Used instead of a hard UpgradeScreen for portfolio because the spec says
 * "preview/upgrade prompt" — not a full block.
 */
interface PortfolioPreviewBannerProps {
  config: UpgradePromptConfig;
  /** true when the account is on Business (personalised copy) */
  isSinglePlan: boolean;
}

export function PortfolioPreviewBanner({
  config,
  isSinglePlan,
}: PortfolioPreviewBannerProps) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white dark:bg-[#211d17] px-5 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-neutral-100 dark:bg-[#28231c]">
          <LayoutGrid className="size-4 text-neutral-600 dark:text-[#8a7d69]" />
        </div>
        <div>
          <p className="text-sm font-semibold text-neutral-950 dark:text-[#f0e8d5]">
            {isSinglePlan
              ? "Portfolio view — Bookkeeper plans only"
              : "Portfolio preview"}
          </p>
          <p className="mt-0.5 text-xs leading-5 text-neutral-500 dark:text-[#8a7d69]">
            {isSinglePlan
              ? "You're on Business. Upgrade to Practice to manage up to 5 real client ledgers."
              : "You're viewing demo portfolio data. Upgrade to manage your own client ledgers."}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3 pl-11 sm:pl-0">
        <Button
          asChild
          size="sm"
          className="rounded-full bg-neutral-950 text-white hover:bg-neutral-800"
        >
          <Link href={config.ctaPrimary.href}>
            {config.ctaPrimary.text}
            <ArrowRight className="size-3.5" />
          </Link>
        </Button>
        <Link
          href="/pricing"
          className="text-xs font-medium text-neutral-500 dark:text-[#8a7d69] underline underline-offset-2 hover:text-neutral-700 dark:text-[#d8ccb5]"
        >
          Compare plans
        </Link>
      </div>
    </div>
  );
}

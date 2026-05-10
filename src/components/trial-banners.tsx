/**
 * src/components/trial-banners.tsx
 *
 * Trial expiry and grace period UX.
 *
 * Timeline after sign-up:
 *   Day 1–14    Trial active   → no banner here (account settings shows countdown)
 *   Day 15–44   Grace period   → TrialExpiredBanner (calm; data is safe, date shown)
 *   Day 45+     Grace ended    → GracePeriodExpiredBanner (direct; deletion scheduled)
 *
 * Tone:
 *   Calm and informative — not threatening or punitive.
 *   Users should feel invited to upgrade, not scared of losing data.
 *
 * TODO (production): Wire up a deletion job that actually removes trial data
 *   after the grace period ends. This job should:
 *   1. Run nightly (pg_cron or Vercel Cron) against `account_usage` table.
 *   2. For accounts where `gracePeriodEndsAt < now()` and `plan_id = 'trial'`,
 *      cascade-delete invoices, import batches, and client ledgers.
 *   3. Send a deletion confirmation email to the account holder.
 *   4. Mark the account as `status: 'deleted'` rather than hard-deleting the
 *      row, so the email address cannot be re-used without support intervention.
 *   Until this job exists, no data is ever deleted — these banners are display-
 *   only. The copy says "scheduled for deletion" which is accurate in intent.
 */

"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight, Clock, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatGraceDate } from "@/lib/usage/tracker";
import { useLocalAccount } from "@/lib/billing/use-local-account";

// ── Shared export placeholder ─────────────────────────────────────────────────

/**
 * Disabled "Export data" button — placeholder until the export feature is built.
 *
 * TODO (production): Replace with a working export button that triggers a
 *   server action to generate and download a ZIP of all invoice CSVs,
 *   activity logs, and import history for the account.
 */
function ExportDataButton() {
  return (
    <Button
      variant="outline"
      size="sm"
      disabled
      className="rounded-full disabled:opacity-60"
      title="Data export — coming soon"
    >
      <Download className="size-3.5" />
      Export data
      <span className="ml-1 rounded bg-neutral-100 px-1.5 py-0.5 text-[0.65rem] font-medium text-neutral-400">
        Coming soon
      </span>
    </Button>
  );
}

// ── Trial expired, still within grace period ──────────────────────────────────

interface TrialExpiredBannerProps {
  /** ISO date string of grace period end, e.g. "2026-06-14". */
  gracePeriodEndsAt: string;
  /** Days until grace period ends (0 = today). */
  daysRemaining: number;
}

export function TrialExpiredBanner({
  gracePeriodEndsAt,
  daysRemaining,
}: TrialExpiredBannerProps) {
  const formattedDate = formatGraceDate(gracePeriodEndsAt);

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-[#d4c9ae] bg-[#ecdcae]/60 px-4 py-3.5 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex items-start gap-3">
        <Clock className="mt-0.5 size-4 shrink-0 text-[#a07522]" />
        <div>
          <p className="text-sm font-semibold text-[#1d1813]">
            Your trial has ended
          </p>
          <p className="mt-0.5 text-xs leading-5 text-[#6b6253]">
            Your data will remain available until{" "}
            <span className="font-medium">{formattedDate}</span>
            {daysRemaining > 0 && (
              <> ({daysRemaining} day{daysRemaining === 1 ? "" : "s"} left)</>
            )}
            . New imports and AI drafts require a paid plan. You can still
            view your chase plan and review existing invoices.
          </p>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2 pl-7 sm:pl-0">
        <Button
          asChild
          size="sm"
          className="rounded-full bg-[#1d1813] text-[#faf5e8] hover:bg-[#3d3428]"
        >
          <Link href="/request-access">
            Upgrade now
            <ArrowRight className="size-3.5" />
          </Link>
        </Button>
        <ExportDataButton />
        <Link
          href="/pricing"
          className="text-xs font-medium text-[#a07522] underline underline-offset-2 hover:text-[#1d1813]"
        >
          View plans
        </Link>
      </div>
    </div>
  );
}

// ── Grace period over ─────────────────────────────────────────────────────────

/**
 * Shown after the 30-day grace period has lapsed.
 *
 * Copy says "scheduled for deletion" — truthful because the production deletion
 * job will run at this point. In the current demo/beta, no data is actually
 * deleted (no deletion job exists yet).
 *
 * TODO (production): Once the deletion job is live, add the specific deletion
 *   date if known (e.g. fetched from the `account_usage` table's
 *   `scheduled_deletion_at` column). This gives users a precise window.
 */
export function GracePeriodExpiredBanner() {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-[#d4c9ae] bg-[#efcdc9]/50 px-4 py-3.5 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[#9a3535]" />
        <div>
          <p className="text-sm font-semibold text-[#9a3535]">
            Your trial data is scheduled for deletion
          </p>
          <p className="mt-0.5 text-xs leading-5 text-[#9a3535]">
            Your 30-day data retention period has ended. Export your invoices
            and history now, or upgrade to keep everything and continue using
            Zentra Collect.
          </p>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2 pl-7 sm:pl-0">
        <Button
          asChild
          size="sm"
          className="rounded-full bg-[#1d1813] text-[#faf5e8] hover:bg-[#3d3428]"
        >
          <Link href="/request-access">
            Upgrade to keep data
            <ArrowRight className="size-3.5" />
          </Link>
        </Button>
        <ExportDataButton />
      </div>
    </div>
  );
}

// ── Orchestrator — picks the right banner ─────────────────────────────────────

/**
 * Server component — injected into AppShell so the trial warning appears on
 * every app page without each page having to know about it.
 *
 * Renders null for:
 *   - Demo accounts (tier = "free")
 *   - Active trial accounts (not yet expired)
 *   - Paid accounts
 *
 * Renders TrialExpiredBanner when:
 *   - Trial has expired AND grace period is still active
 *
 * Renders GracePeriodExpiredBanner when:
 *   - Trial has expired AND grace period has also ended
 *
 * TODO (production): Replace DEMO_ACCOUNT_ID with the authenticated
 *   session user's account ID.
 */
export function TrialStatusBanner() {
  const { user } = useLocalAccount();

  // Only relevant for trial accounts
  if (!user || user.planId !== "trial") return null;

  const trialEndsMs = user.trialEndsAt ? new Date(user.trialEndsAt).getTime() : 0;
  const graceEndsMs = user.graceEndsAt ? new Date(user.graceEndsAt).getTime() : 0;
  const now = Date.now();

  // Trial still active — no banner (sidebar pill carries the countdown)
  if (trialEndsMs > now) return null;

  // Within grace period: trial ended, data still safe
  if (graceEndsMs > now) {
    const daysRemaining = Math.ceil((graceEndsMs - now) / 86_400_000);
    return (
      <TrialExpiredBanner
        gracePeriodEndsAt={new Date(graceEndsMs).toISOString()}
        daysRemaining={daysRemaining}
      />
    );
  }

  // Grace period over — data scheduled for deletion
  return <GracePeriodExpiredBanner />;
}

"use client";

import Link from "next/link";
import { ArrowRight, FileSpreadsheet, Lock, ShieldCheck } from "lucide-react";
import { useLocalAccount } from "@/lib/billing/use-local-account";
import { PageHeader } from "@/components/page-header";
import { ZentraImportFlow } from "@/components/zentra-import-flow";

/**
 * Import is gated for:
 *  - Demo accounts (no real data, sample only)
 *  - Trials whose 14-day window has ended (must upgrade to keep importing)
 *
 * Showing the locked panel up-front (rather than at the final click of the
 * 4-step flow) is honest UX — users know what they need before investing time.
 */
export function ImportGate() {
  const { user, account } = useLocalAccount();
  const isDemo = !account || account.planId === "demo";

  // Trial expired? gate them out the same way as demo
  const trialExpired =
    user?.planId === "trial" &&
    !!user.trialEndsAt &&
    new Date(user.trialEndsAt).getTime() <= Date.now();

  if (isDemo || trialExpired) {
    return <LockedImport variant={trialExpired ? "trial-ended" : "demo"} />;
  }
  return <ZentraImportFlow />;
}

function LockedImport({ variant }: { variant: "demo" | "trial-ended" }) {
  const isTrial = variant === "trial-ended";
  const copy = isTrial
    ? {
        kicker: "Trial ended",
        title: "Upgrade to keep importing",
        body:
          "Your 14-day trial has ended. Your existing invoices and chase plan stay available for 30 days, but new imports and AI drafts need a paid plan. You can also export everything before it's deleted.",
        primary: { href: "/#pricing", label: "View pricing", icon: true },
        secondary: { href: "mailto:hello@zentracollect.co.uk?subject=Upgrade%20my%20Zentra%20trial", label: "Email support" },
        safetyLine: "Your data is safe. Nothing is deleted during the 30-day grace period.",
      }
    : {
        kicker: "Demo workspace",
        title: "Importing your own data needs a trial or paid plan",
        body:
          "Demo accounts use sample data only — so you can explore the dashboard, review drawer and decisioning logic safely before connecting your own invoices. Start a 14-day trial (no card required) or pick a paid plan to upload real AR exports.",
        primary: { href: "/login?mode=signup", label: "Start a free trial", icon: true },
        secondary: { href: "/#pricing", label: "View pricing" },
        safetyLine: "Your data stays yours. Trials don't require a card and you can export everything before they end.",
      };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        kicker="Bring data in"
        title="Upload overdue invoices"
        sub="Bring in an AR ageing or unpaid invoice export, map the columns, and turn it into a ranked collections plan."
      />

      <div
        className="zn-card overflow-hidden p-0 flex flex-col lg:flex-row"
      >
        {/* Left: lock panel */}
        <div className="flex-1 p-6 lg:p-8">
          <div
            className="size-10 rounded-lg inline-flex items-center justify-center mb-4"
            style={{
              background: "var(--zn-warn-soft)",
              color: "var(--zn-warn)",
            }}
          >
            <Lock className="size-5" />
          </div>
          <div className="zn-label !p-0 mb-1.5">{copy.kicker}</div>
          <h2
            className="text-[22px] leading-tight mb-2 text-[#1d1813]"
            style={{
              fontFamily: "var(--font-newsreader), ui-serif, Georgia, serif",
              fontWeight: 500,
            }}
          >
            {copy.title}
          </h2>
          <p className="text-[13.5px] leading-relaxed text-[#6b6253] max-w-[480px]">
            {copy.body}
          </p>

          <div className="flex flex-wrap items-center gap-2 mt-5">
            <Link href={copy.primary.href} className="zn-pill">
              {copy.primary.label} {copy.primary.icon ? <ArrowRight className="size-3.5" /> : null}
            </Link>
            <Link href={copy.secondary.href} className="zn-pill zn-pill-ghost">
              {copy.secondary.label}
            </Link>
          </div>

          <div
            className="mt-6 flex items-start gap-2 rounded-[10px] p-3 text-[12.5px] leading-relaxed"
            style={{
              background: "var(--zn-surface-2)",
              border: "1px solid var(--zn-line-soft)",
              color: "var(--zn-ink-3)",
            }}
          >
            <ShieldCheck className="size-3.5 flex-shrink-0 mt-0.5" style={{ color: "var(--zn-safe)" }} />
            <span>{copy.safetyLine}</span>
          </div>
        </div>

        {/* Right side panel — trial unlocks (demo) or paid-plan unlocks (trial-ended) */}
        <div
          className="lg:w-[320px] p-6 lg:p-7 flex flex-col gap-3"
          style={{
            background: "var(--zn-surface-2)",
            borderLeft: "1px solid var(--zn-line-soft)",
          }}
        >
          <div className="flex items-center gap-2 mb-1">
            <FileSpreadsheet className="size-4" style={{ color: "var(--zn-accent)" }} />
            <div className="zn-label !p-0">{isTrial ? "Paid plan unlocks" : "Trial unlocks"}</div>
          </div>
          {(isTrial
            ? [
                { label: "CSV / Excel imports", value: "Unlimited" },
                { label: "Active invoices",     value: "500+" },
                { label: "AI draft messages",   value: "200+ / mo" },
                { label: "Saved import mappings", value: "Included" },
                { label: "Weekly digest history", value: "Included" },
              ]
            : [
                { label: "CSV / Excel imports", value: "5 / month" },
                { label: "Active invoices",     value: "100" },
                { label: "AI draft messages",   value: "25" },
                { label: "Re-import comparison", value: "Included" },
                { label: "Saved column mappings", value: "Included" },
              ]
          ).map((row) => (
            <div
              key={row.label}
              className="flex items-center justify-between py-2"
              style={{ borderBottom: "1px solid var(--zn-line-soft)" }}
            >
              <span className="text-[12.5px] text-[#6b6253]">{row.label}</span>
              <span className="text-[12.5px] font-semibold tabular-nums text-[#1d1813]">
                {row.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Existing-data CTA — different framing per variant */}
      <div className="zn-card p-5 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[13.5px] font-semibold text-[#1d1813]">
            {isTrial ? "Your existing data is still here" : "Want to see how an import looks?"}
          </div>
          <div className="text-[12.5px] text-[#6b6253] mt-0.5">
            {isTrial
              ? "Your invoices, customers and chase plan are all viewable. Pick up where you left off."
              : "Open the demo dashboard — it's populated with realistic sample invoices already mapped and ranked."}
          </div>
        </div>
        <Link href="/dashboard" className="zn-pill zn-pill-ghost flex-shrink-0">
          {isTrial ? "Open dashboard" : "Open demo dashboard"} <ArrowRight className="size-3.5" />
        </Link>
      </div>
    </div>
  );
}

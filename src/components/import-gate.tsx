"use client";

import Link from "next/link";
import { ArrowRight, FileSpreadsheet, Lock, ShieldCheck } from "lucide-react";
import { useLocalAccount } from "@/lib/billing/use-local-account";
import { PageHeader } from "@/components/page-header";
import { ZentraImportFlow } from "@/components/zentra-import-flow";

/**
 * Demo accounts are blocked from importing real data.
 * Showing the locked panel up-front (rather than at the final click of the
 * 4-step flow) is honest UX — they know what they need before investing time.
 */
export function ImportGate() {
  const { account } = useLocalAccount();
  const isDemo = !account || account.planId === "demo";

  if (isDemo) return <DemoLockedImport />;
  return <ZentraImportFlow />;
}

function DemoLockedImport() {
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
          <div className="zn-label !p-0 mb-1.5">Demo workspace</div>
          <h2
            className="text-[22px] leading-tight mb-2 text-[#1d1813]"
            style={{
              fontFamily: "var(--font-newsreader), ui-serif, Georgia, serif",
              fontWeight: 500,
            }}
          >
            Importing your own data needs a trial or paid plan
          </h2>
          <p className="text-[13.5px] leading-relaxed text-[#6b6253] max-w-[480px]">
            Demo accounts use sample data only — so you can explore the dashboard,
            review drawer and decisioning logic safely before connecting your own
            invoices. Start a 14-day trial (no card required) or pick a paid plan
            to upload real AR exports.
          </p>

          <div className="flex flex-wrap items-center gap-2 mt-5">
            <Link href="/login?mode=signup" className="zn-pill">
              Start a free trial <ArrowRight className="size-3.5" />
            </Link>
            <Link href="/#pricing" className="zn-pill zn-pill-ghost">
              View pricing
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
            <span>
              Your data stays yours. Trials don&apos;t require a card and you can
              export everything before they end.
            </span>
          </div>
        </div>

        {/* Right: what trial unlocks */}
        <div
          className="lg:w-[320px] p-6 lg:p-7 flex flex-col gap-3"
          style={{
            background: "var(--zn-surface-2)",
            borderLeft: "1px solid var(--zn-line-soft)",
          }}
        >
          <div className="flex items-center gap-2 mb-1">
            <FileSpreadsheet className="size-4" style={{ color: "var(--zn-accent)" }} />
            <div className="zn-label !p-0">Trial unlocks</div>
          </div>
          {[
            { label: "CSV / Excel imports", value: "5 / month" },
            { label: "Active invoices", value: "100" },
            { label: "AI draft messages", value: "25" },
            { label: "Re-import comparison", value: "Included" },
            { label: "Saved column mappings", value: "Included" },
          ].map((row) => (
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

      {/* Sample data link */}
      <div
        className="zn-card p-5 flex flex-wrap items-center justify-between gap-3"
      >
        <div className="min-w-0">
          <div className="text-[13.5px] font-semibold text-[#1d1813]">
            Want to see how an import looks?
          </div>
          <div className="text-[12.5px] text-[#6b6253] mt-0.5">
            Open the demo dashboard — it&apos;s populated with realistic sample
            invoices already mapped and ranked.
          </div>
        </div>
        <Link href="/dashboard" className="zn-pill zn-pill-ghost flex-shrink-0">
          Open demo dashboard <ArrowRight className="size-3.5" />
        </Link>
      </div>
    </div>
  );
}

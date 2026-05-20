"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { getPlanConfig, getPlanLimit, type PlanId } from "@/lib/account/plans";
import { CheckoutButton } from "@/components/billing/checkout-button";

// Plan price IDs — passed in from the server page.
// `priceIdAnnual` is optional — toggle hides itself when none configured.
export type PricingPlanDef = {
  planId:         PlanId;
  priceId?:       string;
  priceIdAnnual?: string;
};

const ANNUAL_DISCOUNT = 0.17; // ~2 months free

const pricingDescriptions: Record<string, string> = {
  DEMO:             "Sample data only.",
  FREE:             "For very small sole traders. 3 active invoices, real bank feed, real Self-Assessment estimate — forever free.",
  TRIAL:            "14 days, no card required. Real bank feed, real chase plan — at full power.",
  TRADER:           "For tiny sole traders who want real books and up to 25 active invoices — no AI needed.",
  FREELANCE:        "For sole traders billing 5–15 invoices a month. Templates, customer portal, full books.",
  STARTER_SOLO:     "For sole traders ready for AI-drafted chases and a fuller workflow.",
  SINGLE_BUSINESS:  "For one small business running a practical chase process.",
  BOOKKEEPER_STARTER: "For bookkeepers managing a handful of client ledgers.",
  BOOKKEEPER_PRO:   "For larger client portfolios that need more capacity.",
};

function formatLimit(value: number | "unlimited") {
  return value === "unlimited" ? "unlimited" : value.toLocaleString("en-GB");
}

function getPricingBullets(planId: PlanId) {
  const plan = getPlanConfig(planId);
  const activeInvoices = formatLimit(getPlanLimit(planId, "activeInvoiceCount") as number | "unlimited");
  const clientLedgers = getPlanLimit(planId, "clientLedgerCount");
  const aiActions =
    planId === "TRIAL"
      ? getPlanLimit(planId, "trialAiActionsUsed")
      : getPlanLimit(planId, "aiActionsUsedThisMonth");
  const imports =
    planId === "TRIAL"
      ? getPlanLimit(planId, "trialImportsUsed")
      : getPlanLimit(planId, "importsUsedThisMonth");

  if (planId === "TRIAL") {
    return [
      "No card required",
      `${activeInvoices} active invoices`,
      `${formatLimit(imports as number | "unlimited")} imports total`,
      `${formatLimit(aiActions as number | "unlimited")} AI actions`,
      "Export everything anytime",
    ];
  }

  if (planId === "FREE") {
    return [
      "3 active invoices",
      "Bank feed + auto-reconciliation",
      "Expenses + Self-Assessment estimate",
      "Template chases (no AI)",
      "Forever free, no card",
    ];
  }

  // UX-6/pricing: "0 AI actions / month" made plans look broken.
  // Replace with a positive, accurate description.
  const aiLabel =
    aiActions === 0
      ? "Template chases — no AI drafts"
      : `${formatLimit(aiActions as number | "unlimited")} AI actions / month`;

  return [
    plan.features.bookkeeperMode
      ? `Up to ${formatLimit(clientLedgers as number | "unlimited")} client ledgers`
      : `1 business`,
    `${activeInvoices} active invoices`,
    `${formatLimit(imports as number | "unlimited")} imports / month`,
    aiLabel,
    "Weekly digest preview",
  ];
}

// ── Feature comparison rows ────────────────────────────────────────────────────
const COMPARISON_ROWS: { feature: string; starter: string; single: string; bookkeeper: string }[] = [
  { feature: "Active invoices",      starter: "25",          single: "500",       bookkeeper: "2,000"      },
  { feature: "Imports / month",      starter: "2",           single: "10",        bookkeeper: "Unlimited"  },
  { feature: "AI actions / month",   starter: "25",          single: "200",       bookkeeper: "500"        },
  { feature: "Client ledgers",       starter: "1",           single: "1",         bookkeeper: "Up to 5"    },
  { feature: "Chase plan",           starter: "✓",           single: "✓",         bookkeeper: "✓"          },
  { feature: "Customers view",       starter: "✓",           single: "✓",         bookkeeper: "✓"          },
  { feature: "Promise tracking",     starter: "✓",           single: "✓",         bookkeeper: "✓"          },
  { feature: "Re-import comparison", starter: "—",           single: "✓",         bookkeeper: "✓"          },
  { feature: "Saved import mappings",starter: "—",           single: "✓",         bookkeeper: "✓"          },
  { feature: "Aged debt report",     starter: "—",           single: "✓",         bookkeeper: "✓"          },
  { feature: "Portfolio view",       starter: "—",           single: "—",         bookkeeper: "✓"          },
  { feature: "Weekly client brief",  starter: "—",           single: "—",         bookkeeper: "✓"          },
  { feature: "Export all data",      starter: "✓",           single: "✓",         bookkeeper: "✓"          },
  { feature: "Priority support",     starter: "—",           single: "Email",     bookkeeper: "Email + chat"},
];

// ── Main component ─────────────────────────────────────────────────────────────
export function PricingSection({
  plans,
  compact = false,  // hide intro paragraph + comparison strip (use when stacking multiple segments on one page)
}: {
  plans: PricingPlanDef[];
  compact?: boolean;
}) {
  const [annual, setAnnual] = useState(false);
  const [showComparison, setShowComparison] = useState(false);

  // Only show the annual toggle if at least one plan has an annual price ID
  // configured. Avoids promising a discount the user can't actually redeem.
  const annualAvailable = plans.some((p) => Boolean(p.priceIdAnnual));

  return (
    <div>
      {!compact && (
        <>
          <p className="-mt-2 mb-3 max-w-2xl text-[13.5px]" style={{ color: "var(--zn-ink-3)" }}>
            Start with the demo. Move to a 14-day trial when you&apos;re ready to
            import your own data. Upgrade to a paid plan to keep going.
          </p>

          {/* Audit §15: short positioning row above the plan cards. */}
          <div
            className="mb-6 inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[12px]"
            style={{ background: "var(--zn-surface-2)", border: "1px solid var(--zn-line-soft)", color: "var(--zn-ink-2)" }}
          >
            <span className="font-semibold">Compare:</span>
            <span>Chaser ~£40/mo · Satago ~£25/mo · Zentra Practice £119/mo —</span>
            <span className="font-medium">includes counterparty exposure, stop-chasing AI, and bookkeeper portfolio.</span>
          </div>
        </>
      )}

      {/* Billing toggle — hidden when no annual price IDs are configured */}
      {annualAvailable && (
        <div className="flex items-center gap-3 mb-6">
          <button
            type="button"
            onClick={() => setAnnual(false)}
            className="text-[13px] font-medium transition-colors"
            style={{ color: annual ? "var(--zn-ink-3)" : "var(--zn-ink)" }}
          >
            Monthly
          </button>
          <button
            type="button"
            role="switch"
            aria-checked={annual}
            onClick={() => setAnnual((a) => !a)}
            className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors"
            style={{ background: annual ? "var(--zn-ink)" : "var(--zn-line)" }}
          >
            <span
              className="inline-block size-3.5 rounded-full bg-white transition-transform"
              style={{ transform: annual ? "translateX(18px)" : "translateX(2px)" }}
            />
          </button>
          <button
            type="button"
            onClick={() => setAnnual(true)}
            className="flex items-center gap-1.5 text-[13px] font-medium transition-colors"
            style={{ color: annual ? "var(--zn-ink)" : "var(--zn-ink-3)" }}
          >
            Annual
            <span
              className="text-[10.5px] font-semibold px-1.5 py-0.5 rounded-full"
              style={{ background: "var(--zn-safe-soft)", color: "var(--zn-safe)" }}
            >
              Save ~17%
            </span>
          </button>
        </div>
      )}

      {/* Plan cards */}
      <div className="grid gap-3.5 md:grid-cols-2 lg:grid-cols-5">
        {plans.map(({ planId, priceId, priceIdAnnual }) => {
          // If user selected annual AND this plan has an annual price ID
          // configured, swap it in. Otherwise fall back to monthly.
          const effectivePriceId =
            annual && priceIdAnnual ? priceIdAnnual : priceId;
          const plan = getPlanConfig(planId);
          const isFeatured = planId === "SINGLE_BUSINESS";
          const isFree = plan.priceMonthlyGbp === 0;
          const monthlyPrice = plan.priceMonthlyGbp;
          const annualMonthly = Math.round(monthlyPrice * (1 - ANNUAL_DISCOUNT) * 100) / 100;
          const displayPrice = annual && !isFree ? annualMonthly : monthlyPrice;

          return (
            <div
              key={plan.id}
              // Audit §7: on mobile (single column), the "Recommended"
              // plan should sit at the top of the stack, not buried mid-list.
              // order-first on mobile, restored at sm: via order-none.
              className={
                "zn-card p-5 flex flex-col" +
                (isFeatured ? " order-first sm:order-none" : "")
              }
              style={
                isFeatured
                  ? { borderColor: "var(--zn-ink)", boxShadow: "0 1px 0 rgba(29,24,19,0.04), 0 4px 18px -8px rgba(29,24,19,0.18)" }
                  : undefined
              }
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[13.5px] font-semibold text-[#1d1813] dark:text-[#f0e8d5]">{plan.name}</span>
                {isFeatured ? (
                  <span
                    className="zn-chip"
                    style={{ background: "var(--zn-accent)", color: "var(--zn-accent-ink)", borderColor: "transparent" }}
                  >
                    Recommended
                  </span>
                ) : null}
              </div>
              <div
                className="mt-1 text-[34px] tracking-[-0.02em] tabular-nums"
                style={{
                  fontFamily: "var(--font-newsreader), ui-serif, Georgia, serif",
                  fontWeight: 500,
                }}
              >
                {isFree ? "Free" : `£${displayPrice}`}
                {!isFree && (
                  <span className="text-[14px] ml-1" style={{ color: "var(--zn-ink-3)", fontFamily: "var(--font-geist-sans)" }}>
                    /mo{annual ? " (billed annually)" : ""}
                  </span>
                )}
              </div>
              {annual && !isFree && (
                <div className="text-[11.5px] mt-0.5" style={{ color: "var(--zn-safe)" }}>
                  Save £{Math.round((monthlyPrice - annualMonthly) * 12)} vs. monthly
                </div>
              )}
              <p className="mt-3 text-[13px] leading-[1.5] min-h-[42px]" style={{ color: "var(--zn-ink-3)" }}>
                {pricingDescriptions[plan.id]}
              </p>
              <div className="mt-4 flex flex-col gap-2 flex-1">
                {getPricingBullets(planId).map((feature) => (
                  <div key={feature} className="flex items-start gap-2 text-[12.5px] text-[#3d3428] dark:text-[#d8ccb5]">
                    <CheckCircle2 className="size-3.5 flex-shrink-0 mt-0.5" style={{ color: "var(--zn-safe)" }} />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
              <div className="mt-5">
                {planId === "FREE" ? (
                  <Link
                    href="/login?mode=signup&plan=free"
                    className="zn-pill zn-pill-ghost w-full justify-center"
                  >
                    Start free
                  </Link>
                ) : planId === "TRIAL" ? (
                  <Link href="/login?mode=signup" className="zn-pill zn-pill-ghost w-full justify-center">
                    Start free trial
                  </Link>
                ) : effectivePriceId ? (
                  <CheckoutButton
                    priceId={effectivePriceId}
                    planId={planId}
                    cta={annual ? "Get started (annual)" : "Get started"}
                    variant={isFeatured ? "primary" : "secondary"}
                  />
                ) : (
                  // No Stripe price configured for this plan in env. Send
                  // people to the trial signup instead of a dead waitlist
                  // — they can pick the right plan after the trial.
                  <Link
                    href="/login?mode=signup"
                    className="zn-pill zn-pill-ghost w-full justify-center"
                  >
                    Start free trial
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {!compact && (
        <p className="mt-6 text-[12.5px]" style={{ color: "var(--zn-ink-3)" }}>
          All plans include a 14-day free trial. No card required to start.{" "}
          <Link href="/request-access" className="underline underline-offset-2">Contact us</Link>{" "}
          if you need a custom plan.
        </p>
      )}

      {/* Feature comparison toggle — hidden in compact mode to avoid 3 copies */}
      {!compact && <div className="mt-8">
        <button
          type="button"
          onClick={() => setShowComparison((s) => !s)}
          className="text-[13px] font-medium underline underline-offset-2 transition-colors"
          style={{ color: "var(--zn-ink-3)" }}
        >
          {showComparison ? "Hide" : "Show"} full feature comparison
        </button>

        {showComparison && (
          <div className="mt-4 overflow-x-auto rounded-xl" style={{ border: "1px solid var(--zn-line-soft)" }}>
            <table className="w-full text-[12.5px]" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--zn-line-soft)", background: "var(--zn-surface-2)" }}>
                  <th className="text-left px-4 py-3 font-semibold" style={{ color: "var(--zn-ink-2)", width: "40%" }}>Feature</th>
                  <th className="text-center px-4 py-3 font-semibold" style={{ color: "var(--zn-ink-2)" }}>Starter</th>
                  <th className="text-center px-4 py-3 font-semibold" style={{ color: "var(--zn-ink)" }}>Business</th>
                  <th className="text-center px-4 py-3 font-semibold" style={{ color: "var(--zn-ink-2)" }}>Bookkeeper</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_ROWS.map((row, i) => (
                  <tr
                    key={row.feature}
                    style={{
                      borderBottom: i < COMPARISON_ROWS.length - 1 ? "1px solid var(--zn-line-soft)" : undefined,
                      background: i % 2 === 0 ? "var(--zn-surface)" : "var(--zn-surface-2)",
                    }}
                  >
                    <td className="px-4 py-2.5 font-medium" style={{ color: "var(--zn-ink-2)" }}>{row.feature}</td>
                    {[row.starter, row.single, row.bookkeeper].map((val, j) => (
                      <td
                        key={j}
                        className="px-4 py-2.5 text-center tabular-nums"
                        style={{
                          color: val === "—" ? "var(--zn-ink-3)" : val === "✓" ? "var(--zn-safe)" : "var(--zn-ink)",
                          fontWeight: val === "✓" || val === "—" ? 400 : 600,
                        }}
                      >
                        {val}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>}
    </div>
  );
}

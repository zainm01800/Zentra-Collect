import Link from "next/link";
import { ArrowRight, Check, Minus, Users } from "lucide-react";
import {
  PLANS,
  COMPARISON_ROWS,
  EVERY_PAID_PLAN_INCLUDES,
  FAQS,
  type Plan,
  type PlanId,
  type ComparisonCellValue,
} from "@/lib/billing/plans";

// ── Shared nav / footer ──────────────────────────────────────────────────────

function MarketingNav() {
  return (
    <header className="sticky top-0 z-20 border-b border-black/10 bg-[#fbf8f1]/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3 font-semibold">
          <span className="flex size-9 items-center justify-center rounded-xl bg-neutral-950 text-base font-bold text-white">
            Z
          </span>
          <span className="leading-tight">
            <span className="block tracking-[0.18em]">ZENTRA</span>
            <span className="block text-[0.68rem] font-medium uppercase tracking-[0.18em] text-neutral-500">
              Collect
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-6 text-sm font-medium text-neutral-600 md:flex">
          <Link href="/#how-it-works" className="transition-colors hover:text-neutral-950">
            How it works
          </Link>
          <Link href="/pricing" className="font-semibold text-neutral-950" aria-current="page">
            Pricing
          </Link>
          <Link href="/dashboard" className="transition-colors hover:text-neutral-950">
            Demo
          </Link>
        </nav>

        <Link
          href="/request-access"
          className="rounded-full bg-neutral-950 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-800"
        >
          Request access
        </Link>
      </div>
    </header>
  );
}

function MarketingFooter() {
  return (
    <footer className="border-t border-black/10">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex size-7 items-center justify-center rounded-lg bg-neutral-950 text-xs font-bold text-white">
              Z
            </span>
            <span className="text-sm font-medium text-neutral-950">Zentra Collect</span>
          </div>
          <p className="max-w-md text-xs text-neutral-400">
            Zentra Collect supports credit-control workflow and decision-making. It does not provide
            legal, accounting, or tax advice. All messages require human review before sending.
          </p>
        </div>
      </div>
    </footer>
  );
}

// ── Plan card ────────────────────────────────────────────────────────────────

function PlanCard({ plan, compact = false }: { plan: Plan; compact?: boolean }) {
  const isFreeish = plan.tier !== "paid";

  return (
    <div
      className={`relative flex flex-col rounded-2xl border p-6 ${
        plan.highlight
          ? "border-neutral-950 bg-white shadow-[0_4px_32px_rgba(0,0,0,0.10)]"
          : isFreeish
          ? "border-black/8 bg-neutral-50/60"
          : "border-black/8 bg-[#fbf8f1]"
      }`}
    >
      {plan.highlightLabel && (
        <div className="mb-4 inline-flex w-fit rounded-full bg-neutral-950 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-white">
          {plan.highlightLabel}
        </div>
      )}

      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-400">
        {plan.name}
      </p>

      <div className="mt-3 flex items-end gap-1">
        <span
          className={`font-semibold tracking-tight text-neutral-950 ${
            compact ? "text-4xl" : "text-5xl"
          }`}
        >
          {plan.priceDisplay}
        </span>
        {plan.periodDisplay && (
          <span className="mb-1.5 text-sm text-neutral-400">{plan.periodDisplay}</span>
        )}
      </div>

      <p className="mt-2 text-sm leading-6 text-neutral-500">{plan.tagline}</p>

      <div className="my-5 border-t border-black/8" />

      <ul className="flex-1 space-y-2.5">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2.5">
            <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" />
            <span className="text-sm text-neutral-700">{feature}</span>
          </li>
        ))}
      </ul>

      <Link
        href={plan.href}
        className={`mt-8 flex w-full items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-medium transition-colors ${
          plan.highlight
            ? "bg-neutral-950 text-white hover:bg-neutral-800"
            : isFreeish
            ? "border border-black/15 bg-white text-neutral-700 hover:bg-neutral-50"
            : "border border-black/15 bg-white text-neutral-950 hover:bg-neutral-50"
        }`}
      >
        {plan.cta}
        <ArrowRight className="size-3.5" />
      </Link>
    </div>
  );
}

// ── Comparison cell ──────────────────────────────────────────────────────────

function ComparisonCell({
  value,
  isHighlighted,
}: {
  value: ComparisonCellValue;
  isHighlighted: boolean;
}) {
  return (
    <td
      className={`px-4 py-3.5 text-center ${isHighlighted ? "bg-neutral-50/70" : ""}`}
    >
      {typeof value === "boolean" ? (
        value ? (
          <Check className="mx-auto size-4 text-emerald-600" />
        ) : (
          <Minus className="mx-auto size-4 text-neutral-300" />
        )
      ) : (
        <span className="text-sm font-medium text-neutral-900">{value}</span>
      )}
    </td>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function PricingPage() {
  const freePlans = PLANS.filter((p) => p.tier !== "paid");
  const paidPlans = PLANS.filter((p) => p.tier === "paid");

  // Ordered plan IDs for the comparison table columns
  const planIds = PLANS.map((p) => p.id) as PlanId[];

  return (
    <div className="min-h-screen bg-[#fbf8f1] text-neutral-950">
      <MarketingNav />

      <main>

        {/* ── Hero ──────────────────────────────────────────────────────── */}
        <section className="mx-auto max-w-7xl px-4 pb-12 pt-16 sm:px-6 sm:pb-16 sm:pt-24 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <div className="inline-flex items-center rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-medium text-neutral-600">
              Early access &middot; Beta pricing
            </div>
            <h1 className="mt-5 text-4xl font-semibold tracking-tight text-neutral-950 sm:text-5xl">
              Honest pricing. Clear limits.
            </h1>
            <p className="mt-4 text-lg leading-8 text-neutral-500">
              No Xero required. No per-invoice charges. No hidden limits. Cancel any time.
            </p>
          </div>
        </section>

        {/* ── Founding user callout ─────────────────────────────────────── */}
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2.5">
              <Users className="size-4 shrink-0 text-amber-700" />
              <p className="text-sm font-semibold text-amber-900">
                Founding user offer
              </p>
            </div>
            <p className="text-sm leading-6 text-amber-800">
              Founding users can get early access pricing from{" "}
              <strong className="font-semibold">£29/month</strong> while the product
              is in beta — with direct input on the roadmap.
            </p>
            <Link
              href="/request-access"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-amber-900 px-4 py-2 text-xs font-semibold text-amber-50 transition-colors hover:bg-amber-800"
            >
              Request founding access
              <ArrowRight className="size-3" />
            </Link>
          </div>
        </section>

        {/* ── Free tiers ────────────────────────────────────────────────── */}
        <section className="mx-auto max-w-7xl px-4 pt-12 sm:px-6 sm:pt-14 lg:px-8">
          <div className="mb-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">
              Start for free
            </p>
            <p className="mt-1 text-sm text-neutral-500">
              Try the product before spending anything.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:max-w-2xl">
            {freePlans.map((plan) => (
              <PlanCard key={plan.id} plan={plan} compact />
            ))}
          </div>
        </section>

        {/* ── Paid plans ────────────────────────────────────────────────── */}
        <section className="mx-auto max-w-7xl px-4 pt-10 sm:px-6 sm:pt-12 lg:px-8">
          <div className="mb-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">
              Paid plans
            </p>
            <p className="mt-1 text-sm text-neutral-500">
              All prices exclude VAT. Billed monthly. No contract.
            </p>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {paidPlans.map((plan) => (
              <PlanCard key={plan.id} plan={plan} />
            ))}
          </div>
        </section>

        {/* ── Included in every paid plan ───────────────────────────────── */}
        <section className="mt-16 border-t border-black/10 bg-white">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
            <div className="mb-8 max-w-xl">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">
                Included in every paid plan
              </p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-neutral-950">
                The same core engine, whatever you pay.
              </h2>
              <p className="mt-2 text-sm leading-6 text-neutral-500">
                Every plan runs on the same rules-based decision engine. There is no cut-down version — only the limits and portfolio features differ.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {EVERY_PAID_PLAN_INCLUDES.map((feature) => (
                <div
                  key={feature}
                  className="flex items-start gap-3 rounded-xl border border-black/8 bg-[#fbf8f1] px-4 py-3.5"
                >
                  <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                  <span className="text-sm text-neutral-700">{feature}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Comparison table ──────────────────────────────────────────── */}
        <section className="border-t border-black/10">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
            <div className="mb-8">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">
                Compare plans
              </p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-neutral-950">
                Every limit, side by side.
              </h2>
              <p className="mt-2 text-sm text-neutral-500">
                No hidden limits. What you see here is what the plan enforces.
              </p>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-black/8 bg-white">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-black/8">
                    {/* Label column */}
                    <th className="w-44 px-5 py-4 text-left text-xs font-medium text-neutral-400">
                      Feature
                    </th>
                    {PLANS.map((plan) => (
                      <th
                        key={plan.id}
                        className={`px-4 py-4 text-center ${
                          plan.highlight ? "bg-neutral-50/70" : ""
                        }`}
                      >
                        <span
                          className={`block text-xs font-semibold ${
                            plan.tier === "paid"
                              ? "text-neutral-950"
                              : "text-neutral-400"
                          }`}
                        >
                          {plan.name}
                        </span>
                        <span
                          className={`mt-0.5 block text-xs ${
                            plan.tier === "paid"
                              ? "font-medium text-neutral-500"
                              : "text-neutral-300"
                          }`}
                        >
                          {plan.priceDisplay}
                          {plan.periodDisplay}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/6">
                  {COMPARISON_ROWS.map(({ label, values }, rowIdx) => (
                    <tr
                      key={label}
                      className={rowIdx % 2 !== 0 ? "bg-neutral-50/30" : ""}
                    >
                      <td className="px-5 py-3.5 text-sm text-neutral-700">
                        {label}
                      </td>
                      {planIds.map((id) => (
                        <ComparisonCell
                          key={id}
                          value={values[id]}
                          isHighlighted={
                            PLANS.find((p) => p.id === id)?.highlight ?? false
                          }
                        />
                      ))}
                    </tr>
                  ))}

                  {/* Price + CTA row */}
                  <tr className="border-t-2 border-black/10 bg-[#fbf8f1]">
                    <td className="px-5 py-4 text-sm font-semibold text-neutral-950">
                      Monthly price
                    </td>
                    {PLANS.map((plan) => (
                      <td
                        key={plan.id}
                        className={`px-4 py-4 text-center ${
                          plan.highlight ? "bg-neutral-50/70" : ""
                        }`}
                      >
                        <div className="flex flex-col items-center gap-2">
                          <span className="text-base font-semibold text-neutral-950">
                            {plan.priceDisplay}
                            {plan.tier === "paid" && (
                              <span className="text-xs font-normal text-neutral-400">
                                /mo
                              </span>
                            )}
                          </span>
                          <Link
                            href={plan.href}
                            className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                              plan.highlight
                                ? "bg-neutral-950 text-white hover:bg-neutral-800"
                                : plan.tier !== "paid"
                                ? "border border-black/10 bg-white text-neutral-500 hover:bg-neutral-50"
                                : "border border-black/15 bg-white text-neutral-950 hover:bg-neutral-50"
                            }`}
                          >
                            {plan.cta}
                            <ArrowRight className="size-3" />
                          </Link>
                        </div>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ── FAQ ───────────────────────────────────────────────────────── */}
        <section className="border-t border-black/10 bg-white">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
            <div className="mb-10 max-w-xl">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">
                Questions
              </p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-neutral-950">
                Before you sign up.
              </h2>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {FAQS.map(({ q, a }) => (
                <div
                  key={q}
                  className="rounded-2xl border border-black/8 bg-[#fbf8f1] p-5"
                >
                  <p className="text-sm font-semibold text-neutral-950">{q}</p>
                  <p className="mt-2 text-sm leading-6 text-neutral-500">{a}</p>
                </div>
              ))}

              {/* Dark CTA card — fills the grid slot after 6 FAQs */}
              <div className="rounded-2xl border border-black/8 bg-neutral-950 p-5 text-white">
                <p className="text-sm font-semibold">Still have questions?</p>
                <p className="mt-2 text-sm leading-6 text-neutral-400">
                  Try the demo without signing up. It runs on pre-loaded sample invoices so you can explore the full chase plan, draft messages, and safety checks before connecting any real data.
                </p>
                <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                  <Link
                    href="/dashboard"
                    className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-medium text-neutral-950 transition-colors hover:bg-neutral-100"
                  >
                    Open the demo
                    <ArrowRight className="size-3" />
                  </Link>
                  <Link
                    href="/request-access"
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/20 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-white/10"
                  >
                    Request founding access
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Final CTA ─────────────────────────────────────────────────── */}
        <section className="border-t border-black/10">
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
            <div className="mx-auto max-w-xl text-center">
              <h2 className="text-3xl font-semibold tracking-tight text-neutral-950 sm:text-4xl">
                Start without paying anything.
              </h2>
              <p className="mt-4 text-base leading-7 text-neutral-500">
                The demo runs on sample invoices — no sign-up required. The
                14-day trial lets you import your own real data. Both are free.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
                <Link
                  href="/request-access"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-neutral-950 px-7 py-3.5 text-sm font-medium text-white transition-colors hover:bg-neutral-800"
                >
                  Request founding access
                  <ArrowRight className="size-4" />
                </Link>
                <Link
                  href="/dashboard"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-black/15 bg-white px-7 py-3.5 text-sm font-medium text-neutral-950 transition-colors hover:bg-neutral-50"
                >
                  Try the demo first
                </Link>
              </div>
              <p className="mt-4 text-xs text-neutral-400">
                Founding access is limited and granted individually. No payment taken during beta.
              </p>
            </div>
          </div>
        </section>

      </main>

      <MarketingFooter />
    </div>
  );
}

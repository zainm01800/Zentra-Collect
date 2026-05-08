import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { getLandingPlans, type Plan } from "@/lib/billing/plans";

// Landing page pricing cards — shows only the three paid tiers.
// All plan data (names, prices, features, limits, CTAs) is sourced from
// src/lib/billing/plans.ts. Do not hardcode plan values here.

function PlanCard({ plan }: { plan: Plan }) {
  return (
    <div
      className={`flex flex-col rounded-2xl border p-6 ${
        plan.landingHighlight
          ? "border-neutral-950 bg-white shadow-[0_4px_28px_rgba(0,0,0,0.09)]"
          : "border-black/8 bg-[#fbf8f1]"
      }`}
    >
      {plan.landingHighlight && plan.highlightLabel && (
        <div className="mb-4 inline-flex w-fit rounded-full bg-neutral-950 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-white">
          {plan.highlightLabel ?? "Most popular"}
        </div>
      )}

      <p className="text-sm font-semibold text-neutral-950">{plan.name}</p>

      <div className="mt-3 flex items-end gap-1">
        <span className="text-4xl font-semibold tracking-tight text-neutral-950">
          {plan.priceDisplay}
        </span>
        {plan.periodDisplay && (
          <span className="mb-1 text-sm text-neutral-400">{plan.periodDisplay}</span>
        )}
      </div>

      <p className="mt-3 text-sm leading-6 text-neutral-500">{plan.tagline}</p>

      <ul className="mt-6 flex-1 space-y-2.5">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2.5">
            <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" />
            <span className="text-sm text-neutral-700">{feature}</span>
          </li>
        ))}
      </ul>

      <Link
        href={plan.href}
        className={`mt-8 flex w-full items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition-colors ${
          plan.landingHighlight
            ? "bg-neutral-950 text-white hover:bg-neutral-800"
            : "border border-black/15 bg-white text-neutral-950 hover:bg-neutral-50"
        }`}
      >
        {plan.cta}
        <ArrowRight className="size-3.5" />
      </Link>
    </div>
  );
}

export function PricingSection() {
  const plans = getLandingPlans();

  return (
    <section id="pricing" className="border-t border-black/10">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="mb-10 max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">
            Pricing
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-neutral-950 sm:text-4xl">
            Simple plans. No per-invoice charges.
          </h2>
          <p className="mt-4 text-base leading-7 text-neutral-500">
            Try the demo with no sign-up. Start a 14-day free trial with your own data.
            Pricing applies when you move to a paid plan.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {plans.map((plan) => (
            <PlanCard key={plan.id} plan={plan} />
          ))}
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-neutral-400">
            All prices exclude VAT · Billed monthly · No contract required
          </p>
          <Link
            href="/pricing"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-neutral-600 transition-colors hover:text-neutral-950"
          >
            See full comparison and free tiers
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}

// Keep named export for legacy compatibility
export function PricingCards() {
  return <PricingSection />;
}

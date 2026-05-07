import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";

const plans = [
  {
    name: "Single Business",
    price: "£39",
    tagline: "For small agencies, consultancies, and service businesses chasing their own invoices.",
    features: [
      "Unlimited invoice imports",
      "Ranked collections plan",
      "Draft message generator",
      "Pre-send safety checks",
      "Promises & dispute tracking",
      "Weekly digest",
      "Audit activity log",
    ],
    cta: "Try the demo",
    href: "/dashboard",
    highlight: false,
  },
  {
    name: "Bookkeeper Starter",
    price: "£99",
    tagline: "For bookkeepers managing up to 10 client businesses from one portfolio view.",
    features: [
      "Everything in Single Business",
      "Portfolio risk dashboard",
      "Per-client collections plans",
      "Up to 10 client businesses",
      "Client risk overview",
      "Per-client import history",
      "Weekly client briefs",
    ],
    cta: "Get started",
    href: "/dashboard",
    highlight: true,
  },
  {
    name: "Bookkeeper Pro",
    price: "£199",
    tagline: "For practices managing larger ledgers, more clients, and bigger exposures.",
    features: [
      "Everything in Bookkeeper Starter",
      "Unlimited client businesses",
      "Priority support",
      "Custom brand voice notes",
      "Team member access",
      "Export audit logs",
      "API access (coming soon)",
    ],
    cta: "Contact us",
    href: "/dashboard",
    highlight: false,
  },
];

export function PricingSection() {
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
            Try the demo with no sign-up. Pricing applies when you connect your
            own data.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`flex flex-col rounded-2xl border p-6 ${
                plan.highlight
                  ? "border-neutral-950 bg-white shadow-[0_4px_28px_rgba(0,0,0,0.09)]"
                  : "border-black/8 bg-[#fbf8f1]"
              }`}
            >
              {plan.highlight && (
                <div className="mb-4 inline-flex w-fit rounded-full bg-neutral-950 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-white">
                  Most popular
                </div>
              )}

              <p className="text-sm font-semibold text-neutral-950">{plan.name}</p>

              <div className="mt-3 flex items-end gap-1">
                <span className="text-4xl font-semibold tracking-tight text-neutral-950">
                  {plan.price}
                </span>
                <span className="mb-1 text-sm text-neutral-400">/month</span>
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
                  plan.highlight
                    ? "bg-neutral-950 text-white hover:bg-neutral-800"
                    : "border border-black/15 bg-white text-neutral-950 hover:bg-neutral-50"
                }`}
              >
                {plan.cta}
                <ArrowRight className="size-3.5" />
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// Keep named export for legacy compatibility
export function PricingCards() {
  return <PricingSection />;
}

import Link from "next/link";
import { ArrowRight, Check, Minus } from "lucide-react";

// ── Data ──────────────────────────────────────────────────────────────────────

const plans = [
  {
    id: "single",
    name: "Single Business",
    price: "£39",
    period: "month",
    tagline: "For one small business chasing its own invoices.",
    invoiceLimit: "Up to 300 active invoices",
    highlight: false,
    cta: "Try the demo",
    href: "/dashboard",
    features: [
      "1 business",
      "CSV & Excel import",
      "Ranked chase plan",
      "5 collection scenario actions",
      "AI draft messages",
      "Promise-to-pay tracking",
      "Dispute & remittance statuses",
      "Re-import comparison (what changed)",
      "Weekly digest preview",
      "Safety checks before drafting",
      "Full audit activity log",
    ],
  },
  {
    id: "starter",
    name: "Bookkeeper Starter",
    price: "£99",
    period: "month",
    tagline: "For bookkeepers managing a few client ledgers.",
    invoiceLimit: "Up to 1,500 active invoices",
    highlight: true,
    cta: "Get started",
    href: "/dashboard",
    features: [
      "Up to 5 client ledgers",
      "Portfolio risk dashboard",
      "Client-by-client chase plans",
      "Weekly client summaries",
      "Customer behaviour memory",
      "All Single Business features",
      "Per-client import history",
      "Client risk overview (CRITICAL/HIGH/MEDIUM/LOW)",
    ],
  },
  {
    id: "pro",
    name: "Bookkeeper Pro",
    price: "£199",
    period: "month",
    tagline: "For bookkeepers managing a larger portfolio.",
    invoiceLimit: "Up to 5,000 active invoices",
    highlight: false,
    cta: "Contact us",
    href: "/dashboard",
    features: [
      "Up to 20 client ledgers",
      "Advanced portfolio view",
      "Priority queue across all clients",
      "Client risk summaries",
      "Reusable import column mappings",
      "Monthly collections reports",
      "All Bookkeeper Starter features",
      "Priority support",
    ],
  },
] as const;

const baseFeatures = [
  "CSV & Excel import — no accounting software required",
  "Rules-based ranking engine",
  "Scenario-aware draft messages",
  "Pre-send safety checks",
  "Promise & dispute tracking",
  "Weekly digest",
  "Human-review-first — no auto-send, ever",
];

const faqs = [
  {
    q: "Does Zentra send emails automatically?",
    a: "No, not in the current version. Every message is drafted for your review. You copy it into your own email client and send it yourself. Zentra never has access to your email account.",
  },
  {
    q: "Do I need Xero or QuickBooks to use Zentra?",
    a: "No. Zentra works with CSV or Excel exports from any accounting system — or no accounting system at all. Export your overdue invoice list, drop it in, and Zentra maps the columns.",
  },
  {
    q: "Is this legal advice or debt collection?",
    a: "No. Zentra is a decision-support and drafting tool. It helps you prioritise which invoices to follow up on and prepares professional draft messages for your review. It does not provide legal advice, act as a debt collector, or recommend legal action.",
  },
  {
    q: "Is my customer data secure?",
    a: "Zentra is currently in beta and your data is handled with care. We do not sell or share your invoice data with third parties. As the product moves toward production, we will publish a full privacy policy and data processing agreement. If you have specific requirements, contact us before uploading sensitive data.",
  },
  {
    q: "Can bookkeepers use Zentra for multiple clients?",
    a: "Yes — that is what the Bookkeeper plans are designed for. Each client gets their own ledger, their own ranked chase plan, and their own import history. The portfolio dashboard gives you a single view of risk and actions across all clients.",
  },
];

// ── Nav (shared with landing page) ─────────────────────────────────────────────

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
          <Link
            href="/pricing"
            className="font-semibold text-neutral-950"
            aria-current="page"
          >
            Pricing
          </Link>
          <Link href="/dashboard" className="transition-colors hover:text-neutral-950">
            Demo
          </Link>
        </nav>

        <Link
          href="/dashboard"
          className="rounded-full bg-neutral-950 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-800"
        >
          Try the demo
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
            Zentra Collect supports credit-control workflow and decision-making. It does not provide legal, accounting, or tax advice. All messages require human review before sending.
          </p>
        </div>
      </div>
    </footer>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-[#fbf8f1] text-neutral-950">
      <MarketingNav />

      <main>
        {/* Hero */}
        <section className="mx-auto max-w-7xl px-4 pb-12 pt-16 sm:px-6 sm:pb-16 sm:pt-24 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <div className="inline-flex items-center rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-medium text-neutral-600">
              Early access &middot; Beta pricing
            </div>
            <h1 className="mt-5 text-4xl font-semibold tracking-tight text-neutral-950 sm:text-5xl">
              Simple, honest pricing for collections work.
            </h1>
            <p className="mt-4 text-lg leading-8 text-neutral-500">
              Pick the plan that fits your ledger. No Xero required. No per-invoice charges. Cancel any time.
            </p>
          </div>
        </section>

        {/* Founding user banner */}
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm leading-6">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <p className="font-semibold text-amber-900">
                🌱 Founding user offer
              </p>
              <p className="text-amber-800">
                Founding users can get early access pricing while the product is in beta — and have direct input on the roadmap.
              </p>
            </div>
          </div>
        </section>

        {/* Plan cards */}
        <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <div className="grid gap-4 lg:grid-cols-3 lg:items-start">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className={`flex flex-col rounded-2xl border p-6 ${
                  plan.highlight
                    ? "border-neutral-950 bg-white shadow-[0_4px_28px_rgba(0,0,0,0.09)]"
                    : "border-black/8 bg-[#fbf8f1]"
                }`}
              >
                {plan.highlight && (
                  <div className="mb-4 inline-flex w-fit rounded-full bg-neutral-950 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-white">
                    Most popular
                  </div>
                )}

                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-400">
                  {plan.name}
                </p>

                <div className="mt-3 flex items-end gap-1">
                  <span className="text-5xl font-semibold tracking-tight text-neutral-950">
                    {plan.price}
                  </span>
                  <span className="mb-1.5 text-sm text-neutral-400">/{plan.period}</span>
                </div>

                <p className="mt-2 text-sm leading-6 text-neutral-500">{plan.tagline}</p>

                {/* Invoice limit pill */}
                <div className="mt-4 inline-flex w-fit items-center rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-medium text-neutral-700">
                  {plan.invoiceLimit}
                </div>

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
                      : "border border-black/15 bg-white text-neutral-950 hover:bg-neutral-50"
                  }`}
                >
                  {plan.cta}
                  <ArrowRight className="size-3.5" />
                </Link>
              </div>
            ))}
          </div>

          <p className="mt-5 text-center text-xs text-neutral-400">
            All prices exclude VAT. Billed monthly. No contract required.
          </p>
        </section>

        {/* Included in every plan */}
        <section className="border-t border-black/10 bg-white">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
            <div className="mb-8 max-w-xl">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">
                Included in every plan
              </p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-neutral-950">
                The same core engine, whatever you pay.
              </h2>
              <p className="mt-2 text-sm leading-6 text-neutral-500">
                Every plan runs on the same rules-based decision engine. There is no cut-down version.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {baseFeatures.map((feature) => (
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

        {/* Plan comparison table */}
        <section className="border-t border-black/10">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
            <div className="mb-8">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">
                Compare plans
              </p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-neutral-950">
                At a glance.
              </h2>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-black/8 bg-white">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-black/8">
                    <th className="px-5 py-4 text-left text-xs font-medium text-neutral-400 w-56">
                      Feature
                    </th>
                    <th className="px-5 py-4 text-center text-xs font-semibold text-neutral-950">
                      Single Business
                    </th>
                    <th className="px-5 py-4 text-center text-xs font-semibold text-neutral-950 bg-neutral-50">
                      Bookkeeper Starter
                    </th>
                    <th className="px-5 py-4 text-center text-xs font-semibold text-neutral-950">
                      Bookkeeper Pro
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/6">
                  {[
                    {
                      label: "Active invoices",
                      values: ["300", "1,500", "5,000"],
                    },
                    {
                      label: "Client ledgers",
                      values: ["1", "Up to 5", "Up to 20"],
                    },
                    {
                      label: "Ranked chase plan",
                      values: [true, true, true],
                    },
                    {
                      label: "AI draft messages",
                      values: [true, true, true],
                    },
                    {
                      label: "Promise & dispute tracking",
                      values: [true, true, true],
                    },
                    {
                      label: "Portfolio dashboard",
                      values: [false, true, true],
                    },
                    {
                      label: "Weekly client summaries",
                      values: [false, true, true],
                    },
                    {
                      label: "Customer behaviour memory",
                      values: [false, true, true],
                    },
                    {
                      label: "Priority queue across clients",
                      values: [false, false, true],
                    },
                    {
                      label: "Reusable import mappings",
                      values: [false, false, true],
                    },
                    {
                      label: "Monthly collections reports",
                      values: [false, false, true],
                    },
                  ].map(({ label, values }, rowIndex) => (
                    <tr key={label} className={rowIndex % 2 === 0 ? "" : "bg-neutral-50/40"}>
                      <td className="px-5 py-3.5 text-sm text-neutral-700">{label}</td>
                      {values.map((val, i) => (
                        <td
                          key={i}
                          className={`px-5 py-3.5 text-center ${i === 1 ? "bg-neutral-50/60" : ""}`}
                        >
                          {typeof val === "boolean" ? (
                            val ? (
                              <Check className="mx-auto size-4 text-emerald-600" />
                            ) : (
                              <Minus className="mx-auto size-4 text-neutral-300" />
                            )
                          ) : (
                            <span className="text-sm font-medium text-neutral-950">{val}</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {/* Price row */}
                  <tr className="border-t-2 border-black/10 bg-[#fbf8f1]">
                    <td className="px-5 py-4 text-sm font-semibold text-neutral-950">
                      Monthly price
                    </td>
                    {[
                      { price: "£39", href: "/dashboard", label: "Try the demo", highlight: false },
                      { price: "£99", href: "/dashboard", label: "Get started", highlight: true },
                      { price: "£199", href: "/dashboard", label: "Contact us", highlight: false },
                    ].map(({ price, href, label, highlight }, i) => (
                      <td key={i} className={`px-5 py-4 text-center ${i === 1 ? "bg-neutral-50/60" : ""}`}>
                        <div className="flex flex-col items-center gap-2">
                          <span className="text-lg font-semibold text-neutral-950">{price}<span className="text-sm font-normal text-neutral-400">/mo</span></span>
                          <Link
                            href={href}
                            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                              highlight
                                ? "bg-neutral-950 text-white hover:bg-neutral-800"
                                : "border border-black/15 bg-white text-neutral-950 hover:bg-neutral-50"
                            }`}
                          >
                            {label}
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

        {/* FAQ */}
        <section className="border-t border-black/10 bg-white">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
            <div className="mb-10 max-w-xl">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">
                Frequently asked
              </p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-neutral-950">
                Questions before you start.
              </h2>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {faqs.map(({ q, a }) => (
                <div
                  key={q}
                  className="rounded-2xl border border-black/8 bg-[#fbf8f1] p-5"
                >
                  <p className="text-sm font-semibold text-neutral-950">{q}</p>
                  <p className="mt-2 text-sm leading-6 text-neutral-500">{a}</p>
                </div>
              ))}

              {/* Extra CTA card */}
              <div className="rounded-2xl border border-black/8 bg-neutral-950 p-5 text-white">
                <p className="text-sm font-semibold">Still have questions?</p>
                <p className="mt-2 text-sm leading-6 text-neutral-400">
                  Try the demo without signing up. It uses a pre-loaded set of demo invoices so you can see exactly how Zentra Collect works before connecting any real data.
                </p>
                <Link
                  href="/dashboard"
                  className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-medium text-neutral-950 transition-colors hover:bg-neutral-100"
                >
                  Open the demo
                  <ArrowRight className="size-3" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="border-t border-black/10">
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
            <div className="mx-auto max-w-xl text-center">
              <h2 className="text-3xl font-semibold tracking-tight text-neutral-950 sm:text-4xl">
                Try the demo without signing up.
              </h2>
              <p className="mt-4 text-base leading-7 text-neutral-500">
                The demo runs on pre-loaded invoices so you can explore the full ranked plan, draft messages, and safety checks before committing to anything.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
                <Link
                  href="/dashboard"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-neutral-950 px-7 py-3.5 text-sm font-medium text-white transition-colors hover:bg-neutral-800"
                >
                  Try the demo
                  <ArrowRight className="size-4" />
                </Link>
                <Link
                  href="/import"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-black/15 bg-white px-7 py-3.5 text-sm font-medium text-neutral-950 transition-colors hover:bg-neutral-50"
                >
                  Upload sample file
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}

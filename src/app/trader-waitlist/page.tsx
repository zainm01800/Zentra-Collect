import { MarketingNav } from "@/components/marketing-nav";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Trader £5/mo",
  description:
    "Zentra Trader — £5/mo for UK sole traders under £90k. Upload a bank statement, categorise expenses, estimate your tax. No accounting overhead.",
  alternates: { canonical: "/trader-waitlist" },
};

const FEATURES = [
  "50 active invoices",
  "Bank statement import — CSV or open banking",
  "Expense categorisation (HMRC-aligned)",
  "Tax estimate: income, allowable expenses, amount owed",
  "Year-end PDF summary for your accountant",
  "Statutory interest calculator (UK Late Payment Act)",
  "Invoice creation with customer payment portal",
  "6 starter chase templates",
];

const FAQS = [
  {
    q: "Do I need accounting software?",
    a: "No. You upload a bank statement CSV and Zentra categorises your expenses. No Xero, no Sage, no monthly sync.",
  },
  {
    q: "What's not included on Trader?",
    a: "Invoice chasing (collections workflow) and AI draft emails require the Freelance plan (£14/mo) or above. Trader is purely bank → expenses → tax.",
  },
  {
    q: "Can I upgrade later?",
    a: "Yes — your data carries over. Move to Freelance when you want to start chasing invoices, or Business for auto-send and integrations.",
  },
];

export default function TraderPage() {
  return (
    <>
      <MarketingNav />
      <main className="mx-auto max-w-xl px-4 py-10 sm:py-16 sm:px-6">
        {/* Hero */}
        <header className="text-center mb-10">
          <div
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] mb-4"
            style={{ background: "var(--zn-surface-2)", color: "var(--zn-ink-3)", border: "1px solid var(--zn-line-soft)" }}
          >
            Now live · £5/mo
          </div>
          <h1
            className="text-[30px] sm:text-[38px] font-semibold leading-tight tracking-[-0.025em]"
            style={{ color: "var(--zn-ink)" }}
          >
            For UK sole traders<br />under the VAT threshold.
          </h1>
          <p className="mt-4 text-[15px] leading-7" style={{ color: "var(--zn-ink-3)" }}>
            Upload a bank statement. Get categorised expenses and a tax estimate.
            No accounting software. No monthly reconciliation. No complexity.
          </p>
          <div className="flex items-center justify-center gap-3 mt-7">
            <Link
              href="/onboarding"
              className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-[14px] font-semibold"
              style={{ background: "var(--zn-ink)", color: "var(--zn-bg)" }}
            >
              Start free trial
            </Link>
            <Link
              href="/#pricing"
              className="inline-flex items-center gap-2 rounded-full border px-5 py-3 text-[13.5px] font-medium"
              style={{ borderColor: "var(--zn-line)", color: "var(--zn-ink-2)" }}
            >
              Compare plans
            </Link>
          </div>
        </header>

        {/* Pricing pill */}
        <div
          className="rounded-2xl p-5 mb-6 text-center"
          style={{ background: "var(--zn-surface)", border: "1px solid var(--zn-line-soft)" }}
        >
          <p className="text-[36px] font-bold tracking-[-0.03em]" style={{ color: "var(--zn-ink)" }}>
            £5<span className="text-[18px] font-normal" style={{ color: "var(--zn-ink-3)" }}>/month</span>
          </p>
          <p className="text-[13px] mt-1" style={{ color: "var(--zn-ink-3)" }}>
            No contract. Cancel anytime. 14-day free trial included.
          </p>
        </div>

        {/* Features */}
        <section
          className="rounded-2xl p-5 mb-6"
          style={{ background: "var(--zn-surface)", border: "1px solid var(--zn-line-soft)" }}
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] mb-4"
             style={{ color: "var(--zn-ink-3)" }}>
            What&rsquo;s included
          </p>
          <ul className="space-y-2.5 text-[13.5px]" style={{ color: "var(--zn-ink-2)" }}>
            {FEATURES.map((line) => (
              <li key={line} className="flex items-start gap-2.5">
                <svg className="mt-0.5 size-4 shrink-0" style={{ color: "var(--zn-safe)" }} fill="none" viewBox="0 0 16 16">
                  <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Not included note */}
        <div
          className="rounded-xl px-4 py-3 mb-8 text-[13px]"
          style={{ background: "var(--zn-warn-soft)", color: "var(--zn-warn)", border: "1px solid var(--zn-warn-soft)" }}
        >
          <strong>Not on Trader:</strong> AI draft emails, invoice chasing workflow, auto-send.
          Upgrade to <Link href="/#pricing" className="underline">Freelance (£14/mo)</Link> for collections.
        </div>

        {/* FAQs */}
        <section className="space-y-4 mb-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--zn-ink-3)" }}>
            Common questions
          </p>
          {FAQS.map(({ q, a }) => (
            <div key={q} className="rounded-xl p-4" style={{ background: "var(--zn-surface)", border: "1px solid var(--zn-line-soft)" }}>
              <p className="text-[13.5px] font-semibold mb-1.5" style={{ color: "var(--zn-ink)" }}>{q}</p>
              <p className="text-[13px] leading-6" style={{ color: "var(--zn-ink-3)" }}>{a}</p>
            </div>
          ))}
        </section>

        {/* Final CTA */}
        <div className="text-center">
          <Link
            href="/onboarding"
            className="inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-[14px] font-semibold"
            style={{ background: "var(--zn-ink)", color: "var(--zn-bg)" }}
          >
            Start your 14-day free trial
          </Link>
          <p className="mt-3 text-[12px]" style={{ color: "var(--zn-ink-3)" }}>
            No card required. Cancel anytime.
          </p>
        </div>
      </main>
    </>
  );
}

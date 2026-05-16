import { MarketingNav } from "@/components/marketing-nav";
import { TraderWaitlistForm } from "./form";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Trader £5/mo — join the waitlist · Zentra Collect",
  description:
    "Join the waitlist for Zentra Trader — £5/mo for UK sole traders under £90k. Invoice, get paid, track expenses, estimate tax. No accounting overhead.",
  alternates: { canonical: "/trader-waitlist" },
};

export default function TraderWaitlistPage() {
  return (
    <>
      <MarketingNav />
      <main className="mx-auto max-w-xl px-4 py-10 sm:py-14 sm:px-6">
        <header className="text-center mb-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em]"
             style={{ color: "var(--zn-ink-3)" }}>
            Coming soon · Trader £5/mo
          </p>
          <h1 className="text-[28px] sm:text-[34px] font-semibold mt-2 leading-tight tracking-[-0.02em]"
              style={{ color: "var(--zn-ink)" }}>
            For UK sole traders under £90k.
          </h1>
          <p className="mt-4 text-[14.5px] leading-7"
             style={{ color: "var(--zn-ink-3)" }}>
            Invoice, get paid via a customer payment portal, track expenses,
            estimate your tax. Cheaper than Sage. Built for the part of your
            business Sage doesn&rsquo;t do well — getting paid.
          </p>
        </header>

        <section
          className="rounded-2xl p-5 mb-6"
          style={{ background: "var(--zn-surface)", border: "1px solid var(--zn-line-soft)" }}
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] mb-3"
             style={{ color: "var(--zn-ink-3)" }}>
            What&rsquo;s included at £5/mo
          </p>
          <ul className="space-y-2 text-[13.5px]" style={{ color: "var(--zn-ink-2)" }}>
            {[
              "15 active invoices",
              "Invoice creation with payment portal embedded",
              "Statutory interest auto-applied (UK Late Payment Act)",
              "Stop-chasing intelligence on repeat customers",
              "6 starter chase templates",
              "Stripe payment links + customer-facing portal",
              "Tax estimate widget (income, expenses, tax owed)",
              "Year-end PDF summary for your accountant",
              "Bank feed auto-matching (Open Banking)",
              "Write-back to Xero / Sage / FreeAgent if you outgrow it",
            ].map((line) => (
              <li key={line} className="flex items-start gap-2">
                <span className="mt-1.5 size-1 rounded-full shrink-0" style={{ background: "var(--zn-ink-3)" }} />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </section>

        <TraderWaitlistForm />

        <p className="mt-6 text-center text-[11.5px]" style={{ color: "var(--zn-ink-3)" }}>
          We&rsquo;ll email you when Trader launches (target: ~3 months). No spam, one email only. Unsubscribe in one click.
        </p>
      </main>
    </>
  );
}

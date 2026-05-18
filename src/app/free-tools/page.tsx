import Link from "next/link";
import { Calculator, FileText, Mail, TrendingUp, ArrowRight } from "lucide-react";
import { MarketingNav } from "@/components/marketing-nav";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Free tools for UK businesses",
  description:
    "Free calculators and letter generators for UK businesses chasing overdue invoices. Statutory interest, late-payment letter, chase email, and DSO calculator. No signup required.",
  alternates: { canonical: "/free-tools" },
};

const TOOLS = [
  {
    href: "/free-tools/statutory-interest",
    icon: Calculator,
    title: "UK Statutory Interest Calculator",
    description:
      "Work out exactly how much late-payment interest you're legally entitled to under the Late Payment of Commercial Debts (Interest) Act 1998. Includes the compensation tier.",
    queries: "statutory interest calculator UK · late payment interest calculator",
  },
  {
    href: "/free-tools/late-payment-letter",
    icon: FileText,
    title: "Late Payment Letter Generator",
    description:
      "Generate a formal late-payment demand letter citing the 1998 Act, with the interest figure pre-calculated. Copy-paste ready.",
    queries: "late payment letter template UK · demand letter generator",
  },
  {
    href: "/free-tools/chase-email",
    icon: Mail,
    title: "Chase Email Writer",
    description:
      "Pick a tone (friendly, neutral, firm, final) and an invoice — get a copy-pasteable draft email with statutory interest wording optional.",
    queries: "polite payment reminder email · firm chase email template",
  },
  {
    href: "/free-tools/dso",
    icon: TrendingUp,
    title: "DSO Calculator",
    description:
      "Paste a few invoices and see your average Days Sales Outstanding plus a benchmark against UK SMB averages.",
    queries: "DSO calculator UK · days sales outstanding small business",
  },
];

export default function FreeToolsHubPage() {
  return (
    <>
      <MarketingNav />
      <main className="mx-auto max-w-5xl px-4 py-10 sm:py-14 sm:px-6 lg:px-8">
        <header className="text-center mb-12">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em]"
             style={{ color: "var(--zn-ink-3)" }}>
            Free tools · No signup
          </p>
          <h1 className="text-[32px] sm:text-[40px] font-semibold mt-2 leading-tight tracking-[-0.02em]"
              style={{ color: "var(--zn-ink)" }}>
            Tools for UK businesses chasing overdue invoices.
          </h1>
          <p className="mt-4 text-[15px] leading-7 max-w-2xl mx-auto"
             style={{ color: "var(--zn-ink-3)" }}>
            Free calculators and templates for the once-in-a-while late payment.
            No signup, no email capture — just paste your figures and get the answer.
          </p>
        </header>

        <div className="grid gap-4 sm:grid-cols-2">
          {TOOLS.map(({ href, icon: Icon, title, description }) => (
            <Link
              key={href}
              href={href}
              className="group rounded-2xl p-6 transition-all hover:shadow-sm"
              style={{
                background: "var(--zn-surface)",
                border: "1px solid var(--zn-line-soft)",
              }}
            >
              <div className="flex items-start gap-4">
                <div className="size-10 rounded-lg flex items-center justify-center shrink-0"
                     style={{ background: "var(--zn-bg-2)", color: "var(--zn-ink-2)" }}>
                  <Icon className="size-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-[16px] font-semibold leading-tight"
                      style={{ color: "var(--zn-ink)" }}>
                    {title}
                  </h2>
                  <p className="mt-2 text-[13px] leading-6"
                     style={{ color: "var(--zn-ink-3)" }}>
                    {description}
                  </p>
                </div>
                <ArrowRight className="size-4 mt-1.5 shrink-0 transition-transform group-hover:translate-x-0.5"
                            style={{ color: "var(--zn-ink-3)" }} />
              </div>
            </Link>
          ))}
        </div>

        <section
          className="mt-14 rounded-2xl p-6 sm:p-8 text-center"
          style={{
            background: "var(--zn-surface-2)",
            border: "1px solid var(--zn-line-soft)",
          }}
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em]"
             style={{ color: "var(--zn-ink-3)" }}>
            Want this automated?
          </p>
          <h3 className="mt-2 text-[20px] sm:text-[24px] font-semibold"
              style={{ color: "var(--zn-ink)" }}>
            Zentra Collect does all this every day, on every invoice.
          </h3>
          <p className="mt-2 text-[14px] leading-6 max-w-xl mx-auto"
             style={{ color: "var(--zn-ink-3)" }}>
            Upload your overdue invoices → get a ranked chase plan with action,
            reason, and draft message. Statutory interest, payment portal, and
            stop-chasing intelligence built in.
          </p>
          <div className="mt-5 flex items-center justify-center gap-3 flex-wrap">
            <Link
              href="/demo"
              className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[13.5px] font-semibold"
              style={{ background: "var(--zn-ink)", color: "var(--zn-bg)" }}
            >
              Try the demo
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[13.5px] font-medium"
              style={{ border: "1px solid var(--zn-line)", color: "var(--zn-ink-2)" }}
            >
              See pricing
            </Link>
          </div>
        </section>

        <p className="mt-10 text-center text-[11.5px]" style={{ color: "var(--zn-ink-3)" }}>
          These tools are estimates, not legal or accounting advice. Always verify with a qualified professional.
        </p>
      </main>
    </>
  );
}

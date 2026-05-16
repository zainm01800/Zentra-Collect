import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { MarketingNav } from "@/components/marketing-nav";

/**
 * Shared chrome for /free-tools/* pages — marketing nav, breadcrumb,
 * trailing "want this automated" CTA so every tool funnels back to trial.
 */
export function FreeToolShell({
  title,
  subtitle,
  children,
}: {
  title:    string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <MarketingNav />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:py-14 sm:px-6 lg:px-8">
        <Link
          href="/free-tools"
          className="inline-flex items-center gap-1.5 text-[12.5px] font-medium mb-5 hover:opacity-70"
          style={{ color: "var(--zn-ink-3)" }}
        >
          <ArrowLeft className="size-3.5" />
          All free tools
        </Link>

        <header className="mb-8">
          <h1 className="text-[28px] sm:text-[34px] font-semibold leading-tight tracking-[-0.02em]"
              style={{ color: "var(--zn-ink)" }}>
            {title}
          </h1>
          <p className="mt-3 text-[14.5px] leading-7"
             style={{ color: "var(--zn-ink-3)" }}>
            {subtitle}
          </p>
        </header>

        {children}

        <section
          className="mt-12 rounded-2xl p-6 sm:p-7"
          style={{
            background: "var(--zn-surface-2)",
            border: "1px solid var(--zn-line-soft)",
          }}
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em]"
             style={{ color: "var(--zn-ink-3)" }}>
            Want this on every invoice?
          </p>
          <h3 className="mt-1 text-[18px] font-semibold"
              style={{ color: "var(--zn-ink)" }}>
            Zentra Collect runs this engine on every overdue invoice.
          </h3>
          <p className="mt-2 text-[13px] leading-6"
             style={{ color: "var(--zn-ink-3)" }}>
            Statutory interest auto-applied, customer payment portal embedded in every chase,
            AI-drafted messages with tone control. Start free.
          </p>
          <div className="mt-4 flex items-center gap-3 flex-wrap">
            <Link
              href="/demo"
              className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-semibold"
              style={{ background: "var(--zn-ink)", color: "var(--zn-bg)" }}
            >
              Try the demo <ArrowRight className="size-3.5" />
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-medium"
              style={{ border: "1px solid var(--zn-line)", color: "var(--zn-ink-2)" }}
            >
              See pricing
            </Link>
          </div>
        </section>

        <p className="mt-8 text-center text-[11.5px]" style={{ color: "var(--zn-ink-3)" }}>
          Estimate only — not legal or accounting advice. Verify with a qualified professional.
        </p>
      </main>
    </>
  );
}

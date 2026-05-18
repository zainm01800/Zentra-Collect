import Link from "next/link";
import type { Metadata } from "next";
import { MarketingNav } from "@/components/marketing-nav";
import { ShieldCheck, Database, MapPin, Lock } from "lucide-react";

// Audit §9: static content, can be cached aggressively.
export const revalidate = 3600; // 1 hour

export const metadata: Metadata = {
  title: "About",
  description:
    "Zentra Collect is built in the UK for UK bookkeepers and small businesses. Calm, focused, human-approved collections decisioning.",
  alternates: { canonical: "/about" },
};

const PRINCIPLES = [
  {
    title: "Decisions, not noise.",
    body: "We don't bury you in invoices. We rank them, explain the ranking in plain English, draft the message, and let you decide. Action + reason + draft + safety status — every single time.",
  },
  {
    title: "Human approval before every send.",
    body: "Zentra never sends a message on your behalf without you reading and approving it. Auto-send is opt-in, off by default, and always has a five-minute cancel window before the first message goes out.",
  },
  {
    title: "Built in the UK, for the UK.",
    body: "All copy, all date formats, all compliance language assume UK service businesses and bookkeepers. Late Payment Act statutory interest, GoCardless mandates, HMRC categories — they're not bolted on.",
  },
  {
    title: "Calm by default.",
    body: "Collections is stressful enough. We avoid the screaming red dashboards, the upgrade-now popups, the gamified pressure tactics. One quiet workspace, the right action surfaced.",
  },
];

const TRUST = [
  {
    icon: MapPin,
    title: "UK-hosted data",
    body: "Your invoice data lives in EU/UK-region Supabase. We never transfer it outside the UK/EU.",
  },
  {
    icon: Lock,
    title: "Encrypted in transit and at rest",
    body: "TLS 1.3 for every connection. SMTP credentials are encrypted with AES-256 before they're written to disk.",
  },
  {
    icon: Database,
    title: "Export everything, any time",
    body: "Your data is yours. One-click CSV export from Settings → Account, no questions asked.",
  },
  {
    icon: ShieldCheck,
    title: "Auditable activity history",
    body: "Every chase action — drafts, sends, replies, status changes — is logged per invoice so you can prove what was done and when.",
  },
];

export default function AboutPage() {
  return (
    <main
      id="main-content"
      className="min-h-screen relative z-[1]"
      style={{ background: "var(--zn-bg)", color: "var(--zn-ink)" }}
    >
      <MarketingNav />

      {/* Hero */}
      <section className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
        <p className="zn-label !p-0 mb-3">About</p>
        <h1
          className="text-[36px] sm:text-[44px] tracking-[-0.02em] leading-[1.05]"
          style={{
            fontFamily: "var(--font-newsreader), ui-serif, Georgia, serif",
            fontWeight: 500,
            color: "var(--zn-ink)",
          }}
        >
          A focused tool for the people doing the chasing.
        </h1>
        <p className="mt-5 max-w-2xl text-[15px] leading-[1.65]" style={{ color: "var(--zn-ink-2)" }}>
          Zentra Collect started as a single observation: small UK businesses
          and the bookkeepers who serve them spend hours each week trying to
          decide who to chase, what to ask for, and what to ignore. The
          existing tools either send messages on autopilot (risky) or just
          show you a list of overdue invoices (not helpful). We wanted
          something between — a calm, opinionated layer that ranks the
          work, explains the reasoning, drafts the next message, and lets
          you approve and send.
        </p>
      </section>

      {/* Principles */}
      <section className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        <p className="zn-label !p-0 mb-4">What we believe</p>
        <div className="grid gap-5 sm:grid-cols-2">
          {PRINCIPLES.map((p) => (
            <div
              key={p.title}
              className="rounded-2xl p-5"
              style={{ background: "var(--zn-surface)", border: "1px solid var(--zn-line-soft)" }}
            >
              <h3 className="text-[15px] font-semibold mb-1.5" style={{ color: "var(--zn-ink)" }}>
                {p.title}
              </h3>
              <p className="text-[13.5px] leading-[1.6]" style={{ color: "var(--zn-ink-3)" }}>
                {p.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Trust + data */}
      <section className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        <p className="zn-label !p-0 mb-4">Data &amp; trust</p>
        <div className="grid gap-4 sm:grid-cols-2">
          {TRUST.map((t) => {
            const Icon = t.icon;
            return (
              <div
                key={t.title}
                className="flex gap-3 rounded-xl p-4"
                style={{ background: "var(--zn-surface)", border: "1px solid var(--zn-line-soft)" }}
              >
                <div
                  className="size-9 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: "var(--zn-bg-2)", color: "var(--zn-ink-2)" }}
                >
                  <Icon className="size-4" />
                </div>
                <div>
                  <p className="text-[13.5px] font-semibold" style={{ color: "var(--zn-ink)" }}>
                    {t.title}
                  </p>
                  <p className="text-[12.5px] mt-1 leading-[1.55]" style={{ color: "var(--zn-ink-3)" }}>
                    {t.body}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-[12px] mt-4" style={{ color: "var(--zn-ink-3)" }}>
          Detailed security &amp; compliance practices are documented at{" "}
          <Link href="/trust" className="underline">/trust</Link>.
        </p>
      </section>

      {/* Boundaries */}
      <section className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        <p className="zn-label !p-0 mb-4">What we don't do</p>
        <ul className="grid gap-2 sm:grid-cols-2 text-[13.5px]" style={{ color: "var(--zn-ink-2)" }}>
          {[
            "We're not a debt collection agency.",
            "We don't give legal or accounting advice.",
            "We don't send messages without your approval.",
            "We don't sell your data to anyone, ever.",
            "We don't lock your data in — export is one click.",
            "We don't pretend to replace your accountant.",
          ].map((line) => (
            <li key={line} className="flex items-start gap-2">
              <span aria-hidden="true" style={{ color: "var(--zn-ink-3)" }}>—</span>
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-4xl px-4 py-14 sm:px-6 lg:px-8">
        <div
          className="rounded-2xl p-8 text-center"
          style={{ background: "var(--zn-surface)", border: "1px solid var(--zn-line-soft)" }}
        >
          <h2
            className="text-[24px] sm:text-[28px] tracking-[-0.015em]"
            style={{ fontFamily: "var(--font-newsreader), ui-serif, Georgia, serif", fontWeight: 500 }}
          >
            See it on real data in 5 minutes.
          </h2>
          <p className="mt-2 text-[13.5px]" style={{ color: "var(--zn-ink-3)" }}>
            Upload an AR ageing export. Get a ranked chase plan. No card.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2.5">
            <Link href="/demo" className="zn-pill">Try the demo</Link>
            <Link href="/login?mode=signup" className="zn-pill zn-pill-ghost">Start free trial</Link>
          </div>
        </div>
      </section>
    </main>
  );
}

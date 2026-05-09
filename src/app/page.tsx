"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getPlanConfig,
  getPlanLimit,
  type LimitValue,
  type PlanId,
} from "@/lib/account/plans";

const answers = [
  "Who should I chase today?",
  "What should I ask for?",
  "What should I ignore?",
  "What changed since last import?",
  "What cash is likely this week?",
];

const steps = [
  {
    num: "01",
    title: "Upload invoice export",
    desc: "Drop a CSV or Excel file from Xero, QuickBooks, FreeAgent, or any accounting tool.",
  },
  {
    num: "02",
    title: "Get a ranked action plan",
    desc: "Zentra scores every invoice by urgency, risk, and safety — then tells you what to do first.",
  },
  {
    num: "03",
    title: "Review draft follow-ups",
    desc: "AI drafts a message for every recommended chase. You review and approve before anything leaves.",
  },
  {
    num: "04",
    title: "Track promises & exceptions",
    desc: "Log promises to pay, disputes, and remittance requests so nothing falls through the gaps.",
  },
];

const pricingPlanIds: PlanId[] = [
  "TRIAL",
  "SINGLE_BUSINESS",
  "BOOKKEEPER_STARTER",
  "BOOKKEEPER_PRO",
];

const pricingCtas: Record<PlanId, { label: string; href: string }> = {
  DEMO: { label: "Try the demo", href: "/demo" },
  TRIAL: { label: "Start free trial", href: "/login?plan=TRIAL" },
  FOUNDING_SINGLE: { label: "Request founding access", href: "/request-access" },
  FOUNDING_BOOKKEEPER: { label: "Request founding access", href: "/request-access" },
  SINGLE_BUSINESS: { label: "Get started", href: "/pricing" },
  BOOKKEEPER_STARTER: { label: "Get started", href: "/pricing" },
  BOOKKEEPER_PRO: { label: "Get started", href: "/pricing" },
};

const pricingDescriptions: Record<PlanId, string> = {
  DEMO: "Sample data only, so visitors can explore the product safely.",
  TRIAL: "No card required. Upload real AR exports and see Zentra working on your own data.",
  FOUNDING_SINGLE: "Early access for one business while the product is in beta.",
  FOUNDING_BOOKKEEPER: "Early access for bookkeepers shaping portfolio workflows.",
  SINGLE_BUSINESS: "For one small business running a practical, consistent chase process.",
  BOOKKEEPER_STARTER: "For bookkeepers managing a handful of client ledgers every week.",
  BOOKKEEPER_PRO: "For larger client portfolios that need more capacity and speed.",
};

const faqs = [
  {
    question: "Do I need Xero or QuickBooks?",
    answer: "No. You can start immediately with CSV/Excel invoice exports from any accounting tool.",
  },
  {
    question: "Does Zentra send emails automatically?",
    answer: "No. You review and approve every message before it leaves. Nothing is sent automatically.",
  },
  {
    question: "What happens after the trial?",
    answer: "You can still view your existing data, but new imports and AI actions require an upgrade.",
  },
  {
    question: "What counts as an AI action?",
    answer: "Drafts, rewrites, reply classification, unknown import mapping, and digest summaries.",
  },
  {
    question: "Is this legal or debt collection advice?",
    answer: "No. Zentra is a decision-support and drafting tool, not a legal or accounting service.",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#fbf8f1] text-neutral-950">

      {/* ── Nav ─────────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-black/8 bg-[#fbf8f1]/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6 lg:px-8">
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

          <nav className="hidden items-center gap-7 md:flex">
            <a href="#how-it-works" className="text-sm font-medium text-neutral-500 transition-colors hover:text-neutral-950">
              How it works
            </a>
            <a href="#pricing" className="text-sm font-medium text-neutral-500 transition-colors hover:text-neutral-950">
              Pricing
            </a>
            <Link href="/request-access" className="text-sm font-medium text-neutral-500 transition-colors hover:text-neutral-950">
              Request access
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            <Button asChild variant="outline" className="hidden rounded-full border-black/12 bg-transparent text-sm sm:flex">
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild className="rounded-full bg-neutral-950 px-5 text-sm font-medium text-white hover:bg-neutral-800">
              <Link href="/demo">Try the demo</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <section className="mx-auto grid max-w-7xl items-start gap-10 px-4 pb-16 pt-14 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.88fr)] lg:px-8 lg:pb-24 lg:pt-24">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/70 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-neutral-600">
            Collections decisioning for UK service businesses
          </p>
          <h1 className="mt-6 max-w-2xl text-5xl font-semibold leading-[1.05] tracking-tight sm:text-[3.75rem]">
            Upload overdue invoices. Get a ranked chase plan in minutes.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-neutral-600">
            Know who to chase, what to say, and what to ignore. Zentra turns your AR export into a prioritised, explainable action plan — with draft messages ready to go.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild className="rounded-full bg-neutral-950 px-6 text-sm font-semibold text-white shadow-sm hover:bg-neutral-800">
              <Link href="/login">
                Get started for free
                <ArrowRight className="ml-2 size-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="rounded-full border-black/12 bg-transparent px-6 text-sm font-semibold text-neutral-950 hover:bg-black/5">
              <Link href="/demo">Try the demo</Link>
            </Button>
          </div>
          <p className="mt-4 text-xs text-neutral-400">
            No card required for the trial. No messages sent automatically.
          </p>
        </div>

        {/* Hero widget */}
        <div className="min-w-0 rounded-[2rem] border border-black/10 bg-white p-4 shadow-sm">
          <div className="rounded-[1.5rem] border border-black/8 bg-[#fbf8f1] p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">
              Today&apos;s collections plan
            </p>
            <div className="mt-4 grid gap-3">
              {[
                { label: "Chase now", amount: "£18,420", note: "7 recommended actions", dot: "bg-red-500" },
                { label: "Exceptions", amount: "£6,850", note: "3 need review first", dot: "bg-amber-400" },
                { label: "Likely this week", amount: "£9,200", note: "4 promises to check", dot: "bg-emerald-500" },
              ].map(({ label, amount, note, dot }) => (
                <div key={label} className="flex items-center justify-between rounded-2xl border border-black/8 bg-white p-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`size-2 rounded-full ${dot}`} />
                      <p className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">{label}</p>
                    </div>
                    <p className="mt-1.5 text-2xl font-semibold tracking-tight">{amount}</p>
                  </div>
                  <p className="text-right text-xs text-neutral-400 max-w-[100px]">{note}</p>
                </div>
              ))}
            </div>
          </div>
          <p className="mt-3 text-center text-xs text-neutral-400">Sample data — no real invoices shown</p>
        </div>
      </section>

      {/* ── What it answers ─────────────────────────────────────────────────── */}
      <Section eyebrow="What it answers" title="Five questions that AR chaos makes hard.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {answers.map((item) => (
            <div key={item} className="rounded-3xl border border-black/10 bg-white/70 p-5 text-sm font-medium text-neutral-800">
              {item}
            </div>
          ))}
        </div>
      </Section>

      {/* ── How it works ────────────────────────────────────────────────────── */}
      <Section id="how-it-works" eyebrow="How it works" title="From export to action plan in four steps.">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((step) => (
            <div key={step.num} className="rounded-3xl border border-black/10 bg-white/70 p-6">
              <span className="text-3xl font-bold tracking-tight text-neutral-200">{step.num}</span>
              <p className="mt-4 font-semibold text-neutral-950">{step.title}</p>
              <p className="mt-2 text-sm leading-6 text-neutral-500">{step.desc}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Bookkeepers ─────────────────────────────────────────────────────── */}
      <Section eyebrow="For bookkeepers" title="See which client ledgers need attention first.">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-[2rem] border border-black/10 bg-white/70 p-8">
            <p className="text-lg leading-8 text-neutral-600">
              Portfolio mode is designed for bookkeepers managing multiple small business clients: weekly client briefs, ledger-level risk ranking, and a clear queue for where to spend the next hour.
            </p>
            <Link href="/request-access" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-neutral-950 underline-offset-4 hover:underline">
              Request bookkeeper access <ArrowRight className="size-3.5" />
            </Link>
          </div>
          <div className="rounded-[2rem] border border-black/10 bg-white/70 p-8">
            <div className="space-y-3">
              {["Weekly client briefs", "Ledger-level risk scoring", "Portfolio chase queue", "Per-client import mapping"].map((item) => (
                <div key={item} className="flex items-center gap-3">
                  <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
                  <span className="text-sm font-medium text-neutral-800">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* ── Safety ──────────────────────────────────────────────────────────── */}
      <Section eyebrow="Safety first" title="Every recommendation stays human-approved.">
        <div className="grid gap-3 md:grid-cols-4">
          {[
            { title: "Human approval", desc: "Nothing is sent without your explicit sign-off." },
            { title: "Safety checks", desc: "Disputes, promises, and high-value accounts are flagged before chasing." },
            { title: "Audit history", desc: "Every action and draft is logged so you can explain your process." },
            { title: "No legal advice", desc: "Zentra is a decision-support tool, not a legal or debt recovery service." },
          ].map((item) => (
            <div key={item.title} className="rounded-3xl border border-black/10 bg-white/70 p-5">
              <CheckCircle2 className="size-5 text-emerald-600" />
              <p className="mt-3 font-semibold text-neutral-950">{item.title}</p>
              <p className="mt-1.5 text-sm leading-6 text-neutral-500">{item.desc}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Pricing ─────────────────────────────────────────────────────────── */}
      <Section id="pricing" eyebrow="Pricing" title="Simple plans for solo operators and bookkeeping practices.">
        <div className="mb-8 flex items-center justify-between">
          <p className="text-sm text-neutral-500">All plans include a 14-day free trial. No card required to start.</p>
          <Link href="/pricing" className="hidden items-center gap-1.5 text-sm font-semibold text-neutral-950 underline-offset-4 hover:underline sm:flex">
            See full pricing details <ArrowRight className="size-3.5" />
          </Link>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {pricingPlanIds.map((planId) => {
            const plan = getPlanConfig(planId);
            const cta = pricingCtas[planId];
            const isHighlighted = planId === "SINGLE_BUSINESS";

            return (
              <div
                key={plan.id}
                className={
                  isHighlighted
                    ? "relative flex flex-col rounded-[2rem] border-2 border-neutral-950 bg-white p-6 shadow-lg"
                    : "flex flex-col rounded-[2rem] border border-black/10 bg-white/70 p-6"
                }
              >
                {isHighlighted && (
                  <span className="absolute -top-3.5 left-6 rounded-full bg-neutral-950 px-3 py-1 text-xs font-semibold text-white">
                    Most popular
                  </span>
                )}
                <div className="flex-1">
                  <p className="text-sm font-semibold uppercase tracking-[0.12em] text-neutral-500">{plan.name}</p>
                  <p className="mt-3 text-4xl font-semibold tracking-tight text-neutral-950">
                    {formatPrice(plan.id)}
                    {plan.priceMonthlyGbp > 0 && (
                      <span className="text-base font-normal text-neutral-400">/mo</span>
                    )}
                  </p>
                  <p className="mt-3 min-h-[3rem] text-sm leading-6 text-neutral-500">
                    {pricingDescriptions[plan.id]}
                  </p>
                  <div className="mt-5 space-y-2.5">
                    {getPricingBullets(plan.id).map((feature) => (
                      <div key={feature} className="flex items-start gap-2.5">
                        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                        <span className="text-sm text-neutral-700">{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mt-7">
                  <Link
                    href={cta.href}
                    className={
                      isHighlighted
                        ? "flex w-full items-center justify-center gap-2 rounded-full bg-neutral-950 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-neutral-800"
                        : "flex w-full items-center justify-center gap-2 rounded-full border border-black/15 bg-transparent px-5 py-3 text-sm font-semibold text-neutral-950 transition-colors hover:bg-black/5"
                    }
                  >
                    {cta.label}
                    <ArrowRight className="size-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-6 text-center">
          <Link href="/pricing" className="text-sm font-medium text-neutral-500 underline-offset-4 hover:text-neutral-950 hover:underline">
            View founding member pricing →
          </Link>
        </div>
      </Section>

      {/* ── FAQ ─────────────────────────────────────────────────────────────── */}
      <Section eyebrow="FAQ" title="Straight answers before you start.">
        <div className="grid gap-4 md:grid-cols-2">
          {faqs.map((faq) => (
            <div key={faq.question} className="rounded-[2rem] border border-black/10 bg-white/70 p-6">
              <p className="font-semibold text-neutral-950">{faq.question}</p>
              <p className="mt-3 text-sm leading-6 text-neutral-500">{faq.answer}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ── CTA banner ──────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="rounded-[2rem] bg-neutral-950 p-10 text-white sm:p-14">
          <div className="max-w-2xl">
            <h2 className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
              Turn overdue invoices into today&apos;s action plan.
            </h2>
            <p className="mt-5 text-base leading-8 text-white/60">
              14-day free trial. No card required. No messages sent without your approval.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild className="rounded-full bg-white px-6 text-sm font-semibold text-neutral-950 hover:bg-neutral-100">
                <Link href="/login">
                  Get started for free
                  <ArrowRight className="ml-2 size-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" className="rounded-full border-white/20 bg-transparent px-6 text-sm font-semibold text-white hover:bg-white/10">
                <Link href="/demo">Try the demo first</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer className="border-t border-black/8 bg-[#fbf8f1]">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <span className="flex size-8 items-center justify-center rounded-lg bg-neutral-950 text-sm font-bold text-white">Z</span>
            <span className="text-sm font-semibold">Zentra Collect</span>
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-neutral-500">
            <a href="#how-it-works" className="hover:text-neutral-950">How it works</a>
            <a href="#pricing" className="hover:text-neutral-950">Pricing</a>
            <Link href="/request-access" className="hover:text-neutral-950">Request access</Link>
            <Link href="/login" className="hover:text-neutral-950">Sign in</Link>
            <Link href="/demo" className="hover:text-neutral-950">Try demo</Link>
          </nav>
          <p className="text-xs text-neutral-400">
            Zentra Collect is a decision-support tool. Not legal or accounting advice.
          </p>
        </div>
      </footer>
    </main>
  );
}

function Section({
  id,
  eyebrow,
  title,
  children,
}: {
  id?: string;
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
      <div className="mb-8 max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-neutral-400">
          {eyebrow}
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

function formatPrice(planId: PlanId) {
  const plan = getPlanConfig(planId);
  if (plan.priceMonthlyGbp === 0) return "Free";
  return `£${plan.priceMonthlyGbp}`;
}

function formatLimit(value: LimitValue) {
  return value === "unlimited" ? "unlimited" : value.toLocaleString("en-GB");
}

function getPricingBullets(planId: PlanId) {
  const plan = getPlanConfig(planId);
  const activeInvoices = formatLimit(getPlanLimit(planId, "activeInvoiceCount"));
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
      "1 business",
      `${activeInvoices} active invoices`,
      `${formatLimit(imports as LimitValue)} imports`,
      `${formatLimit(aiActions as LimitValue)} AI actions`,
    ];
  }

  return [
    plan.features.bookkeeperMode
      ? `Up to ${formatLimit(clientLedgers)} client ledgers`
      : "1 business",
    `${activeInvoices} active invoices`,
    `${formatLimit(imports as LimitValue)} imports/month`,
    `${formatLimit(aiActions as LimitValue)} AI actions/month`,
  ];
}

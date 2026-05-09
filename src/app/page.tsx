import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
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

const messyAr = [
  "Payment reminders",
  "Statement requests",
  "Remittance requests",
  "Disputes",
  "Missed promises",
];

const pricingPlanIds: PlanId[] = [
  "DEMO",
  "TRIAL",
  "SINGLE_BUSINESS",
  "BOOKKEEPER_STARTER",
  "BOOKKEEPER_PRO",
];

const pricingDescriptions: Record<PlanId, string> = {
  DEMO: "Sample data only, so visitors can explore the product safely.",
  TRIAL: "No card required. Upload real AR exports during the trial.",
  FOUNDING_SINGLE: "Early access for one business while the product is in beta.",
  FOUNDING_BOOKKEEPER: "Early access for bookkeepers shaping portfolio workflows.",
  SINGLE_BUSINESS: "For one small business running a practical chase process.",
  BOOKKEEPER_STARTER: "For bookkeepers managing a handful of client ledgers.",
  BOOKKEEPER_PRO: "For larger client portfolios that need more capacity.",
};

const faqs = [
  {
    question: "Do I need Xero or QuickBooks?",
    answer: "No. You can start with CSV/Excel invoice exports.",
  },
  {
    question: "Does Zentra send emails automatically?",
    answer: "No. In the MVP, you review and approve every message.",
  },
  {
    question: "What happens after the trial?",
    answer:
      "You can still view your data, but new imports and AI actions require an upgrade.",
  },
  {
    question: "What counts as an AI action?",
    answer:
      "Drafts, rewrites, reply classification, unknown import mapping, and summaries.",
  },
  {
    question: "Is this legal or debt collection advice?",
    answer: "No. Zentra is a decision-support and drafting tool.",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#fbf8f1] text-neutral-950">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3 font-semibold">
          <span className="flex size-9 items-center justify-center rounded-xl bg-neutral-950 text-white">
            Z
          </span>
          <span>
            <span className="block tracking-[0.18em]">ZENTRA</span>
            <span className="block text-[0.68rem] uppercase tracking-[0.18em] text-neutral-500">
              Collect
            </span>
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" className="rounded-full border-black/10 bg-transparent">
            <Link href="/login">Sign in</Link>
          </Button>
          <Button asChild className="rounded-full bg-neutral-950 px-5 text-white hover:bg-neutral-800">
            <Link href="/demo" target="_blank" rel="noopener noreferrer">
              Try the demo
            </Link>
          </Button>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl items-start gap-10 px-4 pb-14 pt-12 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.88fr)] lg:px-8 lg:pb-20 lg:pt-20">
        <div className="min-w-0">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-neutral-500">
            Zentra Collect
          </p>
          <h1 className="mt-5 max-w-5xl text-5xl font-semibold leading-[0.95] tracking-tight sm:text-7xl">
            Upload overdue invoices. Get a ranked chase plan in minutes.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-neutral-600">
            Zentra Collect turns AR ageing reports and invoice exports into
            clear next actions: who to chase, what to ask for, what to ignore,
            and what cash is likely to land.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild className="rounded-full bg-neutral-950 px-6 font-bold text-white hover:bg-neutral-800 transition-all shadow-md">
              <Link href="/login">
                Get started for free
                <ArrowRight className="size-4 ml-2" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="rounded-full border-black/10 bg-transparent px-6 font-bold text-neutral-950 hover:bg-black/5 transition-all">
              <Link href="/demo" target="_blank" rel="noopener noreferrer">Try the demo</Link>
            </Button>
          </div>
        </div>

        <div className="min-w-0 rounded-[2rem] border border-black/10 bg-white/70 p-3 shadow-sm sm:p-4">
          <div className="rounded-[1.5rem] border border-black/10 bg-[#fbf8f1] p-4 sm:p-5">
            <p className="text-sm font-semibold text-neutral-950">
              Today&apos;s collections plan
            </p>
            <div className="mt-5 grid gap-3">
              {[
                ["Chase now", "GBP 18,420", "7 recommended actions"],
                ["Exceptions", "GBP 6,850", "3 need review first"],
                ["Likely this week", "GBP 9,200", "4 promises to check"],
              ].map(([label, amount, note]) => (
                <div key={label} className="min-w-0 rounded-2xl border border-black/10 bg-white p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-neutral-500">
                    {label}
                  </p>
                  <p className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                    {amount}
                  </p>
                  <p className="mt-1 text-sm text-neutral-600">{note}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <Section eyebrow="What it answers" title="A focused decision layer for messy AR.">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {answers.map((item) => (
            <SoftCard key={item}>{item}</SoftCard>
          ))}
        </div>
      </Section>

      <Section eyebrow="How it works" title="From export to action plan.">
        <div className="grid gap-4 md:grid-cols-4">
          {[
            "Upload invoice export",
            "Get ranked action plan",
            "Review draft follow-ups",
            "Track promises and exceptions",
          ].map((step, index) => (
            <div key={step} className="rounded-3xl border border-black/10 bg-white/70 p-5">
              <span className="flex size-8 items-center justify-center rounded-full bg-neutral-950 text-sm font-semibold text-white">
                {index + 1}
              </span>
              <p className="mt-6 font-medium">{step}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section eyebrow="Built for messy AR" title="Not every overdue invoice needs the same chase.">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {messyAr.map((item) => (
            <SoftCard key={item}>{item}</SoftCard>
          ))}
        </div>
      </Section>

      <Section eyebrow="Bookkeepers" title="See which client ledgers need attention first.">
        <div className="rounded-[2rem] border border-black/10 bg-white/70 p-6">
          <p className="max-w-3xl text-lg leading-8 text-neutral-600">
            Portfolio mode is designed for bookkeepers managing multiple small
            business clients: weekly client briefs, ledger-level risk, and a
            clear queue for where to spend the next hour.
          </p>
        </div>
      </Section>

      <Section eyebrow="Safety" title="Recommendations stay human-approved.">
        <div className="grid gap-4 md:grid-cols-4">
          {["Human approval", "Audit history", "Safety checks", "No legal advice"].map((item) => (
            <div key={item} className="flex items-center gap-3 rounded-3xl border border-black/10 bg-white/70 p-5">
              <CheckCircle2 className="size-5 text-emerald-700" />
              <span className="font-medium">{item}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section
        id="pricing"
        eyebrow="Pricing"
        title="Clear plans for small teams and bookkeepers."
      >
        <div className="mb-10 rounded-[2rem] border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900 shadow-sm">
          Founding users can get early access from{" "}
          <span className="font-bold text-amber-950">
            {formatPrice("FOUNDING_SINGLE")}
          </span>{" "}
          while the product is in beta.
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {pricingPlanIds.map((planId) => {
            const plan = getPlanConfig(planId);

            return (
              <div
                key={plan.id}
                className={
                  plan.id === "SINGLE_BUSINESS"
                    ? "rounded-[2rem] border border-neutral-950 bg-white p-6 shadow-sm"
                    : "rounded-[2rem] border border-black/10 bg-white/70 p-6"
                }
              >
                <p className="font-semibold">{plan.name}</p>
                <p className="mt-4 text-4xl font-semibold tracking-tight">
                  {formatPrice(plan.id)}
                </p>
                <p className="mt-4 min-h-12 text-sm leading-6 text-neutral-600">
                  {pricingDescriptions[plan.id]}
                </p>
                <div className="mt-5 space-y-2 text-sm text-neutral-800">
                  {getPricingBullets(plan.id).map((feature) => (
                    <div key={feature} className="flex gap-2">
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-700" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      <Section eyebrow="FAQ" title="Straight answers before you start.">
        <div className="grid gap-4 md:grid-cols-2">
          {faqs.map((faq) => (
            <div
              key={faq.question}
              className="rounded-[2rem] border border-black/10 bg-white/70 p-6"
            >
              <p className="font-semibold">{faq.question}</p>
              <p className="mt-3 text-sm leading-6 text-neutral-600">{faq.answer}</p>
            </div>
          ))}
        </div>
      </Section>

      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="rounded-[2rem] bg-neutral-950 p-8 text-white sm:p-10">
          <h2 className="max-w-3xl text-4xl font-semibold tracking-tight">
            Turn overdue invoices into today&apos;s action plan.
          </h2>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild className="rounded-full bg-white px-6 text-neutral-950 hover:bg-neutral-100">
              <Link href="/demo" target="_blank" rel="noopener noreferrer">
                Try the demo
              </Link>
            </Button>
            <Button asChild variant="outline" className="rounded-full border-white/20 bg-transparent px-6 text-white hover:bg-white/10">
              <Link href="/login">Upload sample file</Link>
            </Button>
          </div>
          <p className="mt-6 max-w-2xl text-sm leading-6 text-white/60">
            Zentra Collect is a decision-support and drafting tool. It does not
            send messages automatically and does not provide legal, accounting,
            or tax advice.
          </p>
        </div>
      </section>
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
    <section id={id} className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-7 max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-neutral-500">
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

function SoftCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-black/10 bg-white/70 p-5 text-sm font-medium text-neutral-800">
      {children}
    </div>
  );
}

function formatPrice(planId: PlanId) {
  const plan = getPlanConfig(planId);
  if (plan.priceMonthlyGbp === 0) return "\u00a30";
  return `\u00a3${plan.priceMonthlyGbp}/month`;
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

  if (planId === "DEMO") {
    return [
      "sample data only",
      `${formatLimit(getPlanLimit(planId, "aiActionsUsedThisMonth"))} sample AI drafts`,
    ];
  }

  if (planId === "TRIAL") {
    return [
      "no card required",
      `${formatLimit(clientLedgers)} business`,
      `${activeInvoices} active invoices`,
      `${formatLimit(imports)} imports`,
      `${formatLimit(aiActions)} AI actions`,
    ];
  }

  return [
    plan.features.bookkeeperMode
      ? `up to ${formatLimit(clientLedgers)} client ledgers`
      : `${formatLimit(clientLedgers)} business`,
    `${activeInvoices} active invoices`,
    `${formatLimit(imports)} imports/month`,
    `${formatLimit(aiActions)} AI actions/month`,
  ];
}

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Banknote,
  BookOpen,
  CalendarX,
  EyeOff,
  FileText,
  HelpCircle,
  History,
  LayoutDashboard,
  Lock,
  Mail,
  MessageSquare,
  Receipt,
  RefreshCw,
  ShieldCheck,
  Users,
  XCircle,
} from "lucide-react";

// ── Hero ──────────────────────────────────────────────────────────────────────

export function LandingHero() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8 lg:py-32">
      <div className="grid items-center gap-16 lg:grid-cols-[1fr_460px] lg:gap-20">
        <div>
          <div className="inline-flex items-center rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-medium text-neutral-600">
            Collections decisioning &middot; UK teams &amp; bookkeepers
          </div>
          <h1 className="mt-6 text-5xl font-semibold leading-[1.07] tracking-tight text-neutral-950 sm:text-6xl lg:text-7xl">
            Upload overdue invoices. Get a ranked chase plan in minutes.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-neutral-600">
            Zentra Collect turns AR ageing reports and invoice exports into clear
            next actions — who to chase, what to ask for, what to ignore, and
            what cash is likely to land.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-neutral-950 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-neutral-800"
            >
              Try the demo
              <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/import"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-black/15 bg-white px-6 py-3 text-sm font-medium text-neutral-950 transition-colors hover:bg-neutral-50"
            >
              Upload sample file
            </Link>
          </div>
        </div>

        <HeroCard />
      </div>
    </section>
  );
}

function HeroCard() {
  const rows = [
    {
      name: "Ashford Digital",
      ref: "BB-2194",
      amount: "£12,750",
      action: "Send payment reminder",
      urgency: "critical",
      safety: "needs_review",
    },
    {
      name: "Redfern Architecture",
      ref: "MBA-6077",
      amount: "£11,200",
      action: "Send payment reminder",
      urgency: "critical",
      safety: "needs_review",
    },
    {
      name: "Elmstead Legal",
      ref: "MBA-6092",
      amount: "£2,750",
      action: "Send payment reminder",
      urgency: "medium",
      safety: "safe_to_draft",
    },
  ];

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-black/10 bg-white shadow-[0_4px_40px_rgba(0,0,0,0.07)]">
      {/* Header */}
      <div className="border-b border-black/8 px-5 py-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-neutral-400">
              Zentra Collect
            </p>
            <p className="mt-0.5 text-sm font-semibold text-neutral-950">
              Today&rsquo;s collections plan
            </p>
          </div>
          <span className="rounded-full border border-black/10 bg-[#fbf8f1] px-2.5 py-1 text-xs font-medium text-neutral-500">
            07 May 2026
          </span>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2.5">
          {[
            { label: "Outstanding", value: "£105,940", cls: "text-red-600" },
            { label: "Chase now", value: "5", cls: "text-neutral-950" },
            { label: "Exceptions", value: "14", cls: "text-amber-700" },
          ].map(({ label, value, cls }) => (
            <div
              key={label}
              className="rounded-xl border border-black/8 bg-[#fbf8f1] px-3 py-2.5"
            >
              <p className="text-[0.6rem] font-medium uppercase tracking-[0.1em] text-neutral-400">
                {label}
              </p>
              <p className={`mt-1 text-base font-semibold ${cls}`}>{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Invoice rows */}
      <div className="divide-y divide-black/8">
        {rows.map((row) => (
          <div key={row.ref} className="px-5 py-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-neutral-950">
                  {row.name}
                </p>
                <p className="mt-0.5 text-xs text-neutral-400">
                  {row.ref} &middot; {row.amount}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <UrgencyPill value={row.urgency} />
                <SafetyPill value={row.safety} />
              </div>
            </div>
            <p className="mt-1.5 text-xs text-neutral-500">{row.action}</p>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="border-t border-black/8 bg-[#fbf8f1]/60 px-5 py-3">
        <p className="text-[0.68rem] text-neutral-400">
          Rules decide the order. Drafting only happens after review.
        </p>
      </div>
    </div>
  );
}

function UrgencyPill({ value }: { value: string }) {
  const cls =
    value === "critical"
      ? "border-red-200 bg-red-50 text-red-700"
      : value === "high"
        ? "border-orange-200 bg-orange-50 text-orange-700"
        : "border-amber-200 bg-amber-50 text-amber-700";
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[0.6rem] font-medium ${cls}`}>
      {value}
    </span>
  );
}

function SafetyPill({ value }: { value: string }) {
  const cls =
    value === "safe_to_draft"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : "border-amber-200 bg-amber-50 text-amber-700";
  const label = value === "safe_to_draft" ? "Safe to draft" : "Review required";
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[0.6rem] font-medium ${cls}`}>
      {label}
    </span>
  );
}

function RiskBadge({ risk }: { risk: string }) {
  const cls: Record<string, string> = {
    CRITICAL: "border-red-200 bg-red-50 text-red-700",
    HIGH: "border-orange-200 bg-orange-50 text-orange-700",
    MEDIUM: "border-amber-200 bg-amber-50 text-amber-700",
    LOW: "border-emerald-200 bg-emerald-50 text-emerald-700",
  };
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[0.6rem] font-medium ${cls[risk] ?? ""}`}
    >
      {risk}
    </span>
  );
}

// ── What it answers ───────────────────────────────────────────────────────────

const questions = [
  {
    icon: HelpCircle,
    q: "Who should I chase today?",
    a: "A ranked list sorted by urgency, value, relationship, and previous chase history.",
  },
  {
    icon: MessageSquare,
    q: "What should I ask for?",
    a: "Reminders, remittance requests, promise follow-ups, dispute responses — picked by scenario.",
  },
  {
    icon: EyeOff,
    q: "What should I ignore?",
    a: "Disputed, recently chased, and do-not-chase items stay out of your queue automatically.",
  },
  {
    icon: RefreshCw,
    q: "What changed since last import?",
    a: "Paid invoices, new overdues, missed promises, and balance changes — surfaced at a glance.",
  },
  {
    icon: Banknote,
    q: "What cash is likely this week?",
    a: "Open promises and near-due invoices roll up into a weekly cash landing estimate.",
  },
];

export function WhatItAnswers() {
  return (
    <section className="border-t border-black/10">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="mb-10 max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">
            What it answers
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-neutral-950 sm:text-4xl">
            Five questions every credit-control session starts with.
          </h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {questions.map(({ icon: Icon, q, a }) => (
            <div key={q} className="rounded-2xl border border-black/8 bg-white p-5">
              <div className="flex size-9 items-center justify-center rounded-xl border border-black/8 bg-[#fbf8f1]">
                <Icon className="size-4 text-neutral-600" />
              </div>
              <p className="mt-4 text-sm font-semibold leading-snug text-neutral-950">{q}</p>
              <p className="mt-2 text-xs leading-5 text-neutral-500">{a}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── How it works ──────────────────────────────────────────────────────────────

const steps = [
  {
    n: "1",
    title: "Upload invoice export",
    body: "Drop in a CSV or Excel AR ageing report. Zentra maps the columns and validates the data.",
  },
  {
    n: "2",
    title: "Get ranked action plan",
    body: "The rules engine ranks every invoice by urgency, scenario, safety status, and recommended action.",
  },
  {
    n: "3",
    title: "Review draft follow-ups",
    body: "Open any item to see the reason, a draft message, and safety checks. Edit before you copy.",
  },
  {
    n: "4",
    title: "Track promises and exceptions",
    body: "Log promises, disputes, and remittance needs. They flow back into the next ranked plan.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="border-t border-black/10">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="mb-10 max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">
            How it works
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-neutral-950 sm:text-4xl">
            From spreadsheet to action plan in four steps.
          </h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map(({ n, title, body }) => (
            <div key={n} className="rounded-2xl border border-black/8 bg-white p-6">
              <div className="flex size-9 items-center justify-center rounded-full bg-neutral-950 text-sm font-semibold text-white">
                {n}
              </div>
              <h3 className="mt-5 text-base font-semibold text-neutral-950">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-neutral-500">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Built for messy AR ────────────────────────────────────────────────────────

const scenarios = [
  {
    icon: Mail,
    tag: "Payment reminders",
    body: "Ranked by overdue days, value, relationship type, and previous chase count. Tone adjusts automatically.",
  },
  {
    icon: FileText,
    tag: "Statement requests",
    body: "When a customer has multiple open invoices, Zentra recommends a statement instead of item-by-item chasing.",
  },
  {
    icon: Receipt,
    tag: "Remittance requests",
    body: "Payment claimed but balance still open? Zentra flags it and drafts a remittance request — not another reminder.",
  },
  {
    icon: AlertTriangle,
    tag: "Disputes",
    body: "Disputed invoices are routed to exceptions. No normal payment reminder is drafted until the dispute is resolved.",
  },
  {
    icon: CalendarX,
    tag: "Missed promises",
    body: "Promises that pass their date are surfaced with a careful follow-up draft, not a standard overdue reminder.",
  },
];

export function BuiltForMessyAR() {
  return (
    <section className="border-t border-black/10">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="mb-10 max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">
            Built for messy AR
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-neutral-950 sm:text-4xl">
            Real ledgers are complicated. Zentra handles the nuance.
          </h2>
          <p className="mt-4 text-base leading-7 text-neutral-500">
            Not every overdue invoice needs a payment reminder. Zentra reads the
            situation and picks the right type of action — so you don&rsquo;t send
            the wrong thing to the wrong customer.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {scenarios.map(({ icon: Icon, tag, body }) => (
            <div key={tag} className="rounded-2xl border border-black/8 bg-white p-5">
              <div className="flex items-center gap-2.5">
                <div className="flex size-8 items-center justify-center rounded-lg border border-black/8 bg-[#fbf8f1]">
                  <Icon className="size-3.5 text-neutral-600" />
                </div>
                <span className="text-sm font-semibold text-neutral-950">{tag}</span>
              </div>
              <p className="mt-3 text-sm leading-6 text-neutral-500">{body}</p>
            </div>
          ))}

          {/* Dark summary card */}
          <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-5 text-white">
            <p className="text-sm font-semibold leading-snug">
              Action + reason + message.
            </p>
            <p className="mt-2 text-sm leading-6 text-neutral-400">
              Every recommendation shows the recommended action, a plain-English
              reason, and a draft follow-up ready to review and copy.
            </p>
            <Link
              href="/dashboard"
              className="mt-5 inline-flex items-center gap-1.5 text-xs font-medium text-neutral-300 transition-colors hover:text-white"
            >
              See it in the demo
              <ArrowRight className="size-3" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Bookkeeper section ────────────────────────────────────────────────────────

const portfolioClients = [
  { name: "Bloom & Bridge", overdue: "£14,200", actions: 4, risk: "CRITICAL" },
  { name: "Calder IT", overdue: "£8,900", actions: 3, risk: "HIGH" },
  { name: "Finch & Field", overdue: "£5,600", actions: 2, risk: "MEDIUM" },
  { name: "Rowan Creative", overdue: "£3,100", actions: 1, risk: "MEDIUM" },
  { name: "Merebrook Advisory", overdue: "—", actions: 0, risk: "LOW" },
];

export function BookkeeperSection() {
  return (
    <section className="border-t border-black/10">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="overflow-hidden rounded-3xl border border-black/10 bg-white">
          <div className="grid lg:grid-cols-2">
            {/* Left: copy */}
            <div className="p-8 sm:p-10 lg:p-12">
              <div className="inline-flex items-center rounded-full border border-black/10 bg-[#fbf8f1] px-3 py-1 text-xs font-medium text-neutral-700">
                For bookkeepers
              </div>
              <h2 className="mt-5 text-3xl font-semibold tracking-tight text-neutral-950 sm:text-4xl">
                Manage every client ledger from one portfolio view.
              </h2>
              <p className="mt-4 text-base leading-7 text-neutral-600">
                Zentra Collect gives bookkeepers a portfolio dashboard showing
                risk, overdue totals, and pending actions across all clients —
                then drills into each business with its own full ranked plan.
              </p>
              <ul className="mt-7 space-y-3.5">
                {[
                  {
                    icon: LayoutDashboard,
                    text: "Portfolio risk view — all clients ranked by urgency and overdue exposure",
                  },
                  {
                    icon: Users,
                    text: "Per-client collections plan using the same decision engine",
                  },
                  {
                    icon: BookOpen,
                    text: "Weekly client briefs with overdue totals and top actions to take",
                  },
                ].map(({ icon: Icon, text }) => (
                  <li key={text} className="flex items-start gap-3">
                    <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border border-black/10 bg-white">
                      <Icon className="size-3.5 text-neutral-600" />
                    </span>
                    <span className="text-sm leading-6 text-neutral-700">{text}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/portfolio"
                className="mt-8 inline-flex items-center gap-2 rounded-full bg-neutral-950 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-neutral-800"
              >
                View portfolio demo
                <ArrowRight className="size-3.5" />
              </Link>
            </div>

            {/* Right: mini portfolio mockup */}
            <div className="flex items-center border-t border-black/10 bg-[#fbf8f1] p-8 sm:p-10 lg:border-l lg:border-t-0 lg:p-12">
              <div className="w-full overflow-hidden rounded-2xl border border-black/8 bg-white shadow-sm">
                <div className="border-b border-black/8 px-4 py-3">
                  <p className="text-xs font-semibold text-neutral-950">Portfolio overview</p>
                  <p className="mt-0.5 text-[0.65rem] text-neutral-400">
                    Hartley &amp; Co &middot; 5 client businesses
                  </p>
                </div>
                <div className="divide-y divide-black/8">
                  {portfolioClients.map(({ name, overdue, actions, risk }) => (
                    <div key={name} className="flex items-center justify-between px-4 py-2.5">
                      <div>
                        <p className="text-xs font-medium text-neutral-950">{name}</p>
                        <p className="mt-0.5 text-[0.6rem] text-neutral-400">
                          {overdue} overdue
                          {actions > 0 ? ` · ${actions} action${actions === 1 ? "" : "s"}` : ""}
                        </p>
                      </div>
                      <RiskBadge risk={risk} />
                    </div>
                  ))}
                </div>
                <div className="border-t border-black/8 bg-[#fbf8f1]/60 px-4 py-2.5">
                  <p className="text-[0.65rem] text-neutral-400">
                    Sorted by risk &middot; 07 May 2026
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Safety section ────────────────────────────────────────────────────────────

const safetyPoints = [
  {
    icon: BadgeCheck,
    title: "Human approval required",
    body: "Every message is drafted and reviewed by you before anything leaves your inbox. Nothing is sent automatically.",
  },
  {
    icon: History,
    title: "Full audit history",
    body: "Every recommendation, draft, and status change is logged to an activity trail per invoice.",
  },
  {
    icon: ShieldCheck,
    title: "Pre-send safety checks",
    body: "Disputes, do-not-chase flags, payment claims, and missing contacts are caught before you draft.",
  },
  {
    icon: XCircle,
    title: "No autonomous sending",
    body: "Zentra is a decision aid. It does not send emails, make calls, or take action on your behalf.",
  },
  {
    icon: Lock,
    title: "No legal advice",
    body: "Zentra does not draft legal letters or advise on debt recovery — only professional payment follow-up.",
  },
];

export function SafetySection() {
  return (
    <section className="border-t border-black/10">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="mb-10 max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">
            Safe by design
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-neutral-950 sm:text-4xl">
            Built around human judgement, not around automation.
          </h2>
          <p className="mt-4 text-base leading-7 text-neutral-500">
            Collections is sensitive. Zentra Collect is designed to support your
            judgement — not replace it.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {safetyPoints.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-2xl border border-black/8 bg-white p-5">
              <div className="flex size-9 items-center justify-center rounded-xl border border-black/8 bg-[#fbf8f1]">
                <Icon className="size-4 text-neutral-600" />
              </div>
              <h3 className="mt-4 text-sm font-semibold text-neutral-950">{title}</h3>
              <p className="mt-1.5 text-xs leading-5 text-neutral-500">{body}</p>
            </div>
          ))}

          {/* Disclaimer card */}
          <div className="rounded-2xl border border-black/8 bg-white p-5 sm:col-span-2 lg:col-span-1">
            <p className="text-sm font-semibold text-neutral-950">
              Zentra drafts and recommends.
            </p>
            <p className="mt-2 text-sm leading-6 text-neutral-500">
              You are responsible for reviewing every message before it leaves
              your email client. Zentra does not have access to send on your
              behalf.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Final CTA ─────────────────────────────────────────────────────────────────

export function FinalCTA() {
  return (
    <section className="border-t border-black/10">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-4xl font-semibold tracking-tight text-neutral-950 sm:text-5xl">
            Turn overdue invoices into today&rsquo;s action plan.
          </h2>
          <p className="mt-5 text-lg leading-8 text-neutral-500">
            No setup required. Upload a CSV export and get a ranked plan in
            minutes.
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
  );
}

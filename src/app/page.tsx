import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  MessageSquare,
  PhoneCall,
  RefreshCcw,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import { getPlanConfig, getPlanLimit, type PlanId } from "@/lib/account/plans";
import { CheckoutButton } from "@/components/billing/checkout-button";

// Base plan price IDs — set in env vars, passed to Stripe checkout
const PLAN_PRICE_IDS: Partial<Record<PlanId, string>> = {
  STARTER_SOLO:        process.env.STRIPE_PRICE_ID_STARTER_SOLO ?? "",
  SINGLE_BUSINESS:     process.env.STRIPE_PRICE_ID_SINGLE ?? "",
  BOOKKEEPER_STARTER:  process.env.STRIPE_PRICE_ID_BOOKKEEPER_STARTER ?? "",
  BOOKKEEPER_PRO:      process.env.STRIPE_PRICE_ID_BOOKKEEPER_PRO ?? "",
};

const answers = [
  "Who should I chase today?",
  "What should I ask for?",
  "What changed since last import?",
  "Is it safe to chase this customer?",
  "What cash is likely this week?",
];

const scenarios = [
  { label: "Payment reminders",  sub: "Drafted from invoice data, tone, and days overdue",   Icon: MessageSquare },
  { label: "Promise follow-ups", sub: "Tracks 'I'll pay Friday' and flags when it slips",     Icon: RefreshCcw    },
  { label: "Dispute responses",  sub: "Pauses chasing and logs what's needed to unblock",     Icon: ShieldCheck   },
  { label: "Statement requests", sub: "Generates a clear account summary on demand",          Icon: FileText      },
  { label: "AP-contact requests",sub: "Routes to the right contact when the invoice goes cold",Icon: UserCheck    },
];

const trustItems = [
  { label: "Human approval before every send", Icon: ShieldCheck },
  { label: "Activity history per invoice",      Icon: FileText },
  { label: "Plain-English safety checks",       Icon: CheckCircle2 },
  { label: "No legal or accounting advice",     Icon: ShieldCheck },
];

// 4 plans on the marketing page — trial entry, solo, single business, bookkeeper
const pricingPlanIds: PlanId[] = [
  "TRIAL",
  "STARTER_SOLO",
  "SINGLE_BUSINESS",
  "BOOKKEEPER_STARTER",
];

const pricingDescriptions: Record<PlanId, string> = {
  DEMO:                "Sample data only.",
  TRIAL:               "14 days, no card required. Upload your own AR exports.",
  STARTER_SOLO:        "For sole traders and micro businesses with a small invoice book.",
  FOUNDING_SINGLE:     "For one business running a practical chase process.",
  FOUNDING_BOOKKEEPER: "For bookkeepers managing client ledgers.",
  SINGLE_BUSINESS:     "For one small business running a practical chase process.",
  BOOKKEEPER_STARTER:  "For bookkeepers managing a handful of client ledgers.",
  BOOKKEEPER_PRO:      "For larger client portfolios that need more capacity.",
};

const faqs = [
  {
    q: "Do I need Xero or QuickBooks?",
    a: "No. CSV/Excel exports work. Most accounting tools can produce one in two clicks.",
  },
  {
    q: "Does Zentra send emails automatically?",
    a: "Only if you enable it. Auto-send is off by default — every message is reviewed by you first. When enabled, there is a 5-minute cancellation window before the first send fires.",
  },
  {
    q: "What happens after the trial?",
    a: "Your data stays available. New imports and AI drafts pause until you upgrade — you can also export everything before then.",
  },
  {
    q: "What counts as an AI action?",
    a: "Drafts, rewrites, reply classification, mapping suggestions, and weekly brief summaries.",
  },
  {
    q: "Is this debt collection or legal advice?",
    a: "No. Zentra is a decisioning and drafting tool. You remain responsible for what you send and to whom.",
  },
];

export default function Home() {
  return (
    <main
      className="min-h-screen relative z-[1]"
      style={{ background: "var(--zn-bg)", color: "var(--zn-ink)" }}
    >
      {/* ─── Top nav ─── */}
      <header
        className="sticky top-0 z-30 backdrop-blur"
        style={{
          background: "rgba(233,223,201,0.85)",
          borderBottom: "1px solid var(--zn-line)",
        }}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="zn-brand-mark">Z</span>
            <span className="flex flex-col leading-[1.1]">
              <span className="text-[14px] font-semibold tracking-[-0.01em]">Zentra</span>
              <span className="zn-section-label !p-0 !mt-0.5">Collect</span>
            </span>
          </Link>
          <nav className="hidden md:flex items-center gap-7 text-[13px] font-medium text-[#3d3428] dark:text-[#d8ccb5]">
            <Link href="#how-it-works" className="hover:text-[#1d1813] dark:text-[#f0e8d5]">How it works</Link>
            <Link href="#bookkeepers" className="hover:text-[#1d1813] dark:text-[#f0e8d5]">For bookkeepers</Link>
            <Link href="#pricing" className="hover:text-[#1d1813] dark:text-[#f0e8d5]">Pricing</Link>
            <Link href="#faq" className="hover:text-[#1d1813] dark:text-[#f0e8d5]">FAQ</Link>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/login" className="zn-pill zn-pill-ghost">Sign in</Link>
            <Link href="/demo" target="_blank" rel="noopener noreferrer" className="zn-pill">Try the demo</Link>
          </div>
        </div>
      </header>

      {/* ─── Hero ─── */}
      <section className="mx-auto grid max-w-7xl items-start gap-10 px-4 pb-14 pt-12 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(380px,0.85fr)] lg:px-8 lg:pb-20 lg:pt-20">
        <div className="min-w-0">
          <div className="zn-label !p-0 mb-3">Collections decisioning · for UK SMBs and bookkeepers</div>
          <h1
            className="max-w-3xl tracking-[-0.015em] text-[44px] leading-[1.02] sm:text-[60px] lg:text-[72px]"
            style={{
              fontFamily: "var(--font-newsreader), ui-serif, Georgia, serif",
              fontWeight: 500,
            }}
          >
            Upload overdue invoices. Get a ranked chase plan in minutes.
          </h1>
          <p className="mt-6 max-w-2xl text-[16px] leading-[1.6]" style={{ color: "var(--zn-ink-3)" }}>
            Zentra Collect turns AR ageing reports into clear next actions —
            who to chase, what to ask for, what to ignore, what cash is likely
            to land. Action + reason + draft message, in one calm workspace.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-2">
            <Link href="/demo" target="_blank" rel="noopener noreferrer" className="zn-pill" style={{ height: 40, padding: "0 18px", fontSize: 14 }}>
              Try the demo <ArrowRight className="size-4" />
            </Link>
            <Link href="/login?mode=signup" className="zn-pill zn-pill-ghost" style={{ height: 40, padding: "0 18px", fontSize: 14 }}>
              Start a free trial
            </Link>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px]" style={{ color: "var(--zn-ink-3)" }}>
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="size-3.5" style={{ color: "var(--zn-safe)" }} />
              Human approval before every send
            </span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="size-3.5" style={{ color: "var(--zn-safe)" }} />
              No card for trial
            </span>
          </div>
        </div>

        {/* Hero "screenshot" — recreates the dashboard onboarding card */}
        <div className="min-w-0">
          <div className="zn-card p-3 sm:p-4">
            <div
              className="rounded-[12px] p-5"
              style={{ background: "var(--zn-ink)", color: "var(--zn-surface)" }}
            >
              <div className="zn-label !p-0" style={{ color: "rgba(250,245,232,0.55)" }}>
                Today&apos;s focus
              </div>
              <p
                className="mt-1.5 text-[17px] leading-[1.4] italic"
                style={{ fontFamily: "var(--font-newsreader), ui-serif, Georgia, serif" }}
              >
                Recover £105,940 sitting overdue. Two calls likely move the needle most.
              </p>
            </div>
            <div className="mt-3 grid gap-2.5">
              {[
                { rank: 1, name: "Ashford Digital",    amount: "£12,750", sub: "54d overdue · Send payment reminder" },
                { rank: 2, name: "BluePeak Design",    amount: "£8,900",  sub: "77d overdue · Call customer"        },
                { rank: 3, name: "Northline Creative", amount: "£6,400",  sub: "63d overdue · No action needed"     },
                { rank: 4, name: "Redfern Architecture", amount: "£11,200", sub: "61d overdue · Escalation candidate" },
              ].map((row) => (
                <div
                  key={row.rank}
                  className="flex items-center gap-3 rounded-[10px] p-3"
                  style={{
                    background: "var(--zn-surface)",
                    border: "1px solid var(--zn-line-soft)",
                  }}
                >
                  <span
                    className="text-[16px] italic flex-shrink-0 w-5 text-center"
                    style={{
                      fontFamily: "var(--font-newsreader), ui-serif, Georgia, serif",
                      color: "var(--zn-ink-3)",
                    }}
                  >
                    {row.rank}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-semibold truncate text-[#1d1813] dark:text-[#f0e8d5]">{row.name}</div>
                    <div className="text-[11.5px] truncate" style={{ color: "var(--zn-ink-3)" }}>
                      {row.sub}
                    </div>
                  </div>
                  <div className="text-[13px] font-semibold tabular-nums flex-shrink-0 text-[#1d1813] dark:text-[#f0e8d5]">
                    {row.amount}
                  </div>
                  <span
                    className="zn-pill flex-shrink-0"
                    style={{ height: 24, fontSize: 11, padding: "0 10px" }}
                  >
                    Review
                  </span>
                </div>
              ))}
            </div>
            <div
              className="mt-3 flex items-center justify-between rounded-[10px] px-3 py-2"
              style={{ background: "var(--zn-surface-2)", border: "1px solid var(--zn-line-soft)" }}
            >
              <span className="text-[11.5px]" style={{ color: "var(--zn-ink-3)" }}>29 more in queue</span>
              <span className="text-[11.5px] font-medium" style={{ color: "var(--zn-safe)" }}>↑ £39,450 likely this week</span>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Answers ─── */}
      <Section eyebrow="What it answers" title="A focused decisioning layer for messy AR.">
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
          {answers.map((item) => (
            <div
              key={item}
              className="zn-card p-4 flex items-center gap-3 text-[13.5px] font-medium text-[#1d1813] dark:text-[#f0e8d5]"
              style={{ borderLeft: "3px solid var(--zn-accent)" }}
            >
              {item}
            </div>
          ))}
        </div>
      </Section>

      {/* ─── How it works ─── */}
      <Section id="how-it-works" eyebrow="How it works" title="From CSV to chase plan in four steps.">
        <div className="grid gap-3 md:grid-cols-4">
          {[
            { n: 1, title: "Upload",   sub: "AR ageing or invoice export — CSV today, Excel soon." },
            { n: 2, title: "Rank",     sub: "Rules-first ranking with reasons — not a black box." },
            { n: 3, title: "Review",   sub: "Action + reason + draft message + safety checks." },
            { n: 4, title: "Outcome",  sub: "Record what happened. Watch the queue update." },
          ].map((step) => (
            <div key={step.n} className="zn-card p-5">
              <span
                className="size-8 rounded-lg inline-flex items-center justify-center text-[13px] font-semibold"
                style={{ background: "var(--zn-ink)", color: "var(--zn-surface)" }}
              >
                {step.n}
              </span>
              <p className="mt-5 text-[14px] font-semibold text-[#1d1813] dark:text-[#f0e8d5]">{step.title}</p>
              <p className="mt-1.5 text-[12.5px]" style={{ color: "var(--zn-ink-3)" }}>{step.sub}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ─── Built for messy AR ─── */}
      <Section eyebrow="Scenarios" title="Every overdue invoice gets a different chase.">
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
          {scenarios.map((s) => (
            <div key={s.label} className="zn-card p-4 flex flex-col gap-3">
              <span
                className="size-7 rounded-lg inline-flex items-center justify-center flex-shrink-0"
                style={{ background: "var(--zn-surface-2)", color: "var(--zn-ink-2)" }}
              >
                <s.Icon className="size-3.5" />
              </span>
              <div>
                <p className="text-[13px] font-semibold text-[#1d1813] dark:text-[#f0e8d5]">{s.label}</p>
                <p className="mt-1 text-[11.5px] leading-[1.5]" style={{ color: "var(--zn-ink-3)" }}>{s.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ─── Bookkeepers ─── */}
      <Section
        id="bookkeepers"
        eyebrow="For bookkeepers"
        title="See which client ledgers need attention first."
      >
        <div className="zn-card p-6 lg:p-8">
          <p className="max-w-3xl text-[15px] leading-[1.65]" style={{ color: "var(--zn-ink-3)" }}>
            Portfolio mode is built for bookkeepers managing multiple small
            business clients. One pane across every ledger, weekly client
            briefs, ledger-level risk, and a clear queue for where to spend
            the next hour.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {[
              { kicker: "One pane",   value: "All clients",   sub: "Sortable by overdue, exceptions, or risk" },
              { kicker: "Per client", value: "Weekly brief",  sub: "Email-ready summaries for client meetings" },
              { kicker: "Pricing",    value: "From £99/mo",   sub: "Up to 5 client ledgers on Bookkeeper Starter" },
            ].map((m) => (
              <div key={m.kicker} className="zn-stat">
                <div className="zn-label">{m.kicker}</div>
                <div className="zn-stat-num mt-2" style={{ fontSize: 22 }}>{m.value}</div>
                <p className="text-[12px] mt-1" style={{ color: "var(--zn-ink-3)" }}>{m.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ─── Trust ─── */}
      <Section eyebrow="Safety" title="Recommendations stay human-approved.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {trustItems.map((item) => {
            const Ico = item.Icon;
            return (
              <div key={item.label} className="zn-card p-4 flex items-center gap-3">
                <span
                  className="size-8 rounded-lg inline-flex items-center justify-center flex-shrink-0"
                  style={{ background: "var(--zn-safe-soft)", color: "var(--zn-safe)" }}
                >
                  <Ico className="size-4" />
                </span>
                <span className="text-[13.5px] font-medium text-[#1d1813] dark:text-[#f0e8d5]">{item.label}</span>
              </div>
            );
          })}
        </div>
      </Section>

      {/* ─── Pricing ─── */}
      <Section
        id="pricing"
        eyebrow="Pricing"
        title="Clear plans for small teams and bookkeepers."
      >
        <p className="-mt-2 mb-6 max-w-2xl text-[13.5px]" style={{ color: "var(--zn-ink-3)" }}>
          Start with the demo. Move to a 14-day trial when you&apos;re ready to
          import your own data. Upgrade to a paid plan to keep going.
        </p>
        <div className="grid gap-3.5 md:grid-cols-2 lg:grid-cols-4">
          {pricingPlanIds.map((planId) => {
            const plan = getPlanConfig(planId);
            const isFeatured = planId === "SINGLE_BUSINESS";
            return (
              <div
                key={plan.id}
                className="zn-card p-5"
                style={
                  isFeatured
                    ? { borderColor: "var(--zn-ink)", boxShadow: "0 1px 0 rgba(29,24,19,0.04), 0 4px 18px -8px rgba(29,24,19,0.18)" }
                    : undefined
                }
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[13.5px] font-semibold text-[#1d1813] dark:text-[#f0e8d5]">{plan.name}</span>
                  {isFeatured ? (
                    <span
                      className="zn-chip"
                      style={{ background: "var(--zn-accent)", color: "var(--zn-accent-ink)", borderColor: "transparent" }}
                    >
                      Recommended
                    </span>
                  ) : null}
                </div>
                <div
                  className="mt-1 text-[34px] tracking-[-0.02em] tabular-nums"
                  style={{
                    fontFamily: "var(--font-newsreader), ui-serif, Georgia, serif",
                    fontWeight: 500,
                  }}
                >
                  {formatPrice(plan.id)}
                  <span className="text-[14px] ml-1" style={{ color: "var(--zn-ink-3)", fontFamily: "var(--font-geist-sans)" }}>
                    {plan.priceMonthlyGbp === 0 ? "" : "/mo"}
                  </span>
                </div>
                <p className="mt-3 text-[13px] leading-[1.5] min-h-[42px]" style={{ color: "var(--zn-ink-3)" }}>
                  {pricingDescriptions[plan.id]}
                </p>
                <div className="mt-4 flex flex-col gap-2">
                  {getPricingBullets(plan.id).map((feature) => (
                    <div key={feature} className="flex items-start gap-2 text-[12.5px] text-[#3d3428] dark:text-[#d8ccb5]">
                      <CheckCircle2 className="size-3.5 flex-shrink-0 mt-0.5" style={{ color: "var(--zn-safe)" }} />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
                {planId === "TRIAL" ? (
                  <Link
                    href="/login?mode=signup"
                    className="zn-pill zn-pill-ghost mt-5 w-full justify-center"
                  >
                    Start free trial
                  </Link>
                ) : PLAN_PRICE_IDS[planId] ? (
                  <CheckoutButton
                    priceId={PLAN_PRICE_IDS[planId]!}
                    planId={planId}
                    cta="Get started"
                    variant={isFeatured ? "primary" : "secondary"}
                    className="mt-5"
                  />
                ) : (
                  <Link
                    href="/request-access"
                    className="zn-pill zn-pill-ghost mt-5 w-full justify-center"
                  >
                    Request access
                  </Link>
                )}
              </div>
            );
          })}
        </div>
        <p className="mt-6 text-[12.5px]" style={{ color: "var(--zn-ink-3)" }}>
          All plans include a 14-day free trial. No card required to start. <Link href="/request-access" className="underline underline-offset-2">Contact us</Link> if you need a custom plan.
        </p>
      </Section>

      {/* ─── FAQ ─── */}
      <Section id="faq" eyebrow="FAQ" title="Straight answers before you start.">
        <div className="grid gap-3 md:grid-cols-2">
          {faqs.map((f) => (
            <div key={f.q} className="zn-card p-5">
              <p className="text-[14px] font-semibold text-[#1d1813] dark:text-[#f0e8d5]">{f.q}</p>
              <p className="mt-2 text-[13px] leading-[1.6]" style={{ color: "var(--zn-ink-3)" }}>
                {f.a}
              </p>
            </div>
          ))}
        </div>
      </Section>

      {/* ─── Final CTA ─── */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div
          className="zn-card overflow-hidden p-0"
          style={{ background: "var(--zn-ink)", borderColor: "var(--zn-ink)" }}
        >
          <div className="p-8 lg:p-10" style={{ color: "var(--zn-surface)" }}>
            <div className="zn-label !p-0 mb-2" style={{ color: "rgba(250,245,232,0.55)" }}>
              Get started
            </div>
            <h2
              className="max-w-3xl text-[32px] sm:text-[40px] leading-[1.1]"
              style={{ fontFamily: "var(--font-newsreader), ui-serif, Georgia, serif", fontWeight: 500 }}
            >
              Turn overdue invoices into today&apos;s action plan.
            </h2>
            <div className="mt-6 flex flex-wrap items-center gap-2">
              <Link
                href="/demo"
                target="_blank"
                rel="noopener noreferrer"
                className="zn-pill"
                style={{
                  height: 40, padding: "0 18px", fontSize: 14,
                  background: "var(--zn-accent)", color: "var(--zn-accent-ink)",
                }}
              >
                Try the demo <ArrowRight className="size-4" />
              </Link>
              <Link
                href="/login?mode=signup"
                className="zn-pill"
                style={{
                  height: 40, padding: "0 18px", fontSize: 14,
                  background: "transparent", color: "var(--zn-surface)",
                  border: "1px solid rgba(250,245,232,0.25)",
                }}
              >
                Start a trial
              </Link>
            </div>
            <p className="mt-6 max-w-2xl text-[12.5px] leading-[1.6]" style={{ color: "rgba(250,245,232,0.55)" }}>
              Zentra Collect is a decisioning and drafting tool. It does not send messages automatically and does not provide legal, accounting, or tax advice. You remain responsible for reviewing and approving every message before it goes out.
            </p>
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t mt-4" style={{ borderColor: "var(--zn-line)" }}>
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div className="flex items-center gap-2.5">
            <span className="zn-brand-mark" style={{ width: 24, height: 24, fontSize: 13 }}>Z</span>
            <span className="text-[13px] font-medium text-[#1d1813] dark:text-[#f0e8d5]">Zentra Collect</span>
          </div>
          <div className="flex flex-wrap items-center gap-5 text-[12.5px]" style={{ color: "var(--zn-ink-3)" }}>
            <Link href="/help"    className="hover:text-[#1d1813] dark:text-[#f0e8d5]">Help</Link>
            <Link href="#pricing" className="hover:text-[#1d1813] dark:text-[#f0e8d5]">Pricing</Link>
            <Link href="/login"   className="hover:text-[#1d1813] dark:text-[#f0e8d5]">Sign in</Link>
            <Link href="/terms"   className="hover:text-[#1d1813] dark:text-[#f0e8d5]">Terms</Link>
            <Link href="/privacy" className="hover:text-[#1d1813] dark:text-[#f0e8d5]">Privacy</Link>
            <Link href="/cookies" className="hover:text-[#1d1813] dark:text-[#f0e8d5]">Cookies</Link>
            <span>© {new Date().getFullYear()} Zentra Ltd</span>
          </div>
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
    <section id={id} className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-6 max-w-3xl">
        <div className="zn-label !p-0 mb-2">{eyebrow}</div>
        <h2
          className="text-[28px] sm:text-[32px] tracking-[-0.015em] leading-[1.1] text-[#1d1813] dark:text-[#f0e8d5]"
          style={{ fontFamily: "var(--font-newsreader), ui-serif, Georgia, serif", fontWeight: 500 }}
        >
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

function formatPrice(planId: PlanId) {
  const plan = getPlanConfig(planId);
  if (plan.priceMonthlyGbp === 0) return "£0";
  return `£${plan.priceMonthlyGbp}`;
}

function formatLimit(value: number | "unlimited") {
  return value === "unlimited" ? "unlimited" : value.toLocaleString("en-GB");
}

function getPricingBullets(planId: PlanId) {
  const plan = getPlanConfig(planId);
  const activeInvoices = formatLimit(getPlanLimit(planId, "activeInvoiceCount") as number | "unlimited");
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
      `${activeInvoices} active invoices`,
      `${formatLimit(imports as number | "unlimited")} imports total`,
      `${formatLimit(aiActions as number | "unlimited")} AI actions`,
      "Export everything anytime",
    ];
  }

  return [
    plan.features.bookkeeperMode
      ? `Up to ${formatLimit(clientLedgers as number | "unlimited")} client ledgers`
      : `1 business`,
    `${activeInvoices} active invoices`,
    `${formatLimit(imports as number | "unlimited")} imports / month`,
    `${formatLimit(aiActions as number | "unlimited")} AI actions / month`,
    "Weekly digest preview",
  ];
}

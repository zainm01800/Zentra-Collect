import Link from "next/link";
import {
  ArrowRight,
  Banknote,
  CheckCircle2,
  FileText,
  Mail,
  PiggyBank,
  Receipt,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { MarketingNav } from "@/components/marketing-nav";
import { LandingFocusCard } from "@/components/landing-focus-card";
import type { PlanId } from "@/lib/account/plans";
import { PricingSection } from "@/components/pricing-section";

// Monthly plan price IDs — set in env vars, passed to Stripe checkout
const PLAN_PRICE_IDS: Partial<Record<PlanId, string>> = {
  TRADER:              process.env.STRIPE_PRICE_ID_TRADER ?? "",
  FREELANCE:           process.env.STRIPE_PRICE_ID_FREELANCE ?? "",
  STARTER_SOLO:        process.env.STRIPE_PRICE_ID_STARTER_SOLO ?? "",
  SINGLE_BUSINESS:     process.env.STRIPE_PRICE_ID_SINGLE ?? "",
  BOOKKEEPER_STARTER:  process.env.STRIPE_PRICE_ID_BOOKKEEPER_STARTER ?? "",
  BOOKKEEPER_PRO:      process.env.STRIPE_PRICE_ID_BOOKKEEPER_PRO ?? "",
};

// Annual plan price IDs (~17% discount). Optional — the toggle hides itself
// when none of these are configured.
const PLAN_PRICE_IDS_ANNUAL: Partial<Record<PlanId, string>> = {
  TRADER:              process.env.STRIPE_PRICE_ID_TRADER_ANNUAL ?? "",
  FREELANCE:           process.env.STRIPE_PRICE_ID_FREELANCE_ANNUAL ?? "",
  STARTER_SOLO:        process.env.STRIPE_PRICE_ID_STARTER_SOLO_ANNUAL ?? "",
  SINGLE_BUSINESS:     process.env.STRIPE_PRICE_ID_SINGLE_ANNUAL ?? "",
  BOOKKEEPER_STARTER:  process.env.STRIPE_PRICE_ID_BOOKKEEPER_STARTER_ANNUAL ?? "",
  BOOKKEEPER_PRO:      process.env.STRIPE_PRICE_ID_BOOKKEEPER_PRO_ANNUAL ?? "",
};

// ── Marketing copy — "books that catch the cash" positioning ────────────────

const answers = [
  "Who owes me money right now?",
  "Will I have enough to cover rent next week?",
  "How much will I owe HMRC?",
  "Which expenses haven't I categorised?",
  "What changed since last week?",
];

// Features are written for the smallest sole-trader user first ("you
// only send a handful of invoices a month") and scale up. Every line
// answers "why does this matter if I'm one person billing 5 clients?"
const features = [
  {
    label: "Send a professional invoice in 30 seconds",
    sub:   "Branded invoices, payment portal built in. Works whether you send 3 a month or 300.",
    Icon:  Receipt,
  },
  {
    label: "Bank feed does the boring bit",
    sub:   "Payment hits your account → invoice marked paid, chase stops, tax estimate updates. No spreadsheets at month-end.",
    Icon:  Banknote,
  },
  {
    label: "Expenses tagged from the bank feed",
    sub:   "Click-categorise straight from real transactions. HMRC categories preset. Mileage on the roadmap.",
    Icon:  FileText,
  },
  {
    label: "Self-Assessment estimate",
    sub:   "Updates as cash actually lands — not when invoices fire. January 31st becomes a 15-minute job.",
    Icon:  PiggyBank,
  },
  {
    label: "VAT estimate (and MTD when you're ready)",
    sub:   "Even if you're under the £90k threshold today. Quarterly view, ready for MTD filing when we ship it.",
    Icon:  TrendingUp,
  },
  {
    label: "Chase one customer or chase fifty",
    sub:   "Ranked queue with action + reason + draft. Drafts the awkward email for you — you approve every send.",
    Icon:  Mail,
  },
];

const trustItems = [
  { label: "Human approval before every send", Icon: ShieldCheck },
  { label: "Activity history per invoice",      Icon: FileText },
  { label: "UK-hosted data, encrypted at rest", Icon: ShieldCheck },
  { label: "No legal or accounting advice",     Icon: CheckCircle2 },
];

// Public pricing — grouped into three segments on the page (rendered
// in three <PricingSection /> calls below). FREE is no longer publicly
// listed; the £5/mo Starter (TRADER in legacy code) is the entry tier
// and includes books + template chasing.
const segmentSoleTraderIds:   PlanId[] = ["TRADER",             "FREELANCE"];
const segmentGrowingIds:      PlanId[] = ["STARTER_SOLO",       "SINGLE_BUSINESS"];
const segmentBookkeeperIds:   PlanId[] = ["BOOKKEEPER_STARTER", "BOOKKEEPER_PRO"];

const pricingDescriptions: Record<PlanId, string> = {
  DEMO:                "Sample data only.",
  FREE:                "For very small sole traders. 3 active invoices, real bank feed, real tax estimate — forever free.",
  TRIAL:               "14 days, no card required. Real bank feed, real invoices, real chase plan — at full power.",
  TRADER:              "For UK sole traders under £90k — invoicing, payment portal, tax estimate.",
  FREELANCE:           "For sole traders billing 5–15 invoices a month. Templates, customer portal, full books.",
  STARTER_SOLO:        "For sole traders ready for AI-drafted chases. Up to 200 active invoices.",
  SINGLE_BUSINESS:     "Small businesses running a practical chase process every week.",
  BOOKKEEPER_STARTER:  "Bookkeepers managing a handful of client ledgers.",
  BOOKKEEPER_PRO:      "Larger client portfolios that need more capacity.",
};

const faqs = [
  {
    q: "Is this an accounting tool or a chasing tool?",
    a: "Both — built as one. The books features (invoicing, expenses, tax, VAT) and the chasing features share the same data, so payments reconcile automatically and your tax estimate moves as cash actually lands.",
  },
  {
    q: "Do I need Xero or QuickBooks?",
    a: "No. You can run your books entirely in Zentra. If you already have Xero or QuickBooks, we can read-only sync from them so you don't double-enter invoices.",
  },
  {
    q: "Does Zentra send chase emails automatically?",
    a: "Only if you switch on auto-send — it's off by default. Every message is reviewed by you first. Auto-send has a 5-minute cancellation window before the first send fires.",
  },
  {
    q: "Can I file my Self-Assessment from this?",
    a: "Today: we generate a Self-Assessment summary you (or your accountant) paste into HMRC. Full MTD-IT filing is on the roadmap.",
  },
  {
    q: "What happens after the trial?",
    a: "Your data stays available. New imports and AI drafts pause until you upgrade — you can also export everything anytime as CSV.",
  },
  {
    q: "Is this debt collection or legal advice?",
    a: "No. Zentra is a books and decisioning tool. You remain responsible for what you send and to whom — we never give legal, accounting, or tax advice.",
  },
];

export default function Home() {
  return (
    <main
      id="main-content"
      className="min-h-screen relative z-[1]"
      style={{ background: "var(--zn-bg)", color: "var(--zn-ink)" }}
    >
      {/* ─── Top nav ─── */}
      <MarketingNav />

      {/* ─── Hero ─── */}
      <section className="mx-auto grid max-w-7xl items-start gap-10 px-4 pb-14 pt-12 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(380px,0.85fr)] lg:px-8 lg:pb-20 lg:pt-20">
        <div className="min-w-0">
          <div className="zn-label !p-0 mb-3">Books for UK sole traders &amp; small businesses</div>
          <h1
            className="max-w-3xl tracking-[-0.015em] text-[44px] leading-[1.02] sm:text-[60px] lg:text-[72px]"
            style={{
              fontFamily: "var(--font-newsreader), ui-serif, Georgia, serif",
              fontWeight: 500,
            }}
          >
            Books that catch the cash.
          </h1>
          <p className="mt-6 max-w-2xl text-[16px] leading-[1.6]" style={{ color: "var(--zn-ink-3)" }}>
            Send invoices, track expenses, estimate your tax — and{" "}
            <em
              style={{
                fontFamily: "var(--font-newsreader), ui-serif, Georgia, serif",
                color: "var(--zn-ink)",
              }}
            >actually collect the cash</em>. The only UK books tool that ranks
            who to chase today, drafts the message, and updates your tax
            estimate the moment a payment lands. Works at 3 invoices a month
            or 300.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-2">
            <Link href="/login?mode=signup" className="zn-pill" style={{ height: 40, padding: "0 18px", fontSize: 14 }}>
              Start free trial <ArrowRight className="size-4" />
            </Link>
            <Link href="/demo" className="zn-pill zn-pill-ghost" style={{ height: 40, padding: "0 18px", fontSize: 14 }}>
              Try the demo
            </Link>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px]" style={{ color: "var(--zn-ink-3)" }}>
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="size-3.5" style={{ color: "var(--zn-safe)" }} />
              No card for trial
            </span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="size-3.5" style={{ color: "var(--zn-safe)" }} />
              Human approval before every send
            </span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="size-3.5" style={{ color: "var(--zn-safe)" }} />
              UK-hosted data
            </span>
          </div>
          <p className="mt-4 text-[12px]" style={{ color: "var(--zn-ink-2)" }}>
            Trusted by UK bookkeepers &amp; sole traders · Backed by the UK Late Payment Act
          </p>
        </div>

        {/* Hero "screenshot" — animated client component (audit §3 UX-9). */}
        <div className="min-w-0">
          <LandingFocusCard />
        </div>
      </section>

      {/* ─── Who is this for? Three doors right under the hero ─── */}
      <Section eyebrow="Who is this for?" title="Three doors. Pick the one that fits.">
        <div className="grid gap-3 md:grid-cols-3">
          {[
            {
              title: "Sole traders",
              body:  "Run your books, file Self-Assessment, occasionally chase a late client. Starter from £5/mo.",
              href:  "#pricing",
              cta:   "See sole-trader plans",
            },
            {
              title: "Growing businesses",
              body:  "Books AND chasing every week. AI-drafted emails, reply classification, integrations. From £29/mo.",
              href:  "#pricing",
              cta:   "See business plans",
            },
            {
              title: "Bookkeepers",
              body:  "Manage multiple client ledgers in one workspace. Counterparty exposure included. From £119/mo.",
              href:  "#pricing",
              cta:   "See practice plans",
            },
          ].map((door) => (
            <Link
              key={door.title}
              href={door.href}
              className="zn-card p-5 flex flex-col gap-2 transition-colors hover:bg-[var(--zn-surface-2)]"
            >
              <p className="text-[15px] font-semibold text-[#1d1813] dark:text-[#f0e8d5]">
                {door.title}
              </p>
              <p className="text-[13px] leading-[1.55] flex-1" style={{ color: "var(--zn-ink-3)" }}>
                {door.body}
              </p>
              <span className="text-[12.5px] font-medium mt-1 inline-flex items-center gap-1" style={{ color: "var(--zn-accent)" }}>
                {door.cta} <ArrowRight className="size-3" />
              </span>
            </Link>
          ))}
        </div>
      </Section>

      {/* ─── Answers ─── */}
      <Section eyebrow="What it answers every morning" title="One workspace. Five questions.">
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

      {/* ─── Full feature breadth ─── */}
      <Section eyebrow="Everything you need" title="Full books — plus the layer that gets you paid.">
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.label} className="zn-card p-5 flex flex-col gap-3">
              <span
                className="size-8 rounded-lg inline-flex items-center justify-center flex-shrink-0"
                style={{ background: "var(--zn-surface-2)", color: "var(--zn-ink-2)" }}
              >
                <f.Icon className="size-4" />
              </span>
              <div>
                <p className="text-[14px] font-semibold text-[#1d1813] dark:text-[#f0e8d5]">{f.label}</p>
                <p className="mt-1 text-[12.5px] leading-[1.5]" style={{ color: "var(--zn-ink-3)" }}>{f.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ─── How it works ─── */}
      <Section id="how-it-works" eyebrow="How it works" title="Invoice. Chase. Reconcile. File.">
        <div className="grid gap-3 md:grid-cols-4">
          {[
            { n: 1, title: "Invoice",      sub: "Send branded invoices in 30 seconds. Customer pays via portal." },
            { n: 2, title: "Chase",        sub: "Ranked queue tells you who to nudge, why, with draft pre-written." },
            { n: 3, title: "Reconcile",    sub: "Bank feed marks invoices paid automatically — chasing stops." },
            { n: 4, title: "File",         sub: "Self-Assessment summary on demand. VAT MTD on the roadmap." },
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

      {/* ─── What's different ─── */}
      <Section
        id="why-zentra"
        eyebrow="Why this is different"
        title="Other books are passive. Ours actively collects."
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              kicker: "Vs FreeAgent / QuickBooks SE",
              title:  "A red number on a dashboard isn't a plan.",
              body:   "Standard books tools tell you which invoice is late. Then it's your problem. Zentra ranks, drafts, and tracks every chase — so you don't lie awake on Sunday wondering who to email Monday morning.",
            },
            {
              kicker: "Vs Chaser / Satago",
              title:  "Chasing without books is half the job.",
              body:   "Pure-play chasing tools have no invoicing, no expenses, no tax. You end up paying for two tools that don't talk to each other. Zentra is one tool, one ledger.",
            },
            {
              kicker: "Stop-chasing intelligence",
              title:  "Knows when NOT to chase.",
              body:   "Customers on Direct Debit auto-disappear from your queue. Reliable late-payers get a softer touch. Recent chases throttle automatically. No more accidentally double-chasing a paying customer.",
            },
            {
              kicker: "Counterparty exposure",
              title:  "Spot bad payers before they burn you.",
              body:   "When the same customer is late paying two or more businesses on Zentra, we flag the risk before you extend more credit. Nobody else can see this.",
            },
            {
              kicker: "Customer portal",
              title:  "One link, three actions.",
              body:   "Every chase email carries a signed link. Your customer can pay, promise a date, or explain the delay — with statutory interest and early-pay discounts surfaced automatically.",
            },
            {
              kicker: "Cash-basis books",
              title:  "Tax estimate moves when money lands.",
              body:   "Your Self-Assessment estimate updates the moment cash hits your account, not the moment you issue an invoice. The number you see is the number you'll be taxed on.",
            },
          ].map((card) => (
            <div key={card.title} className="zn-card p-5">
              <div className="zn-label">{card.kicker}</div>
              <p className="mt-2 text-[15px] font-semibold leading-tight text-[#1d1813] dark:text-[#f0e8d5]">
                {card.title}
              </p>
              <p className="mt-2 text-[12.5px] leading-[1.55]" style={{ color: "var(--zn-ink-3)" }}>
                {card.body}
              </p>
            </div>
          ))}
        </div>
      </Section>

      {/* ─── Bookkeepers ─── */}
      <Section
        id="bookkeepers"
        eyebrow="For bookkeepers"
        title="One pane across every client ledger."
      >
        <div className="zn-card p-6 lg:p-8">
          <p className="max-w-3xl text-[15px] leading-[1.65]" style={{ color: "var(--zn-ink-3)" }}>
            Practice mode is built for bookkeepers managing multiple small
            business clients. One workspace across every ledger, weekly client
            briefs, ledger-level risk scoring, and a queue that tells you which
            client needs your hour first.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {[
              { kicker: "One pane",   value: "All clients",   sub: "Sortable by overdue, exceptions, or risk" },
              { kicker: "Per client", value: "Weekly brief",  sub: "Email-ready summaries for client meetings" },
              { kicker: "Pricing",    value: "From £119/mo",  sub: "Up to 5 client ledgers on Practice; 20 on Practice Pro" },
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
      <Section eyebrow="Safety" title="Quiet, opinionated, never automatic.">
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
        title="Clear plans for sole traders, small businesses, and bookkeepers."
      >
        <p className="mb-6 max-w-2xl text-[13.5px]" style={{ color: "var(--zn-ink-3)" }}>
          Pick the segment that fits. Every plan includes a 14-day free
          trial at full power — no card required.
        </p>

        {/* Segment 1: Sole traders */}
        <SegmentHeader
          title="For sole traders"
          sub="Books-first. Light chasing if you need it. Driving instructors, freelancers, tradespeople, anyone billing a handful of clients a month."
        />
        <PricingSection
          plans={segmentSoleTraderIds.map((planId) => ({
            planId,
            priceId:        PLAN_PRICE_IDS[planId] || undefined,
            priceIdAnnual:  PLAN_PRICE_IDS_ANNUAL[planId] || undefined,
          }))}
        />

        {/* Segment 2: Growing businesses */}
        <div className="mt-10">
          <SegmentHeader
            title="For growing businesses"
            sub="Books AND active chasing. AI-drafted emails, reply classification, auto-send and accounting integrations on Business."
          />
          <PricingSection
            compact
            plans={segmentGrowingIds.map((planId) => ({
              planId,
              priceId:        PLAN_PRICE_IDS[planId] || undefined,
              priceIdAnnual:  PLAN_PRICE_IDS_ANNUAL[planId] || undefined,
            }))}
          />
        </div>

        {/* Segment 3: Bookkeepers */}
        <div className="mt-10">
          <SegmentHeader
            title="For bookkeepers"
            sub="Multi-client portfolios. One workspace across every ledger. Counterparty exposure and weekly client briefs included."
          />
          <PricingSection
            compact
            plans={segmentBookkeeperIds.map((planId) => ({
              planId,
              priceId:        PLAN_PRICE_IDS[planId] || undefined,
              priceIdAnnual:  PLAN_PRICE_IDS_ANNUAL[planId] || undefined,
            }))}
          />
        </div>
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
            <div className="zn-label !p-0 mb-2 opacity-55">
              Get started
            </div>
            <h2
              className="max-w-3xl text-[32px] sm:text-[40px] leading-[1.1]"
              style={{ fontFamily: "var(--font-newsreader), ui-serif, Georgia, serif", fontWeight: 500 }}
            >
              Books built around getting paid.
            </h2>
            <p
              className="mt-4 max-w-2xl text-[14.5px] leading-[1.55] opacity-75"
              style={{ color: "var(--zn-surface)" }}
            >
              14-day free trial. No card. Run your books and chase your cash from
              the same quiet workspace.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-2">
              <Link
                href="/login?mode=signup"
                className="zn-pill"
                style={{
                  height: 40, padding: "0 18px", fontSize: 14,
                  background: "var(--zn-accent)", color: "var(--zn-accent-ink)",
                }}
              >
                Start free trial <ArrowRight className="size-4" />
              </Link>
              <Link
                href="/demo"
                className="zn-pill"
                style={{
                  height: 40, padding: "0 18px", fontSize: 14,
                  background: "transparent", color: "var(--zn-surface)",
                  border: "1px solid rgba(250,245,232,0.25)",
                }}
              >
                Try the demo
              </Link>
            </div>
            <p className="mt-6 max-w-2xl text-[12.5px] leading-[1.6] opacity-55">
              Zentra is a books and decisioning tool. It does not send messages
              automatically and does not provide legal, accounting, or tax
              advice. You remain responsible for reviewing and approving every
              message before it goes out.
            </p>
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t mt-4" style={{ borderColor: "var(--zn-line)" }}>
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-center gap-2.5">
              <span className="zn-brand-mark" style={{ width: 24, height: 24, fontSize: 13 }}>Z</span>
              <span className="text-[13px] font-medium text-[#1d1813] dark:text-[#f0e8d5]">Zentra</span>
            </div>
            <div className="flex flex-wrap gap-x-8 gap-y-3 text-[12.5px]" style={{ color: "var(--zn-ink-3)" }}>
              <div className="flex flex-col gap-2">
                <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--zn-ink-3)" }}>Product</span>
                <Link href="/#how-it-works"  className="hover:text-[#1d1813] dark:hover:text-[#f0e8d5]">How it works</Link>
                <Link href="/#bookkeepers"   className="hover:text-[#1d1813] dark:hover:text-[#f0e8d5]">For bookkeepers</Link>
                <Link href="/#pricing"       className="hover:text-[#1d1813] dark:hover:text-[#f0e8d5]">Pricing</Link>
                <Link href="/free-tools"     className="hover:text-[#1d1813] dark:hover:text-[#f0e8d5]">Free tools</Link>
                <Link href="/#faq"           className="hover:text-[#1d1813] dark:hover:text-[#f0e8d5]">FAQ</Link>
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--zn-ink-3)" }}>Account</span>
                <Link href="/login?mode=signup" className="hover:text-[#1d1813] dark:hover:text-[#f0e8d5]">Start free trial</Link>
                <Link href="/login"             className="hover:text-[#1d1813] dark:hover:text-[#f0e8d5]">Sign in</Link>
                <Link href="/demo"              className="hover:text-[#1d1813] dark:hover:text-[#f0e8d5]">Try the demo</Link>
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--zn-ink-3)" }}>Company</span>
                <Link href="/about"   className="hover:text-[#1d1813] dark:hover:text-[#f0e8d5]">About</Link>
                <Link href="/trust"   className="hover:text-[#1d1813] dark:hover:text-[#f0e8d5]">Trust &amp; security</Link>
                <a href="https://status.zentracollect.co.uk" target="_blank" rel="noopener noreferrer" className="hover:text-[#1d1813] dark:hover:text-[#f0e8d5]">Status</a>
                <Link href="/help"    className="hover:text-[#1d1813] dark:hover:text-[#f0e8d5]">Help</Link>
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--zn-ink-3)" }}>Legal</span>
                <Link href="/terms"   className="hover:text-[#1d1813] dark:hover:text-[#f0e8d5]">Terms</Link>
                <Link href="/privacy" className="hover:text-[#1d1813] dark:hover:text-[#f0e8d5]">Privacy</Link>
                <Link href="/cookies" className="hover:text-[#1d1813] dark:hover:text-[#f0e8d5]">Cookies</Link>
              </div>
            </div>
          </div>
          <div className="mt-8 border-t pt-6 text-[12px]" style={{ borderColor: "var(--zn-line-soft)", color: "var(--zn-ink-3)" }}>
            © {new Date().getFullYear()} Zentra Ltd · Registered in England &amp; Wales · UK books that get you paid
          </div>
        </div>
      </footer>
    </main>
  );
}

// Also update the homepage <title>/<description> metadata to match.
// Done by overriding via the Next.js convention in layout.tsx's `template` —
// the root template will append " · Zentra Collect" but for the homepage we
// want the default title from the layout to keep firing. The opengraph image
// already references the right text via twitter-image.tsx / opengraph-image.tsx.

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

function SegmentHeader({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="mb-4 mt-2 max-w-2xl">
      <h3
        className="text-[18px] sm:text-[20px] tracking-[-0.01em] leading-[1.15] text-[#1d1813] dark:text-[#f0e8d5]"
        style={{ fontFamily: "var(--font-newsreader), ui-serif, Georgia, serif", fontWeight: 500 }}
      >
        {title}
      </h3>
      <p className="mt-1 text-[12.5px] leading-[1.55]" style={{ color: "var(--zn-ink-3)" }}>
        {sub}
      </p>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  ArrowDown,
  Banknote,
  CheckCircle2,
  Clock,
  FileText,
  Mail,
  PiggyBank,
  Receipt,
  Sparkles,
  TrendingUp,
  Wallet,
} from "lucide-react";

/**
 * Mockup: "Books that catch the cash" — proposed home screen.
 *
 * This is a static, illustrative-only page used to discuss product
 * direction. It is NOT wired to real data. Linked from nowhere.
 *
 * View at: /mockups/cashflow-home
 */

export const metadata: Metadata = {
  title: "Mockup — Books that catch the cash",
  robots: { index: false, follow: false },
};

const TODAY_QUEUE = [
  {
    name: "BluePeak Design",
    amount: "£8,900",
    overdue: "77 days",
    why: "Promise to pay slipped 6 days ago",
    action: "Call before noon",
    tone: "risk",
  },
  {
    name: "Northline Creative",
    amount: "£6,400",
    overdue: "63 days",
    why: "No reply to last 2 reminders",
    action: "Send firm reminder",
    tone: "warn",
  },
  {
    name: "Ashford Digital",
    amount: "£2,340",
    overdue: "12 days",
    why: "First reminder — friendly tone fits",
    action: "Send friendly nudge",
    tone: "ok",
  },
] as const;

const JUST_PAID = [
  { name: "Atlas IT Support",  amount: "£980",  via: "Bank feed · 9:42 AM"  },
  { name: "Greenstone Consulting", amount: "£3,450", via: "GoCardless · 8:15 AM" },
];

const BOOKS_LINKS = [
  {
    href: "#",
    icon: PiggyBank,
    label: "Self-Assessment",
    value: "£4,820",
    sub: "Estimate · updated when cash lands",
  },
  {
    href: "#",
    icon: TrendingUp,
    label: "Profit this quarter",
    value: "£18,240",
    sub: "Cash basis · before tax",
  },
  {
    href: "#",
    icon: Receipt,
    label: "Expenses to categorise",
    value: "11",
    sub: "From bank feed",
  },
  {
    href: "#",
    icon: Banknote,
    label: "VAT next due",
    value: "£3,140",
    sub: "Filed 7 May · next 7 Aug",
  },
];

export default function CashflowHomeMockup() {
  return (
    <main
      id="main-content"
      className="min-h-screen"
      style={{ background: "var(--zn-bg)", color: "var(--zn-ink)" }}
    >
      {/* Mockup banner */}
      <div
        className="sticky top-0 z-20 px-4 py-2 text-center text-[11.5px] font-semibold uppercase tracking-[0.12em]"
        style={{
          background: "#fdf3dc",
          color: "#7a5a18",
          borderBottom: "1px solid #e6d3a3",
        }}
      >
        Mockup · illustrative only · not wired to data
      </div>

      <div className="flex">
        {/* Faux sidebar */}
        <aside
          className="hidden md:flex flex-col w-[220px] shrink-0 px-4 py-5 gap-1 border-r"
          style={{ borderColor: "var(--zn-line)" }}
        >
          <div className="flex items-center gap-2.5 mb-6">
            <span className="zn-brand-mark">Z</span>
            <span className="flex flex-col leading-[1.1]">
              <span className="text-[14px] font-semibold">Zentra</span>
              <span className="text-[10.5px] font-medium uppercase tracking-[0.1em]" style={{ color: "var(--zn-ink-3)" }}>
                Cash
              </span>
            </span>
          </div>

          <NavGroup label="Cashflow" defaultOpen>
            <NavItem icon={Sparkles}   label="Today"          active />
            <NavItem icon={Mail}       label="Chase plan"     badge="3" />
            <NavItem icon={Wallet}     label="Invoices"      />
            <NavItem icon={Banknote}   label="Bank feed"     />
          </NavGroup>

          <NavGroup label="Books">
            <NavItem icon={Receipt}    label="Expenses" />
            <NavItem icon={TrendingUp} label="P&L" />
            <NavItem icon={PiggyBank}  label="Tax" />
            <NavItem icon={FileText}   label="VAT" />
          </NavGroup>
        </aside>

        {/* Main */}
        <div className="flex-1 px-4 sm:px-8 py-8 max-w-[1100px]">
          {/* Eyebrow */}
          <p className="zn-label !p-0 mb-2">Today · Mon 18 May</p>

          {/* Hero card */}
          <section
            className="rounded-2xl p-6 sm:p-7 mb-6"
            style={{ background: "var(--zn-ink)", color: "var(--zn-surface)" }}
          >
            <div className="flex items-baseline gap-3 mb-2">
              <span
                className="text-[12px] font-semibold uppercase tracking-[0.12em]"
                style={{ color: "rgba(255,255,255,0.55)" }}
              >
                Cash likely this week
              </span>
            </div>
            <div className="flex items-baseline gap-4 flex-wrap">
              <span
                className="text-[44px] sm:text-[56px] tracking-[-0.02em] leading-none tabular-nums"
                style={{
                  fontFamily: "var(--font-newsreader), ui-serif, Georgia, serif",
                  fontWeight: 500,
                }}
              >
                £17,640
              </span>
              <span
                className="text-[15px] italic"
                style={{ fontFamily: "var(--font-newsreader), ui-serif, Georgia, serif", color: "rgba(255,255,255,0.75)" }}
              >
                Three nudges and one call move 80% of it.
              </span>
            </div>
            <p
              className="mt-4 text-[13.5px] leading-[1.6] max-w-2xl"
              style={{ color: "rgba(255,255,255,0.75)" }}
            >
              Two customers already paid this morning (£4,430). BluePeak's promise
              slipped — that one needs a call before noon. Your tax estimate will
              update automatically as the rest lands.
            </p>
          </section>

          {/* Today's queue */}
          <section className="mb-6">
            <div className="flex items-end justify-between mb-3">
              <div>
                <p className="zn-label !p-0">Today's queue</p>
                <h2 className="text-[20px] font-semibold mt-0.5" style={{ color: "var(--zn-ink)" }}>
                  3 invoices · action + reason + draft.
                </h2>
              </div>
              <Link href="#" className="text-[12px] font-medium underline underline-offset-2" style={{ color: "var(--zn-ink-3)" }}>
                Open full chase plan →
              </Link>
            </div>

            <div
              className="rounded-2xl overflow-hidden"
              style={{ background: "var(--zn-surface)", border: "1px solid var(--zn-line-soft)" }}
            >
              {TODAY_QUEUE.map((row, idx) => (
                <div
                  key={row.name}
                  className="flex flex-wrap sm:flex-nowrap items-center gap-3 px-5 py-4"
                  style={{ borderTop: idx === 0 ? "none" : "1px solid var(--zn-line-soft)" }}
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <span
                      className="size-7 rounded-md inline-flex items-center justify-center text-[12px] font-bold flex-shrink-0 mt-0.5"
                      style={{
                        background:
                          row.tone === "risk" ? "var(--zn-risk-soft)" :
                          row.tone === "warn" ? "var(--zn-warn-soft)" :
                          "var(--zn-safe-soft)",
                        color:
                          row.tone === "risk" ? "var(--zn-risk)" :
                          row.tone === "warn" ? "var(--zn-warn)" :
                          "var(--zn-safe)",
                      }}
                    >
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold truncate" style={{ color: "var(--zn-ink)" }}>
                        {row.name}
                      </p>
                      <p className="text-[12px] mt-0.5" style={{ color: "var(--zn-ink-3)" }}>
                        {row.overdue} overdue · <span style={{ color: "var(--zn-ink-2)" }}>{row.why}</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 sm:gap-5 shrink-0 ml-10 sm:ml-0">
                    <span className="text-[14px] font-semibold tabular-nums" style={{ color: "var(--zn-ink)" }}>
                      {row.amount}
                    </span>
                    <span
                      className="zn-pill"
                      style={{
                        height: 30,
                        fontSize: 12,
                        padding: "0 14px",
                        background:
                          row.tone === "risk" ? "var(--zn-risk)" :
                          row.tone === "warn" ? "var(--zn-ink)" :
                          "var(--zn-ink)",
                        color: "var(--zn-surface)",
                      }}
                    >
                      {row.action} <ArrowRight className="size-3" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Just paid + books — side by side */}
          <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
            {/* Just paid */}
            <section
              className="rounded-2xl p-5"
              style={{ background: "var(--zn-surface)", border: "1px solid var(--zn-line-soft)" }}
            >
              <div className="flex items-center justify-between mb-3">
                <p className="zn-label !p-0">Just landed</p>
                <span
                  className="inline-flex items-center gap-1 text-[11.5px] font-medium px-2 py-0.5 rounded-full"
                  style={{ background: "var(--zn-safe-soft)", color: "var(--zn-safe)" }}
                >
                  <CheckCircle2 className="size-3" /> Auto-reconciled
                </span>
              </div>
              <div className="flex flex-col gap-2.5">
                {JUST_PAID.map((p) => (
                  <div
                    key={p.name}
                    className="flex items-center justify-between gap-3 rounded-[10px] p-3"
                    style={{ background: "var(--zn-surface-2)", border: "1px solid var(--zn-line-soft)" }}
                  >
                    <div className="min-w-0">
                      <p className="text-[13.5px] font-semibold truncate" style={{ color: "var(--zn-ink)" }}>
                        {p.name}
                      </p>
                      <p className="text-[11.5px] mt-0.5" style={{ color: "var(--zn-ink-3)" }}>
                        {p.via}
                      </p>
                    </div>
                    <span className="text-[14px] font-semibold tabular-nums" style={{ color: "var(--zn-safe)" }}>
                      +{p.amount}
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[11.5px] flex items-center gap-1.5" style={{ color: "var(--zn-ink-3)" }}>
                <ArrowDown className="size-3" />
                Removed from today's queue. Tax estimate adjusted by +£886.
              </p>
            </section>

            {/* Books — secondary */}
            <section
              className="rounded-2xl p-5"
              style={{ background: "var(--zn-surface)", border: "1px solid var(--zn-line-soft)" }}
            >
              <div className="flex items-center justify-between mb-3">
                <p className="zn-label !p-0">Your numbers</p>
                <Link href="#" className="text-[11.5px] font-medium underline underline-offset-2" style={{ color: "var(--zn-ink-3)" }}>
                  Open books →
                </Link>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                {BOOKS_LINKS.map((b) => {
                  const Icon = b.icon;
                  return (
                    <Link
                      key={b.label}
                      href={b.href}
                      className="rounded-[10px] p-3 transition-colors hover:bg-[var(--zn-surface-2)]"
                      style={{ background: "var(--zn-bg-2)", border: "1px solid var(--zn-line-soft)" }}
                    >
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <Icon className="size-3.5" style={{ color: "var(--zn-ink-3)" }} />
                        <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--zn-ink-3)" }}>
                          {b.label}
                        </span>
                      </div>
                      <p className="text-[18px] font-semibold tabular-nums leading-none mb-1" style={{ color: "var(--zn-ink)" }}>
                        {b.value}
                      </p>
                      <p className="text-[10.5px] leading-tight" style={{ color: "var(--zn-ink-3)" }}>
                        {b.sub}
                      </p>
                    </Link>
                  );
                })}
              </div>
            </section>
          </div>

          {/* Comparison strip */}
          <section className="mt-10 mb-4">
            <p className="zn-label !p-0 mb-3">Why this is different</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <Compare
                title="FreeAgent, QuickBooks SE, Crunch"
                body="A red number on a dashboard. Recovery is your problem."
                tone="muted"
              />
              <Compare
                title="Chaser, Satago, Kolleno"
                body="Send chases on autopilot, but no books — you still need a separate ledger."
                tone="muted"
              />
              <Compare
                title="Zentra"
                body="Books that decide who to chase, draft the message, and update your tax estimate when the cash lands."
                tone="us"
              />
            </div>
          </section>

          {/* Tagline */}
          <p
            className="mt-6 text-[18px] italic text-center"
            style={{
              fontFamily: "var(--font-newsreader), ui-serif, Georgia, serif",
              color: "var(--zn-ink-2)",
            }}
          >
            “Books that catch the cash.”
          </p>
        </div>
      </div>
    </main>
  );
}

// ── Mini primitives (mockup-local) ───────────────────────────────────────────

function NavGroup({
  label, children, defaultOpen = false,
}: {
  label: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  return (
    <div className={defaultOpen ? "mb-3" : "mb-1"}>
      <p className="text-[10.5px] font-semibold uppercase tracking-wider px-2 mb-1.5" style={{ color: "var(--zn-ink-3)" }}>
        {label}
      </p>
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  );
}

function NavItem({
  icon: Icon, label, active, badge,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active?: boolean;
  badge?: string;
}) {
  return (
    <div
      className="flex items-center gap-2 rounded-[8px] px-2 py-1.5 text-[13px] font-medium cursor-default"
      style={{
        background: active ? "var(--zn-surface-2)" : "transparent",
        color: active ? "var(--zn-ink)" : "var(--zn-ink-2)",
      }}
    >
      <Icon className="size-4" style={{ color: active ? "var(--zn-ink)" : "var(--zn-ink-3)" }} />
      <span className="flex-1">{label}</span>
      {badge && (
        <span
          className="text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded-full"
          style={{ background: "var(--zn-accent)", color: "var(--zn-accent-ink)" }}
        >
          {badge}
        </span>
      )}
    </div>
  );
}

function Compare({ title, body, tone }: { title: string; body: string; tone: "us" | "muted" }) {
  const isUs = tone === "us";
  return (
    <div
      className="rounded-xl p-4"
      style={{
        background: isUs ? "var(--zn-ink)" : "var(--zn-surface)",
        color: isUs ? "var(--zn-surface)" : "var(--zn-ink)",
        border: isUs ? "1px solid var(--zn-ink)" : "1px solid var(--zn-line-soft)",
      }}
    >
      <p className="text-[12px] font-semibold uppercase tracking-wider mb-2" style={{ color: isUs ? "rgba(255,255,255,0.6)" : "var(--zn-ink-3)" }}>
        {title}
      </p>
      <p className="text-[13.5px] leading-[1.5]" style={{ color: isUs ? "var(--zn-surface)" : "var(--zn-ink-2)" }}>
        {body}
      </p>
      {isUs && (
        <p className="mt-2.5 flex items-center gap-1.5 text-[11.5px] font-medium" style={{ color: "rgba(255,255,255,0.7)" }}>
          <Clock className="size-3" />
          That's the wedge.
        </p>
      )}
    </div>
  );
}

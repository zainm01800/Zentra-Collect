"use client";

/**
 * src/components/demo-shell.tsx
 *
 * Standalone layout for the /demo section. No auth, no localStorage,
 * no connection to any real account. Signs-in users see exactly the
 * same thing as anyone else.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Briefcase,
  Building2,
  BarChart2,
  Car,
  FileText,
  LayoutDashboard,
  ListChecks,
  MoreHorizontal,
  PiggyBank,
  Receipt,
  RefreshCw,
  TrendingUp,
  Users,
  ArrowRight,
  FlaskConical,
  X,
} from "lucide-react";
import { DemoPlanPicker } from "@/components/demo-plan-picker";
import {
  getPlanInfo,
  planShowsHref,
  readDemoPlan,
  type DemoPlanId,
} from "@/lib/demo-plan";

const collectionsNav = [
  { href: "/demo",              label: "Dashboard",    icon: LayoutDashboard },
  { href: "/demo/chase-plan",   label: "Chase plan",   icon: ListChecks },
  { href: "/demo/aged-debt",    label: "Aged debt",    icon: BarChart2 },
  { href: "/demo/customers",    label: "Customers",    icon: Users },
  { href: "/demo/quotes",       label: "Quotes",       icon: FileText },
  { href: "/demo/credit-notes", label: "Credit notes", icon: Receipt },
  { href: "/demo/reports",      label: "Reports",      icon: TrendingUp },
  { href: "/demo/portfolio",    label: "Portfolio",    icon: Briefcase },
];

const booksNav = [
  { href: "/demo/banking",  label: "Bank feed",  icon: Building2 },
  { href: "/demo/expenses", label: "Expenses",   icon: Receipt },
  { href: "/demo/mileage",  label: "Mileage",    icon: Car },
  { href: "/demo/pl",       label: "P&L",        icon: TrendingUp },
  { href: "/demo/tax",      label: "Tax & VAT",  icon: PiggyBank },
];

// Primary bottom nav tabs (shown as icons in the fixed bar on mobile)
const PRIMARY_NAV_HREFS = [
  "/demo",
  "/demo/chase-plan",
  "/demo/aged-debt",
  "/demo/expenses",
];

export function DemoShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/demo";

  const [planId, setPlanId] = useState<DemoPlanId | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    setPlanId(readDemoPlan());
    function onChange(e: Event) {
      setPlanId(((e as CustomEvent<DemoPlanId | null>).detail) ?? null);
    }
    window.addEventListener("zentra:demo-plan-change", onChange);
    return () => window.removeEventListener("zentra:demo-plan-change", onChange);
  }, []);

  // Close More drawer when route changes
  useEffect(() => { setMoreOpen(false); }, [pathname]);

  const planInfo = planId ? getPlanInfo(planId) : null;
  const visibleCollections = collectionsNav.filter((i) => planShowsHref(planId, i.href));
  const visibleBooks       = booksNav.filter((i) => planShowsHref(planId, i.href));
  const allTabs = [...visibleCollections, ...visibleBooks];

  // Bottom nav: up to 4 primary tabs that are visible for this plan, + More
  const primaryTabs = allTabs.filter((t) => PRIMARY_NAV_HREFS.includes(t.href));
  const moreTabs    = allTabs.filter((t) => !PRIMARY_NAV_HREFS.includes(t.href));

  return (
    <div
      className="flex min-h-screen"
      style={{ background: "var(--zn-bg)", color: "var(--zn-ink)" }}
    >
      {/* ── Sidebar ──────────────────────────────────────────────────────────── */}
      <aside
        className="hidden md:flex flex-col w-[210px] shrink-0 border-r"
        style={{ borderColor: "var(--zn-line-soft)", background: "var(--zn-bg-2)" }}
      >
        {/* Brand */}
        <div className="px-4 pt-5 pb-4 flex items-center gap-2.5">
          <span className="zn-brand-mark">Z</span>
          <span className="flex flex-col leading-[1.1]">
            <span className="text-[13.5px] font-semibold tracking-[-0.01em]">Zentra</span>
            <span className="zn-section-label !p-0 !mt-0.5">Collect</span>
          </span>
        </div>

        {/* Demo badge + plan switcher */}
        <div className="mx-3 mb-4 space-y-1.5">
          <div
            className="flex items-center gap-1.5 rounded-[8px] px-2.5 py-1.5"
            style={{ background: "var(--zn-warn-soft)", border: "1px solid var(--zn-warn)22" }}
          >
            <FlaskConical className="size-3 shrink-0" style={{ color: "var(--zn-warn)" }} />
            <span className="text-[11px] font-semibold" style={{ color: "var(--zn-warn)" }}>
              Demo · {planInfo?.label ?? "Choose plan"}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="w-full flex items-center justify-center gap-1 text-[10.5px] py-1 rounded-md hover:bg-black/5 transition-colors"
            style={{ color: "var(--zn-ink-3)" }}
          >
            <RefreshCw className="size-2.5" />
            Switch plan
          </button>
        </div>

        {/* Nav — split into Collections + Books so the demo mirrors the
            two-segment positioning of the real product (chasing-led for
            agencies and bookkeepers, books-led for sole traders). */}
        <nav className="flex-1 px-2 space-y-3 overflow-y-auto">
          {visibleCollections.length > 0 && (
            <NavSection items={visibleCollections} pathname={pathname} label="Collections" />
          )}
          {visibleBooks.length > 0 && (
            <NavSection items={visibleBooks} pathname={pathname} label="Books" />
          )}
        </nav>

        {/* Footer CTA */}
        <div className="p-3 border-t" style={{ borderColor: "var(--zn-line-soft)" }}>
          <p className="text-[11px] leading-relaxed mb-2.5" style={{ color: "var(--zn-ink-3)" }}>
            Sample data only. Sign up to import your own invoices.
          </p>
          <Link
            href="/login?mode=signup"
            className="zn-pill w-full justify-center text-[12px]"
            style={{ height: 32 }}
          >
            Start free trial <ArrowRight className="size-3" />
          </Link>
          <Link
            href="/login?mode=signin"
            className="mt-1.5 flex w-full items-center justify-center text-[11.5px] py-1 transition-colors hover:underline"
            style={{ color: "var(--zn-ink-3)" }}
          >
            Sign in
          </Link>
        </div>
      </aside>

      {/* ── Main ─────────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile header */}
        <header
          className="md:hidden flex items-center justify-between px-4 py-3 border-b"
          style={{ borderColor: "var(--zn-line-soft)", background: "var(--zn-bg-2)" }}
        >
          <div className="flex items-center gap-2">
            <span className="zn-brand-mark !size-7 !text-[14px]">Z</span>
            <span className="text-[13.5px] font-semibold">Zentra Collect</span>
            <span
              className="ml-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
              style={{ background: "var(--zn-warn-soft)", color: "var(--zn-warn)" }}
            >
              Demo
            </span>
          </div>
          <Link href="/login?mode=signup" className="zn-pill text-[12px]" style={{ height: 30 }}>
            Sign up free
          </Link>
        </header>

        <div className="flex flex-col flex-1 min-h-0">
          {/* Demo notice strip */}
          <div
            className="flex items-center justify-between gap-3 px-5 py-2 border-b text-[12px]"
            style={{
              borderColor: "var(--zn-line-soft)",
              background: "var(--zn-warn-soft)",
              color: "var(--zn-warn)",
            }}
          >
            <span className="font-medium">
              Sample data — no real invoices, no account required. Changes reset on refresh.
            </span>
            <Link
              href="/login?mode=signup"
              className="shrink-0 font-semibold underline underline-offset-2 hover:no-underline"
            >
              Start your free trial →
            </Link>
          </div>

          {/* Page content — extra bottom padding on mobile for fixed nav bar */}
          <main className="flex-1 px-5 py-6 lg:px-8 lg:py-7 max-w-[1200px] w-full mx-auto pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-6">
            {children}
          </main>
        </div>
      </div>

      {/* ── Mobile bottom nav bar (hidden on md+) ────────────────────────────── */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-40 flex items-stretch border-t"
        style={{
          background: "var(--zn-bg-2)",
          borderColor: "var(--zn-line-soft)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        {primaryTabs.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className="relative flex-1 flex flex-col items-center justify-center gap-1 py-2 transition-colors"
              style={{ color: active ? "var(--zn-accent)" : "var(--zn-ink-3)" }}
            >
              {/* Active indicator bar at top */}
              {active && (
                <span
                  className="absolute top-0 left-1/2 -translate-x-1/2 rounded-b-full"
                  style={{ height: 2, width: 24, background: "var(--zn-accent)" }}
                />
              )}
              <Icon className="size-5 shrink-0" />
              <span className="text-[10px] font-medium leading-none">{label}</span>
            </Link>
          );
        })}

        {/* More tab */}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className="flex-1 flex flex-col items-center justify-center gap-1 py-2 transition-colors"
          style={{ color: moreOpen ? "var(--zn-accent)" : "var(--zn-ink-3)" }}
        >
          <MoreHorizontal className="size-5 shrink-0" />
          <span className="text-[10px] font-medium leading-none">More</span>
        </button>
      </nav>

      {/* ── More drawer ───────────────────────────────────────────────────────── */}
      {moreOpen && (
        <>
          {/* Backdrop */}
          <div
            className="md:hidden fixed inset-0 z-40 bg-black/40"
            onClick={() => setMoreOpen(false)}
          />
          {/* Sheet */}
          <div
            className="md:hidden fixed bottom-0 inset-x-0 z-50 rounded-t-2xl border-t pb-[env(safe-area-inset-bottom)]"
            style={{
              background: "var(--zn-bg-2)",
              borderColor: "var(--zn-line-soft)",
              animation: "slideUp 220ms cubic-bezier(0.32,0.72,0,1)",
            }}
          >
            {/* Handle + header */}
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
              <span className="text-[13px] font-semibold" style={{ color: "var(--zn-ink)" }}>
                More
              </span>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                className="p-1 rounded-full"
                style={{ color: "var(--zn-ink-3)" }}
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Nav items */}
            <div className="px-3 pb-3 space-y-0.5">
              {moreTabs.map(({ href, label, icon: Icon }) => {
                const active = pathname === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    className="flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-[14px] font-medium transition-colors"
                    style={{
                      background: active ? "var(--zn-surface)" : "transparent",
                      color: active ? "var(--zn-ink)" : "var(--zn-ink-3)",
                    }}
                  >
                    <Icon className="size-4 shrink-0" />
                    {label}
                  </Link>
                );
              })}
            </div>

            {/* Plan switcher + CTA */}
            <div className="mx-3 mb-3 pt-3 border-t space-y-2" style={{ borderColor: "var(--zn-line-soft)" }}>
              <div
                className="flex items-center gap-2 rounded-[8px] px-3 py-2"
                style={{ background: "var(--zn-warn-soft)" }}
              >
                <FlaskConical className="size-3.5 shrink-0" style={{ color: "var(--zn-warn)" }} />
                <span className="text-[12px] font-semibold" style={{ color: "var(--zn-warn)" }}>
                  Demo · {planInfo?.label ?? "Choose plan"}
                </span>
                <button
                  type="button"
                  onClick={() => { setMoreOpen(false); setPickerOpen(true); }}
                  className="ml-auto text-[11px] underline underline-offset-2"
                  style={{ color: "var(--zn-warn)" }}
                >
                  Switch
                </button>
              </div>
              <Link
                href="/login?mode=signup"
                className="zn-pill w-full justify-center text-[13px]"
                style={{ height: 36 }}
              >
                Start free trial <ArrowRight className="size-3.5" />
              </Link>
            </div>
          </div>
        </>
      )}

      {/* First-visit plan picker (or re-opened via "Switch plan") */}
      <DemoPlanPicker forceOpen={pickerOpen} onClose={() => setPickerOpen(false)} />
    </div>
  );
}

function NavSection({
  items, pathname, label,
}: {
  items: { href: string; label: string; icon: React.ComponentType<{ className?: string }> }[];
  pathname: string;
  label: string;
}) {
  return (
    <div>
      <p className="zn-section-label px-3 mb-1">{label}</p>
      <div className="space-y-0.5">
        {items.map(({ href, label: itemLabel, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-2.5 rounded-[9px] px-3 py-2 text-[13px] font-medium transition-colors"
              style={{
                background: active ? "var(--zn-surface)" : "transparent",
                color: active ? "var(--zn-ink)" : "var(--zn-ink-3)",
                fontWeight: active ? 600 : 500,
              }}
            >
              <Icon className="size-4 shrink-0" />
              {itemLabel}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

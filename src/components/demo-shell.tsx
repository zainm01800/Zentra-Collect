"use client";

/**
 * src/components/demo-shell.tsx
 *
 * Standalone layout for the /demo section. No auth, no localStorage,
 * no connection to any real account. Signs-in users see exactly the
 * same thing as anyone else.
 */

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Briefcase,
  Building2,
  BarChart2,
  Car,
  Calculator,
  FileText,
  LayoutDashboard,
  ListChecks,
  PiggyBank,
  Receipt,
  RefreshCw,
  TrendingUp,
  Users,
  ArrowRight,
  FlaskConical,
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

export function DemoShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/demo";
  const router = useRouter();

  // Track the selected demo plan so the sidebar / mobile nav can hide
  // items that wouldn't be on that plan in the real product.
  const [planId, setPlanId] = useState<DemoPlanId | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    setPlanId(readDemoPlan());
    function onChange(e: Event) {
      setPlanId(((e as CustomEvent<DemoPlanId | null>).detail) ?? null);
    }
    window.addEventListener("zentra:demo-plan-change", onChange);
    return () => window.removeEventListener("zentra:demo-plan-change", onChange);
  }, []);

  const planInfo = planId ? getPlanInfo(planId) : null;
  const visibleCollections = collectionsNav.filter((i) => planShowsHref(planId, i.href));
  const visibleBooks       = booksNav.filter((i) => planShowsHref(planId, i.href));
  const allTabs = [...visibleCollections, ...visibleBooks];
  const currentTabIndex = allTabs.findIndex((t) => t.href === pathname);

  // All mutable swipe state in one ref — handlers registered once ([] deps)
  // always read the latest values without re-registering listeners.
  const swipeRef = useRef({ allTabs, currentTabIndex, router, navigating: false });
  swipeRef.current.allTabs = allTabs;
  swipeRef.current.currentTabIndex = currentTabIndex;
  swipeRef.current.router = router;

  // Release nav lock whenever the route settles (covers both VT and fallback).
  useEffect(() => { swipeRef.current.navigating = false; }, [pathname]);

  useEffect(() => {
    let startX = 0;
    let startY = 0;

    function onStart(e: TouchEvent) {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    }

    function onEnd(e: TouchEvent) {
      if (swipeRef.current.navigating) return;
      const dx = e.changedTouches[0].clientX - startX;
      const dy = e.changedTouches[0].clientY - startY;
      if (Math.abs(dy) > Math.abs(dx)) return;
      if (Math.abs(dx) < 60) return;

      const { allTabs: tabs, currentTabIndex: idx, router: r } = swipeRef.current;
      let href = "";
      if      (dx < 0 && idx < tabs.length - 1) { href = tabs[idx + 1].href; document.documentElement.dataset.swipeDir = "left";  }
      else if (dx > 0 && idx > 0)               { href = tabs[idx - 1].href; document.documentElement.dataset.swipeDir = "right"; }
      else return;

      swipeRef.current.navigating = true;

      const cleanup = () => { delete document.documentElement.dataset.swipeDir; };

      // View Transitions API: browser snapshots the current page, lets React
      // render the new page, then animates between the two — no flash, no blank
      // frame, both old and new content visible simultaneously during transition.
      const vt = (document as Document & {
        startViewTransition?: (cb: () => void) => { finished: Promise<void> };
      }).startViewTransition;

      if (vt) {
        vt.call(document, () => r.push(href)).finished.finally(cleanup);
      } else {
        r.push(href);
        setTimeout(cleanup, 400);
      }
    }

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchend",   onEnd,   { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchend",   onEnd);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

        {/* Mobile scrollable nav strip */}
        <nav
          className="md:hidden flex gap-1 px-3 py-2 border-b overflow-x-auto"
          style={{ borderColor: "var(--zn-line-soft)" }}
        >
          {allTabs.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-1.5 rounded-[8px] px-3 py-1.5 text-[12px] font-medium whitespace-nowrap transition-colors"
                style={{
                  background: active ? "var(--zn-surface)" : "transparent",
                  color: active ? "var(--zn-ink)" : "var(--zn-ink-3)",
                }}
              >
                <Icon className="size-3.5" />
                {label}
              </Link>
            );
          })}
        </nav>

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

          {/* Page content */}
          <main className="flex-1 px-5 py-6 lg:px-8 lg:py-7 max-w-[1200px] w-full mx-auto">
            {children}
          </main>
        </div>
      </div>

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

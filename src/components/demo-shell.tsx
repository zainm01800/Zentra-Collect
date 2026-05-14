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
import {
  LayoutDashboard,
  ListChecks,
  Users,
  ArrowRight,
  FlaskConical,
} from "lucide-react";

const navItems = [
  { href: "/demo",            label: "Dashboard",  icon: LayoutDashboard },
  { href: "/demo/chase-plan", label: "Chase plan", icon: ListChecks },
  { href: "/demo/customers",  label: "Customers",  icon: Users },
];

export function DemoShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/demo";

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
            <span className="zn-section-label !p-0 !mt-0.5">Flow</span>
          </span>
        </div>

        {/* Demo badge */}
        <div className="mx-3 mb-4">
          <div
            className="flex items-center gap-1.5 rounded-[8px] px-2.5 py-1.5"
            style={{ background: "var(--zn-warn-soft)", border: "1px solid var(--zn-warn)22" }}
          >
            <FlaskConical className="size-3 shrink-0" style={{ color: "var(--zn-warn)" }} />
            <span className="text-[11px] font-semibold" style={{ color: "var(--zn-warn)" }}>
              Demo workspace
            </span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 space-y-0.5">
          {navItems.map(({ href, label, icon: Icon }) => {
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
                {label}
              </Link>
            );
          })}
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
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header
          className="md:hidden flex items-center justify-between px-4 py-3 border-b"
          style={{ borderColor: "var(--zn-line-soft)", background: "var(--zn-bg-2)" }}
        >
          <div className="flex items-center gap-2">
            <span className="zn-brand-mark !size-7 !text-[14px]">Z</span>
            <span className="text-[13.5px] font-semibold">Zentra Flow</span>
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

        {/* Mobile nav strip */}
        <nav
          className="md:hidden flex gap-1 px-3 py-2 border-b overflow-x-auto"
          style={{ borderColor: "var(--zn-line-soft)" }}
        >
          {navItems.map(({ href, label, icon: Icon }) => {
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
  );
}

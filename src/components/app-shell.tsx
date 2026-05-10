"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  AlertTriangle,
  ArrowUpFromLine,
  BarChart3,
  CreditCard,
  FileText,
  HelpCircle,
  LayoutDashboard,
  Menu,
  ShieldAlert,
  Settings,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ReviewProvider, useReview } from "@/components/review-context";
import { ReviewDrawer } from "@/components/review-drawer";
import { TrialStatusBanner } from "@/components/trial-banners";
import { QueueStatusBar } from "@/components/queue-status-bar";
import { AutoSendToggle } from "@/components/auto-send-toggle";
import { AutoSendArmingBanner } from "@/components/auto-send-arming-banner";
import { AccountSync } from "@/components/account-sync";
import { useLocalAccount } from "@/lib/billing/use-local-account";
import { toAccountState } from "@/lib/account/access";
import { demoCashpilotInvoices as demoInvoices } from "@/lib/demo-data/zentra-demo-data";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const workspaceNav: NavItem[] = [
  { href: "/dashboard",   label: "Dashboard",   icon: LayoutDashboard },
  { href: "/chase-today", label: "Collections", icon: CreditCard },
  { href: "/import",      label: "Import",      icon: ArrowUpFromLine },
  { href: "/portfolio",   label: "Portfolio",   icon: Wallet },
  { href: "/digest",      label: "Digest",      icon: FileText },
];

const contextNav: NavItem[] = [
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/promises",  label: "Promises",  icon: AlertTriangle },
  { href: "/disputes",  label: "Disputes",  icon: ShieldAlert },
  { href: "/reports",   label: "Reports",   icon: BarChart3 },
];

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      className={cn("zn-nav-item", active && "active")}
    >
      <item.icon className="zn-nav-icon size-4" />
      <span>{item.label}</span>
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <ReviewProvider>
      <AppShellInner>{children}</AppShellInner>
    </ReviewProvider>
  );
}

function AppShellInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");
  const { isOpen: reviewOpen, close: closeReview } = useReview();
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <div className="grid min-h-screen relative z-[1] md:grid-cols-[232px_1fr]">

      {/* ── Sidebar ── */}
      <aside
        className="hidden md:flex md:flex-col sticky top-0 h-screen z-40 border-r"
        style={{
          background: "var(--zn-bg-2)",
          borderColor: "var(--zn-line)",
          padding: "20px 14px",
        }}
      >
        {/* Brand */}
        <Link
          href="/dashboard"
          className="flex items-center gap-3 mb-[22px] px-1.5"
        >
          <span className="zn-brand-mark">Z</span>
          <span className="flex flex-col leading-[1.1]">
            <span className="text-[14px] font-semibold tracking-[-0.01em] text-[#1d1813]">Zentra</span>
            <span className="zn-section-label !p-0 !mt-0.5">Collect</span>
          </span>
        </Link>

        {/* Workspace */}
        <div className="zn-section-label">Workspace</div>
        <div className="flex flex-col gap-1 mb-[14px]">
          {workspaceNav.map((item) => (
            <NavLink key={item.href} item={item} active={isActive(item.href)} />
          ))}
        </div>

        {/* Context */}
        <div className="zn-section-label">Context</div>
        <div className="flex flex-col gap-1">
          {contextNav.map((item) => (
            <NavLink key={item.href} item={item} active={isActive(item.href)} />
          ))}
        </div>

        <div className="flex-1" />

        {/* Bottom: settings, help, demo badge */}
        <div
          className="flex flex-col gap-1 pt-[14px] border-t"
          style={{ borderColor: "var(--zn-line-soft)" }}
        >
          <NavLink
            item={{ href: "/settings", label: "Settings", icon: Settings }}
            active={isActive("/settings")}
          />
          <NavLink
            item={{ href: "/help", label: "Help & support", icon: HelpCircle }}
            active={isActive("/help")}
          />

          {/* Auto-send toggle */}
          <AutoSendToggleInSidebar />

          {/* Outcomes counter — small reward loop for working the queue */}
          <SessionCounter />

          {/* Account badge — adapts per plan: demo / trial / paid */}
          <SidebarAccountBadge />
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="flex flex-col min-w-0">

        {/* Mobile top bar (sm only) */}
        <header
          className="md:hidden sticky top-0 z-40 flex items-center justify-between border-b backdrop-blur px-4 py-3"
          style={{
            background: "rgba(233,223,201,0.95)",
            borderColor: "var(--zn-line)",
          }}
        >
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <span className="zn-brand-mark" style={{ width: 28, height: 28, fontSize: 16 }}>Z</span>
            <span className="text-[13px] font-semibold text-[#1d1813]">Zentra Collect</span>
          </Link>
          <MobileAccountPill />
        </header>

        {/* Mobile bottom nav — first 4 items + a real "More" sheet trigger */}
        <nav
          className="md:hidden fixed bottom-0 inset-x-0 z-40 flex border-t backdrop-blur"
          style={{
            background: "rgba(250,245,232,0.95)",
            borderColor: "var(--zn-line)",
            paddingBottom: "env(safe-area-inset-bottom)",
          }}
        >
          {workspaceNav.slice(0, 4).map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors",
                  active ? "text-[#b8481f]" : "text-[#8d8472]"
                )}
              >
                <item.icon className="size-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors",
              moreOpen ? "text-[#b8481f]" : "text-[#8d8472]"
            )}
          >
            <Menu className="size-5" />
            <span>More</span>
          </button>
        </nav>

        {/* Mobile "More" sheet */}
        {moreOpen ? (
          <>
            <button
              type="button"
              onClick={() => setMoreOpen(false)}
              aria-label="Close menu"
              className="md:hidden fixed inset-0 z-50 backdrop-blur-[2px]"
              style={{ background: "rgba(29,24,19,0.32)", animation: "fadeIn 200ms ease" }}
            />
            <div
              className="md:hidden fixed bottom-0 inset-x-0 z-[60] rounded-t-[18px]"
              style={{
                background: "var(--zn-surface)",
                borderTop: "1px solid var(--zn-line)",
                paddingBottom: "env(safe-area-inset-bottom)",
                animation: "slideUp 240ms cubic-bezier(0.32, 0.72, 0, 1)",
              }}
            >
              <div className="flex items-center justify-between px-5 pt-4 pb-2">
                <div className="zn-label !p-0">More</div>
                <button
                  type="button"
                  onClick={() => setMoreOpen(false)}
                  className="size-8 inline-flex items-center justify-center rounded-md"
                  style={{ color: "var(--zn-ink-3)" }}
                  aria-label="Close menu"
                >
                  <X className="size-4" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 px-4 pb-4">
                {[...contextNav,
                  { href: "/settings", label: "Settings", icon: Settings },
                  { href: "/help",     label: "Help & support", icon: HelpCircle }
                ].map((item) => {
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMoreOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-[10px] px-3 py-3 text-[13px] font-medium transition-colors",
                        active
                          ? "bg-[#f0d3c2] text-[#b8481f]"
                          : "bg-[#f3ecd8] text-[#3d3428]"
                      )}
                    >
                      <item.icon className={cn("size-4", active ? "text-[#b8481f]" : "text-[#6b6253]")} />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          </>
        ) : null}

        {/* Syncs Supabase session → localStorage once per mount */}
        <AccountSync />

        {/* Arming banner — full width, above content */}
        <AutoSendArmingBanner />

        {/* Page content — drawer always overlays, no shift needed */}
        <main className="flex-1 px-4 sm:px-6 lg:px-8 pt-6 lg:pt-8 pb-24 md:pb-8">
          <div className="mx-auto w-full max-w-[1360px]">
            <TrialStatusBanner />
            <QueueStatusBar />
            {children}
          </div>
        </main>
      </div>

      {/* Backdrop — drawer always overlays */}
      {reviewOpen ? (
        <button
          type="button"
          onClick={closeReview}
          aria-label="Close review"
          className="fixed inset-0 z-20 backdrop-blur-[2px]"
          style={{
            background: "rgba(29,24,19,0.32)",
            animation: "fadeIn 200ms ease",
          }}
        />
      ) : null}

      {/* Review drawer (fixed-position, overlays page) */}
      <ReviewDrawer allInvoices={demoInvoices} />
    </div>
  );
}

/**
 * Quiet session counter — shows how many outcomes the user has logged in this
 * browser session. Small dopamine loop for working the queue.
 */
function SessionCounter() {
  const { outcomesLogged } = useReview();
  if (outcomesLogged === 0) return null;
  return (
    <div
      className="mt-1 flex items-center gap-2 px-3 py-2 rounded-lg"
      style={{
        background: "var(--zn-surface)",
        border: "1px solid var(--zn-line-soft)",
      }}
    >
      <span
        className="zn-pulse"
        style={{ width: 6, height: 6, background: "var(--zn-accent)" }}
      />
      <span className="text-[11.5px] font-medium" style={{ color: "var(--zn-ink-2)" }}>
        {outcomesLogged} outcome{outcomesLogged === 1 ? "" : "s"} logged today
      </span>
    </div>
  );
}

/**
 * Quick state derived from the locally-stored account.
 *  - demo: warm warning tones, "DEMO · Sample data only"
 *  - trial: warm warning tones, "TRIAL · X days left" (or "expired" if past)
 *  - paid: subtle, shows user name + business
 *  - no account: hidden
 */
function useAccountBadgeState() {
  const { user } = useLocalAccount();
  if (!user) return null;
  const planId = user.planId;
  if (planId === "demo") {
    return {
      kind: "demo" as const,
      mark: "DEMO",
      title: "Demo workspace",
      sub: "Sample data only",
      tone: "warn" as const,
    };
  }
  if (planId === "trial") {
    const ends = user.trialEndsAt ? new Date(user.trialEndsAt).getTime() : 0;
    const daysLeft = Math.max(0, Math.ceil((ends - Date.now()) / 86_400_000));
    return {
      kind: "trial" as const,
      mark: "TRIAL",
      title: user.businessName || "Trial workspace",
      sub: daysLeft > 0
        ? `${daysLeft} day${daysLeft === 1 ? "" : "s"} left`
        : "Trial ended",
      tone: daysLeft > 3 ? ("warn" as const) : ("risk" as const),
    };
  }
  // Paid plan — show user info subtly
  const initials = (user.name || user.email || "U")
    .split(/\s+/).slice(0, 2).map(p => p[0]).join("").toUpperCase();
  return {
    kind: "paid" as const,
    mark: initials,
    title: user.name || "Account",
    sub: user.businessName || user.email,
    tone: "ink" as const,
  };
}

function SidebarAccountBadge() {
  const state = useAccountBadgeState();
  if (!state) return null;
  const palette =
    state.tone === "warn" ? { bg: "var(--zn-warn-soft)", fg: "var(--zn-warn)", markBg: "var(--zn-warn)" } :
    state.tone === "risk" ? { bg: "var(--zn-risk-soft)", fg: "var(--zn-risk)", markBg: "var(--zn-risk)" } :
                            { bg: "var(--zn-surface)",   fg: "var(--zn-ink)",  markBg: "var(--zn-ink)"  };
  return (
    <div
      className="flex items-center gap-3 mt-2 rounded-lg px-2.5 py-2"
      style={{
        background: palette.bg,
        border: `1px solid ${state.tone === "ink" ? "var(--zn-line-soft)" : palette.bg}`,
      }}
    >
      <span
        className="size-7 rounded-md inline-flex items-center justify-center text-[10px] font-bold tracking-[0.06em] flex-shrink-0"
        style={{
          background: palette.markBg,
          color: "var(--zn-surface)",
          fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
        }}
      >
        {state.mark}
      </span>
      <span className="flex flex-col leading-[1.2] min-w-0">
        <span
          className="text-[12px] font-semibold truncate"
          style={{ color: palette.fg }}
        >
          {state.title}
        </span>
        <span
          className="text-[10.5px] truncate"
          style={{ color: palette.fg, opacity: state.tone === "ink" ? 0.65 : 1 }}
        >
          {state.sub}
        </span>
      </span>
    </div>
  );
}

/**
 * Reads local account and passes the central PlanId to AutoSendToggle.
 */
function AutoSendToggleInSidebar() {
  const { user } = useLocalAccount();
  const isDemoMode = user?.planId === "demo";

  let centralPlanId: Parameters<typeof AutoSendToggle>[0]["planId"] | undefined;
  if (user) {
    try {
      centralPlanId = toAccountState(user as Parameters<typeof toAccountState>[0]).planId;
    } catch {
      centralPlanId = undefined;
    }
  }

  return (
    <AutoSendToggle
      planId={centralPlanId}
      isDemoMode={isDemoMode}
      hasEmailAddon={user?.emailAddon === true}
    />
  );
}

/**
 * Tiny pill version of the badge for the mobile top bar.
 * Hidden for paid accounts (no need for a status badge there).
 */
function MobileAccountPill() {
  const state = useAccountBadgeState();
  if (!state || state.kind === "paid") return null;
  const bg = state.tone === "risk" ? "var(--zn-risk)" : "var(--zn-warn)";
  return (
    <span
      className="text-[10px] font-bold tracking-[0.08em] px-2 py-1 rounded-md"
      style={{
        background: bg,
        color: "var(--zn-surface)",
        fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
      }}
    >
      {state.mark}
    </span>
  );
}

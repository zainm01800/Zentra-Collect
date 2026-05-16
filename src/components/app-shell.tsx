"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowUpFromLine,
  BarChart3,
  Building2,
  CalendarClock,
  Calculator,
  ChevronRight,
  CreditCard,
  FileText,
  Home,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  Menu,
  PiggyBank,
  Plug,
  Plus,
  Receipt,
  ShieldAlert,
  Settings,
  TableProperties,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ReviewProvider, useReview } from "@/components/review-context";
import { ReviewDrawer } from "@/components/review-drawer";
import { PushPermission } from "@/components/push-permission";
import { TrialStatusBanner } from "@/components/trial-banners";
import { QueueStatusBar } from "@/components/queue-status-bar";
import { InstallPrompt } from "@/components/install-prompt";
import { AutoSendToggle } from "@/components/auto-send-toggle";
import { AutoSendArmingBanner } from "@/components/auto-send-arming-banner";
import { AccountSync } from "@/components/account-sync";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { useLocalAccount } from "@/lib/billing/use-local-account";
import { toAccountState } from "@/lib/account/access";
import { readWorkspacePrefs, type WorkspacePrefs } from "@/lib/prefs";
import { MODULES, type ModuleKey } from "@/lib/modules";
import { readLocalAccount, demoUserStorageKey } from "@/lib/demo-auth";
import { createSupabaseBrowserClient, hasSupabaseBrowserConfig } from "@/lib/supabase/browser";
import { demoCashpilotInvoices as demoInvoices } from "@/lib/demo-data/zentra-demo-data";
import { importedInvoicesStorageKey } from "@/lib/import/zentra-import";
import type { Invoice } from "@/types/cashpilot";

const demoInvoiceStateStorageKey = "zentra.demoInvoiceState.v1";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** If true: renders as a dimmed non-clickable "coming soon" item instead of a Link. */
  comingSoon?: boolean;
};

const overviewNav: NavItem[] = [
  { href: "/dashboard", label: "Dashboard",     icon: LayoutDashboard },
  { href: "/portfolio", label: "Portfolio",     icon: Wallet },
  { href: "/digest",    label: "Weekly digest", icon: FileText },
];

const collectionsNav: NavItem[] = [
  { href: "/import",                 label: "Import invoices", icon: ArrowUpFromLine },
  { href: "/settings/integrations",  label: "Integrations",    icon: Plug },
  { href: "/chase-today",            label: "Chase plan",      icon: CreditCard },
  { href: "/customers",              label: "Customers",       icon: Users },
  { href: "/promises",               label: "Promises",        icon: AlertTriangle },
  { href: "/disputes",               label: "Disputes",        icon: ShieldAlert },
  { href: "/tools",                  label: "Tools",           icon: Calculator },
  { href: "/reports",                label: "Reports",         icon: BarChart3 },
];

const financeNav: NavItem[] = [
  { href: "/banking",    label: "Bank feed",    icon: Building2 },
  { href: "/expenses",   label: "Expenses",     icon: Receipt },
  { href: "/tax",        label: "Tax reserve",  icon: PiggyBank },
  { href: "/mtd",        label: "MTD",          icon: CalendarClock },
  { href: "/aged-debt",  label: "Aged debt",    icon: TableProperties },
];

/**
 * The four fixed tabs shown in the mobile bottom navigation bar.
 * Kept deliberately small — secondary pages are reachable from desktop
 * or via Settings on mobile.
 */
const mobileBottomNav: NavItem[] = [
  { href: "/dashboard",  label: "Home",       icon: Home        },
  { href: "/chase-today",label: "Chase plan", icon: CreditCard  },
  { href: "/customers",  label: "Customers",  icon: Users       },
  { href: "/settings",   label: "Settings",   icon: Settings    },
];

// ── Nav hidden-items helpers ──────────────────────────────────────────────────

const NAV_HIDDEN_KEY = "zentra.navHidden.v1";

// Dashboard is always visible — everything else can be hidden
const ALWAYS_VISIBLE = new Set(["/dashboard"]);

function readHiddenHrefs(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const s = window.localStorage.getItem(NAV_HIDDEN_KEY);
    return s ? new Set(JSON.parse(s) as string[]) : new Set();
  } catch { return new Set(); }
}

function writeHiddenHrefs(hidden: Set<string>) {
  try { window.localStorage.setItem(NAV_HIDDEN_KEY, JSON.stringify([...hidden])); } catch {}
}

// ── Nav collapse helpers ──────────────────────────────────────────────────────

const COLLAPSE_KEY = "zentra.navCollapse.v1";

function readCollapse(): Record<string, boolean> {
  if (typeof window === "undefined") return { finance: true };
  try {
    const s = window.localStorage.getItem(COLLAPSE_KEY);
    return s ? JSON.parse(s) : { finance: true };
  } catch { return { finance: true }; }
}

function writeCollapse(state: Record<string, boolean>) {
  try { window.localStorage.setItem(COLLAPSE_KEY, JSON.stringify(state)); } catch {}
}

// ── NavLink ───────────────────────────────────────────────────────────────────

function NavLink({ item, active, badge, onHide }: { item: NavItem; active: boolean; badge?: number; onHide?: () => void }) {
  if (item.comingSoon) {
    return (
      <div
        className="flex items-center gap-2 px-1.5 py-1.5 rounded-lg select-none"
        style={{ opacity: 0.45, cursor: "default" }}
        title={`${item.label} — coming soon`}
      >
        <item.icon className="zn-nav-icon size-4 flex-shrink-0" />
        <span className="flex-1 truncate text-[13px]" style={{ color: "var(--zn-ink-2)" }}>{item.label}</span>
        <span
          className="text-[9px] font-semibold tracking-[0.06em] px-1.5 py-0.5 rounded-full"
          style={{ background: "var(--zn-line)", color: "var(--zn-ink-3)" }}
        >
          SOON
        </span>
      </div>
    );
  }

  return (
    <div className="group/navitem flex items-center gap-0.5">
      <Link
        href={item.href}
        className={cn("zn-nav-item flex-1 min-w-0", active && "active")}
      >
        <item.icon className="zn-nav-icon size-4" />
        <span className="flex-1 truncate">{item.label}</span>
        {badge != null && badge > 0 && (
          <span
            className="text-[10px] font-bold min-w-[17px] h-[17px] rounded-full flex items-center justify-center px-1 tabular-nums"
            style={{ background: "var(--zn-accent)", color: "var(--zn-accent-ink)" }}
          >
            {badge}
          </span>
        )}
      </Link>
      {onHide && (
        <button
          type="button"
          onClick={onHide}
          title={`Hide ${item.label}`}
          className="opacity-0 group-hover/navitem:opacity-100 transition-opacity flex-shrink-0 size-5 rounded flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/5"
          style={{ color: "var(--zn-ink-3)" }}
        >
          <X className="size-3" />
        </button>
      )}
    </div>
  );
}

// ── CollapsibleSection ────────────────────────────────────────────────────────

function CollapsibleSection({
  label,
  sectionKey,
  items,
  collapse,
  onToggle,
  isActive,
  badges,
  onHide,
  className,
}: {
  label: string;
  sectionKey: string;
  items: NavItem[];
  collapse: Record<string, boolean>;
  onToggle: (key: string) => void;
  isActive: (href: string) => boolean;
  badges?: Partial<Record<string, number>>;
  onHide?: (href: string) => void;
  className?: string;
}) {
  // Never collapse a section that contains the current page
  const hasActive = items.some((i) => isActive(i.href));
  const isCollapsed = !hasActive && (collapse[sectionKey] ?? false);

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => onToggle(sectionKey)}
        className="zn-section-label w-full flex items-center justify-between group cursor-pointer select-none"
        aria-expanded={!isCollapsed}
      >
        <span>{label}</span>
        <ChevronRight
          className="size-3 transition-transform duration-200"
          style={{
            color: hasActive ? "var(--zn-accent)" : "var(--zn-ink-3)",
            transform: isCollapsed ? "none" : "rotate(90deg)",
            opacity: 0.7,
          }}
        />
      </button>
      {!isCollapsed && (
        <div className="flex flex-col gap-1 mt-0.5">
          {items.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              active={isActive(item.href)}
              badge={badges?.[item.href]}
              onHide={onHide && !ALWAYS_VISIBLE.has(item.href) ? () => onHide(item.href) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <ReviewProvider>
      <AppShellInner>{children}</AppShellInner>
    </ReviewProvider>
  );
}

function readInvoicesForDrawer(): Invoice[] {
  if (typeof window === "undefined") return [];
  const localAccount = readLocalAccount();
  const isDemo = localAccount?.planId === "demo";
  const storageKey = isDemo ? demoInvoiceStateStorageKey : importedInvoicesStorageKey;
  const stored = window.localStorage.getItem(storageKey);
  if (!stored) return isDemo ? (demoInvoices as Invoice[]) : [];
  try {
    const parsed = JSON.parse(stored) as Invoice[];
    return Array.isArray(parsed) && parsed.length
      ? parsed
      : isDemo
        ? (demoInvoices as Invoice[])
        : [];
  } catch {
    return isDemo ? (demoInvoices as Invoice[]) : [];
  }
}

function AppShellInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");
  const { isOpen: reviewOpen, close: closeReview, outcomesLogged } = useReview();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const allInvoices = useMemo(() => readInvoicesForDrawer(), []);

  // Collapsible section state — Finance collapses by default
  const [collapse, setCollapse] = useState<Record<string, boolean>>({ overview: false, collections: false, finance: true });
  useEffect(() => { setCollapse(readCollapse()); }, []);

  // Hidden nav items — user can hide/restore individual items
  const [hiddenHrefs, setHiddenHrefs] = useState<Set<string>>(new Set());
  useEffect(() => { setHiddenHrefs(readHiddenHrefs()); }, []);
  const [hiddenExpanded, setHiddenExpanded] = useState(false);

  function hideNavItem(href: string) {
    setHiddenHrefs((prev) => {
      const next = new Set([...prev, href]);
      writeHiddenHrefs(next);
      return next;
    });
  }
  function restoreNavItem(href: string) {
    setHiddenHrefs((prev) => {
      const next = new Set([...prev]);
      next.delete(href);
      writeHiddenHrefs(next);
      return next;
    });
  }

  // Workspace prefs — module visibility + dashboard widgets
  const [workspacePrefs, setWorkspacePrefs] = useState<WorkspacePrefs | null>(null);
  useEffect(() => {
    setWorkspacePrefs(readWorkspacePrefs());
    function onPrefs(e: Event) {
      setWorkspacePrefs((e as CustomEvent<WorkspacePrefs>).detail);
    }
    window.addEventListener("zentra:workspaceprefs", onPrefs);
    return () => window.removeEventListener("zentra:workspaceprefs", onPrefs);
  }, []);

  // Build the visible Finance nav items from enabled modules (cashflow/expenses/tax/reports)
  const visibleFinanceItems = useMemo<NavItem[]>(() => {
    if (!workspacePrefs) return [];
    const enabledHrefs = new Set<string>();
    (Object.keys(workspacePrefs.modules) as ModuleKey[]).forEach((key) => {
      if (workspacePrefs.modules[key] && key !== "collections") {
        MODULES[key].navHrefs.forEach((h) => enabledHrefs.add(h));
      }
    });
    return financeNav.filter((item) => enabledHrefs.has(item.href));
  }, [workspacePrefs]);

  // Hide the entire Collections nav section when the module is off
  const collectionsEnabled = workspacePrefs?.modules.collections ?? true;

  // Show "+ Add modules" when any module is disabled (so the user can re-enable from anywhere)
  const someModulesHidden = workspacePrefs
    ? (Object.keys(workspacePrefs.modules) as ModuleKey[])
        .some((k) => !workspacePrefs.modules[k])
    : false;
  function toggleSection(key: string) {
    setCollapse((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      writeCollapse(next);
      return next;
    });
  }

  // Badge counts per nav href
  const collectionsBadges: Partial<Record<string, number>> = {
    "/chase-today": outcomesLogged > 0 ? outcomesLogged : undefined,
  };

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
            <span className="text-[14px] font-semibold tracking-[-0.01em]" style={{ color: "var(--zn-ink)" }}>Zentra</span>
            <span className="zn-section-label !p-0 !mt-0.5">Collect</span>
          </span>
        </Link>

        {/* Client / workspace switcher */}
        <WorkspaceSwitcher />

        {/* Scrollable nav — grows to fill space, scrolls if sections overflow */}
        <div className="flex-1 overflow-y-auto min-h-0 -mx-1 px-1">
          {/* Overview */}
          <CollapsibleSection
            label="Overview"
            sectionKey="overview"
            items={overviewNav.filter((i) => !hiddenHrefs.has(i.href))}
            collapse={collapse}
            onToggle={toggleSection}
            isActive={isActive}
            onHide={hideNavItem}
            className="mb-[14px]"
          />

          {/* Collections — only shown when the Collections module is enabled */}
          {collectionsEnabled && (
            <CollapsibleSection
              label="Collections"
              sectionKey="collections"
              items={collectionsNav.filter((i) => !hiddenHrefs.has(i.href))}
              collapse={collapse}
              onToggle={toggleSection}
              isActive={isActive}
              badges={collectionsBadges}
              onHide={hideNavItem}
              className="mb-[14px]"
            />
          )}

          {/* Finance — dynamically built from enabled modules */}
          {visibleFinanceItems.length > 0 && (
            <CollapsibleSection
              label="Finance"
              sectionKey="finance"
              items={visibleFinanceItems.filter((i) => !hiddenHrefs.has(i.href))}
              collapse={collapse}
              onToggle={toggleSection}
              isActive={isActive}
              onHide={hideNavItem}
            />
          )}

          {/* Hidden pages — restore section */}
          {hiddenHrefs.size > 0 && (
            <div className="mt-3 pt-3 border-t" style={{ borderColor: "var(--zn-line-soft)" }}>
              <button
                type="button"
                onClick={() => setHiddenExpanded((v) => !v)}
                className="zn-section-label w-full flex items-center justify-between cursor-pointer select-none"
              >
                <span>Hidden pages</span>
                <ChevronRight
                  className="size-3 transition-transform duration-200"
                  style={{
                    color: "var(--zn-ink-3)",
                    transform: hiddenExpanded ? "rotate(90deg)" : "none",
                    opacity: 0.7,
                  }}
                />
              </button>
              {hiddenExpanded && (
                <div className="flex flex-col gap-0.5 mt-1">
                  {[...overviewNav, ...collectionsNav, ...financeNav]
                    .filter((i) => hiddenHrefs.has(i.href))
                    .map((item) => (
                      <div key={item.href} className="flex items-center gap-2 px-1.5 py-1 rounded-lg">
                        <span className="size-3.5 flex-shrink-0 flex items-center justify-center" style={{ color: "var(--zn-ink-3)" }}><item.icon className="size-3.5" /></span>
                        <span className="flex-1 text-[12px] truncate" style={{ color: "var(--zn-ink-3)" }}>
                          {item.label}
                        </span>
                        <button
                          type="button"
                          onClick={() => restoreNavItem(item.href)}
                          title={`Restore ${item.label}`}
                          className="flex-shrink-0 size-5 rounded flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                          style={{ color: "var(--zn-ink-3)" }}
                        >
                          <Plus className="size-3" />
                        </button>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}

          {/* Re-discovery: surface the workspace setup when modules are hidden */}
          {someModulesHidden && (
            <Link
              href="/settings?tab=workspace"
              className="zn-nav-item mt-3"
              style={{ color: "var(--zn-ink-3)" }}
            >
              <Plus className="zn-nav-icon size-4" />
              <span className="flex-1 text-[12px]">Add modules</span>
            </Link>
          )}
        </div>

        {/* Bottom: settings + help icon, then account badge — always visible */}
        <div
          className="flex flex-col gap-1.5 pt-[14px] border-t"
          style={{ borderColor: "var(--zn-line-soft)" }}
        >
          <div className="flex items-center gap-1">
            <Link
              href="/settings"
              className={cn("zn-nav-item flex-1", isActive("/settings") && "active")}
            >
              <Settings className="zn-nav-icon size-4" />
              <span>Settings</span>
            </Link>
            <ThemeToggle />
            <Link
              href="/help"
              className="flex-shrink-0 rounded-lg p-2 transition-colors hover:bg-[#ece3cc] dark:hover:bg-[#2d2820]"
              title="Help & support"
              aria-label="Help & support"
              style={{ color: isActive("/help") ? "var(--zn-ink)" : "var(--zn-ink-3)" }}
            >
              <HelpCircle className="size-4" />
            </Link>
          </div>

          {/* Account badge — adapts per plan: demo / trial / paid */}
          <SidebarAccountBadge />
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="flex flex-col min-w-0">

        {/* Mobile top bar (sm only) — pads under the iOS notch when installed */}
        <header
          className="md:hidden sticky top-0 z-40 flex items-center justify-between border-b backdrop-blur px-4 py-3"
          style={{
            background: "color-mix(in srgb, var(--zn-bg-2) 95%, transparent)",
            borderColor: "var(--zn-line)",
            paddingTop: "max(0.75rem, env(safe-area-inset-top))",
            paddingLeft:  "max(1rem, env(safe-area-inset-left))",
            paddingRight: "max(1rem, env(safe-area-inset-right))",
          }}
        >
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <span className="zn-brand-mark" style={{ width: 28, height: 28, fontSize: 16 }}>Z</span>
            <span className="text-[13px] font-semibold" style={{ color: "var(--zn-ink)" }}>Zentra Collect</span>
          </Link>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <MobileAccountPill />
          </div>
        </header>

        {/* ── Mobile bottom navigation bar ──────────────────────────────── */}
        {/*
          Four fixed tabs: Home · Invoices · Customers · Settings.
          An accent bar (2 px, top edge) marks the active tab.
          safe-area-inset-bottom keeps it clear of the iPhone home indicator.
        */}
        <nav
          className="md:hidden fixed bottom-0 inset-x-0 z-40 flex border-t"
          style={{
            background:    "var(--zn-surface)",
            borderColor:   "var(--zn-line)",
            paddingBottom: "env(safe-area-inset-bottom)",
          }}
          aria-label="Main navigation"
        >
          {mobileBottomNav.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className="relative flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors"
                style={{ color: active ? "var(--zn-accent)" : "var(--zn-ink-3)" }}
              >
                {/* Accent indicator bar at top edge of active tab */}
                {active && (
                  <span
                    className="absolute top-0 inset-x-0 h-0.5 rounded-b-full"
                    style={{ background: "var(--zn-accent)" }}
                    aria-hidden
                  />
                )}
                <item.icon className="size-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Syncs Supabase session → localStorage once per mount */}
        <AccountSync />

        {/* Arming banner — full width, above content */}
        <AutoSendArmingBanner />

        {/* Page content — drawer always overlays, no shift needed.
            zn-main-pb adds 6rem + safe-area-inset-bottom on mobile so
            the bottom nav and iPhone home indicator never overlap content. */}
        <main className="zn-main-pb flex-1 px-4 sm:px-6 lg:px-8 pt-6 lg:pt-8 md:pb-8">
          <div className="mx-auto w-full max-w-[1360px]">
            <TrialStatusBanner />
            <QueueStatusBar />
            {children}
          </div>
          <InstallPrompt />
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
      <ReviewDrawer allInvoices={allInvoices} />

      {/* Push notification permission banner — appears after 8 s, dismissed on click */}
      <PushPermission delayMs={8000} />
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
  const router = useRouter();
  if (!state) return null;
  const palette =
    state.tone === "warn" ? { bg: "var(--zn-warn-soft)", fg: "var(--zn-warn)", markBg: "var(--zn-warn)" } :
    state.tone === "risk" ? { bg: "var(--zn-risk-soft)", fg: "var(--zn-risk)", markBg: "var(--zn-risk)" } :
                            { bg: "var(--zn-surface)",   fg: "var(--zn-ink)",  markBg: "var(--zn-ink)"  };

  async function handleSignOut() {
    if (hasSupabaseBrowserConfig()) {
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signOut();
    }
    window.localStorage.removeItem(demoUserStorageKey);
    router.push("/login");
  }

  return (
    <div
      className="group flex items-center gap-3 mt-2 rounded-lg px-2.5 py-2"
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
      <span className="flex flex-col leading-[1.2] min-w-0 flex-1">
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
      <button
        type="button"
        onClick={handleSignOut}
        title="Sign out"
        aria-label="Sign out"
        className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 size-6 rounded flex items-center justify-center hover:bg-black/10 dark:hover:bg-white/10"
        style={{ color: palette.fg }}
      >
        <LogOut className="size-3.5" />
      </button>
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

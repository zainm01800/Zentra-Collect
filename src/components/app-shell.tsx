"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  AlertTriangle,
  BarChart3,
  Bell,
  BriefcaseBusiness,
  Calendar,
  ChevronRight,
  CreditCard,
  FileText,
  FileUp,
  HelpCircle,
  Home,
  Search,
  Settings,
  Upload,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  ActiveTrialBanner,
  DemoModeBanner,
  GracePeriodWarning,
  TrialExpiredBanner,
  UsageMeter,
} from "@/components/account-plan-ui";
import { getPlanConfig, getTrialState } from "@/lib/billing/plans";
import {
  normaliseLocalAccount,
  demoUserStorageKey,
  type DemoUser,
} from "@/lib/demo-auth";
import { createSupabaseBrowserClient, hasSupabaseBrowserConfig } from "@/lib/supabase/browser";
import { User } from "@supabase/supabase-js";

const primaryNav = [
  { href: "/dashboard", label: "Overview", icon: Home },
  { href: "/chase-today", label: "Collections", icon: CreditCard },
  { href: "/import", label: "Import", icon: FileUp },
  { href: "/portfolio", label: "Portfolio", icon: BriefcaseBusiness },
  { href: "/digest", label: "Digest", icon: FileText },
];

const secondaryNav = [
  { href: "/chase-today", label: "Customers", icon: Users },
  { href: "/chase-today", label: "Promises", icon: Calendar },
  { href: "/chase-today", label: "Disputes", icon: AlertTriangle },
  { href: "/digest", label: "Reports", icon: BarChart3 },
];

function subscribeToDemoUserChanges(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener("zentra-account-change", onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener("zentra-account-change", onStoreChange);
  };
}

function getDemoUserSnapshot() {
  return window.localStorage.getItem(demoUserStorageKey);
}

function getDemoUserServerSnapshot() {
  return null;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [supabaseUser, setSupabaseUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  useEffect(() => {
    setMounted(true);
    
    // Check for Supabase session
    if (hasSupabaseBrowserConfig()) {
      const supabase = createSupabaseBrowserClient();
      supabase.auth.getUser().then(({ data: { user } }) => {
        setSupabaseUser(user);
        setLoadingAuth(false);
      });

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        setSupabaseUser(session?.user ?? null);
      });

      return () => subscription.unsubscribe();
    } else {
      setLoadingAuth(false);
    }
  }, []);

  const rawUser = useSyncExternalStore(
    subscribeToDemoUserChanges,
    getDemoUserSnapshot,
    getDemoUserServerSnapshot,
  );
  const effectiveRawUser =
    rawUser ??
    (typeof window === "undefined"
      ? null
      : window.localStorage.getItem(demoUserStorageKey));
  const user = useMemo(() => {
    if (!effectiveRawUser) return null;
    try {
      return normaliseLocalAccount(JSON.parse(effectiveRawUser) as Partial<DemoUser>);
    } catch {
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(demoUserStorageKey);
      }
      return null;
    }
  }, [effectiveRawUser]);

  const planConfig = user ? getPlanConfig(user.planId) : null;
  const billingAccount = user
    ? {
        planId: user.planId,
        accountType: user.accountType,
        subscriptionStatus: user.subscriptionStatus,
        createdAt: user.createdAt,
        trialStartedAt: user.planId === "trial" ? user.createdAt : undefined,
        trialEndsAt: user.trialEndsAt,
        graceEndsAt: user.graceEndsAt,
        currentPeriodStartedAt: user.createdAt,
        usage: user.usage,
      }
    : null;
  const trialState = billingAccount ? getTrialState(billingAccount) : "not_trial";
  const isTrialActive = trialState === "active";
  const aiUsed = (user?.usage as Record<string, number> | undefined)?.aiActionsThisMonth ?? 0;
  const aiLimit = planConfig?.limits?.aiActionsPerMonth ?? 25;

  // Days remaining in trial
  const trialDaysLeft = useMemo(() => {
    if (!user?.trialEndsAt) return null;
    const diff = new Date(user.trialEndsAt).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }, [user?.trialEndsAt]);

  function signOut() {
    window.localStorage.removeItem(demoUserStorageKey);
    window.dispatchEvent(new Event("zentra-account-change"));
    router.push("/login");
  }

  useEffect(() => {
    if (!mounted) return;
    if (!user) {
      window.setTimeout(() => {
        if (window.localStorage.getItem(demoUserStorageKey)) {
          window.dispatchEvent(new Event("zentra-account-change"));
        } else {
          router.replace(pathname === "/demo" ? "/demo" : "/login");
        }
      }, 0);
      return;
    }
    if (isDemoUserExpired(user)) {
      window.localStorage.removeItem(demoUserStorageKey);
      window.dispatchEvent(new Event("zentra-account-change"));
      router.replace("/login");
    }
  }, [mounted, pathname, router, user]);

  if (!mounted || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f8f7f4]">
        <div className="flex flex-col items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-neutral-950 text-white font-black text-lg animate-pulse">
            Z
          </div>
          <p className="text-xs font-semibold uppercase tracking-widest text-neutral-400">
            Loading workspace…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#f8f7f4]">
      {/* Left Sidebar */}
      <aside className="hidden md:flex w-[230px] flex-shrink-0 flex-col border-r border-black/8 bg-white">
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-8">
          <div className="flex size-9 items-center justify-center rounded-[10px] bg-neutral-950 text-white font-black text-[15px] flex-shrink-0">
            Z
          </div>
          <div className="leading-none min-w-0">
            <p className="text-[14px] font-black tracking-[0.12em] text-neutral-950 uppercase">Zentra</p>
            <p className="text-[10px] font-bold tracking-[0.18em] text-neutral-400 uppercase mt-1">Collect</p>
          </div>
        </div>

        {/* Primary Nav */}
        <nav className="flex flex-col gap-1 px-4 pt-2">
          {primaryNav.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] transition-all",
                  isActive
                    ? "bg-[#F5F5F0] text-neutral-950 font-bold"
                    : "text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900 font-medium"
                )}
              >
                <item.icon className="size-4 flex-shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Divider + Secondary Nav */}
        <div className="mx-6 my-4 border-t border-black/5" />
        <nav className="flex flex-col gap-1 px-4">
          {secondaryNav.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.label}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] transition-all",
                  isActive
                    ? "bg-[#F5F5F0] text-neutral-950 font-bold"
                    : "text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900 font-medium"
                )}
              >
                <item.icon className="size-4 flex-shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Bottom Nav */}
        <div className="px-4 pb-2">
          <Link
            href="/settings"
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900 transition-all"
          >
            <Settings className="size-4 flex-shrink-0" />
            <span>Settings</span>
          </Link>
          <Link
            href="/settings"
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900 transition-all"
          >
            <HelpCircle className="size-4 flex-shrink-0" />
            <span>Help & support</span>
          </Link>
        </div>

        {/* Trial / Plan Info */}
        {billingAccount && user?.planId !== "demo" && (
          <div className="mx-4 mb-3 rounded-2xl border border-black/5 bg-transparent p-4">
            {isTrialActive && trialDaysLeft !== null && (
              <>
                <p className="text-[13px] font-bold text-neutral-950">Trial</p>
                <p className="text-[11px] font-medium text-neutral-500 mt-0.5">{trialDaysLeft} days left</p>
                <div className="mt-3 h-[3px] w-full rounded-full bg-neutral-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-amber-400 transition-all"
                    style={{ width: `${Math.max(5, (trialDaysLeft / 14) * 100)}%` }}
                  />
                </div>
              </>
            )}
            <p className="mt-3 text-[11px] font-medium text-neutral-500">{aiUsed} / {aiLimit} AI actions used</p>
            <Button
              onClick={() => router.push("/pricing")}
              className="mt-3 w-full h-[30px] rounded-full bg-white border border-black/10 text-neutral-950 text-[11px] font-bold hover:bg-neutral-50 transition-all"
            >
              Upgrade
            </Button>
          </div>
        )}

        {/* User */}
        <div className="mt-2 px-4 py-4 border-t border-black/5">
          <button
            type="button"
            onClick={signOut}
            className="flex w-full items-center gap-3 rounded-xl hover:bg-neutral-50 p-2 transition-all group"
          >
            <div className="flex size-9 items-center justify-center rounded-full bg-neutral-950 text-white text-[13px] font-black flex-shrink-0">
              {user.name?.charAt(0).toUpperCase() ?? "U"}
            </div>
            <div className="min-w-0 text-left">
              <p className="truncate text-[13px] font-bold text-neutral-900 leading-tight">{user.name ?? "User"}</p>
              <p className="truncate text-[11px] font-medium text-neutral-400 leading-tight capitalize mt-0.5">{user.planId} account</p>
            </div>
            <ChevronRight className="ml-auto size-4 text-neutral-400 flex-shrink-0 group-hover:text-neutral-600 transition-colors" />
          </button>
        </div>
      </aside>

      {/* Main Area */}
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        {/* Removed Top Bar - it will be rendered per page to match the clean layout */}

        {/* Billing Banners */}
        {billingAccount && (
          <div className="px-6 pt-4 space-y-2 flex-shrink-0">
            <TrialExpiredBanner account={billingAccount} />
            <GracePeriodWarning account={billingAccount} />
            {user.planId === "demo" && <DemoModeBanner />}
            <ActiveTrialBanner account={billingAccount} />
          </div>
        )}

        {/* Scrollable Page Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="px-6 py-6 lg:px-8 lg:py-8">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 flex h-16 items-center justify-around border-t border-black/8 bg-white px-2 md:hidden">
        {primaryNav.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 px-3 py-1 rounded-lg transition-all",
                isActive ? "text-neutral-950" : "text-neutral-400"
              )}
            >
              <item.icon className={cn("size-5", isActive ? "text-neutral-950" : "text-neutral-400")} />
              <span className="text-[10px] font-semibold">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

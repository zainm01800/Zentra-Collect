"use client";

import { useEffect, useRef } from "react";
import { readLocalAccount, writeLocalAccount, createUsageCounters } from "@/lib/demo-auth";
import type { DemoUser } from "@/lib/demo-auth";
import { fetchAccountMe } from "@/lib/client/account-me-cache";

// Syncs the authenticated user's plan/status from Supabase into localStorage.
// Runs on mount AND whenever the PWA comes back to the foreground (visibilitychange/focus),
// so plan changes from Stripe webhooks are reflected without requiring a full reload.

const DEV_PLAN_OVERRIDE_KEY = "zentra.devPlanOverride.v1";
// Minimum ms between syncs (prevents hammering /api/account/me on rapid focus events)
const MIN_SYNC_INTERVAL_MS = 30_000;

export function AccountSync() {
  const lastSyncRef = useRef<number>(0);

  useEffect(() => {
    async function sync(reason?: string) {
      try {
        // Skip if a dev plan override is active
        if (typeof window !== "undefined" && localStorage.getItem(DEV_PLAN_OVERRIDE_KEY)) {
          return;
        }

        // Debounce — don't re-sync if we synced recently
        const now = Date.now();
        if (reason !== "mount" && now - lastSyncRef.current < MIN_SYNC_INTERVAL_MS) {
          return;
        }
        lastSyncRef.current = now;

        const data = (await fetchAccountMe(reason === "mount")) as {
          authenticated?: boolean;
          hasAccount?: boolean;
          account?: Omit<DemoUser, "usage">;
        } | null;
        if (!data) return;

        if (!data.authenticated || !data.hasAccount || !data.account) return;

        const serverAccount: Omit<DemoUser, "usage"> = data.account;

        // Preserve existing usage counters from localStorage
        const existing = readLocalAccount();
        const usage = existing?.usage ?? createUsageCounters();

        const merged: DemoUser = { ...serverAccount, usage };

        // Only write if something meaningful changed
        if (
          existing?.planId === merged.planId &&
          existing?.subscriptionStatus === merged.subscriptionStatus &&
          existing?.email === merged.email &&
          existing?.emailAddon === merged.emailAddon
        ) {
          return;
        }

        writeLocalAccount(merged);
      } catch {
        // Network errors are silently ignored — localStorage state is the fallback.
      }
    }

    // Initial sync on mount
    sync("mount");

    // Re-sync when the PWA returns to the foreground — catches plan changes
    // that happened via Stripe webhook while the app was backgrounded.
    const handleVisibility = () => {
      if (document.visibilityState === "visible") sync("visibility");
    };
    const handleFocus = () => sync("focus");

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleFocus);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  return null;
}

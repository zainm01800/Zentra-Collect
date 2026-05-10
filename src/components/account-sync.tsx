"use client";

import { useEffect } from "react";
import { readLocalAccount, writeLocalAccount, createUsageCounters } from "@/lib/demo-auth";
import type { DemoUser } from "@/lib/demo-auth";

// Fires once on mount. Calls /api/account/me (server-side Supabase session).
// If the response contains a real account, merges it into localStorage so
// useLocalAccount() and the whole UI reflect the authenticated user's real plan.
// Usage counters from localStorage are preserved — only identity/plan fields are overwritten.

export function AccountSync() {
  useEffect(() => {
    async function sync() {
      try {
        const res = await fetch("/api/account/me");
        if (!res.ok) return;
        const data = await res.json();

        if (!data.authenticated || !data.hasAccount || !data.account) return;

        const serverAccount: Omit<DemoUser, "usage"> = data.account;

        // Preserve existing usage counters from localStorage so we don't reset them
        const existing = readLocalAccount();
        const usage = existing?.usage ?? createUsageCounters();

        const merged: DemoUser = {
          ...serverAccount,
          usage,
        };

        // Only overwrite if the plan, status, email, or addon status changed
        if (
          existing?.planId === merged.planId &&
          existing?.subscriptionStatus === merged.subscriptionStatus &&
          existing?.email === merged.email &&
          existing?.emailAddon === merged.emailAddon
        ) {
          return;
        }

        writeLocalAccount(merged);
        // writeLocalAccount already dispatches a storage event which triggers
        // useLocalAccount to re-render everywhere.
      } catch {
        // Network errors are silently ignored — localStorage state is the fallback.
      }
    }

    sync();
  }, []);

  return null;
}

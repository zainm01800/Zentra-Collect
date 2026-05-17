"use client";

/**
 * Conditionally renders ZentraDashboard only when the user has at
 * least one invoice in their workspace. When they don't, the welcome
 * empty state in TodayHeroAndPills already covers the "what should I
 * do?" prompt — rendering ZentraDashboard's own empty card on top of
 * it duplicates the CTA pair (fixes audit issue #5).
 */

import { useEffect, useState } from "react";
import { ZentraDashboard } from "@/components/zentra-dashboard";
import { importedInvoicesStorageKey } from "@/lib/import/zentra-import";
import { readActiveClientId, clientInvoicesKey } from "@/lib/bookkeeper-clients";
import { readLocalAccount } from "@/lib/demo-auth";
import { demoCashpilotInvoices as demoInvoices } from "@/lib/demo-data/zentra-demo-data";
import type { Invoice as ZentraInvoice } from "@/types/zentra";

const BOOKKEEPER_PLAN_IDS = ["founding_bookkeeper", "bookkeeper_starter", "bookkeeper_pro"];

function resolveKey(planId: string): string {
  if (BOOKKEEPER_PLAN_IDS.includes(planId)) {
    const id = readActiveClientId();
    if (id && id !== "all") return clientInvoicesKey(id);
  }
  return importedInvoicesStorageKey;
}

function readInvoiceCount(): number {
  if (typeof window === "undefined") return 0;
  const account = readLocalAccount();
  const isDemo = account?.planId === "demo";
  const raw = window.localStorage.getItem(resolveKey(account?.planId ?? ""));
  if (!raw) return isDemo ? demoInvoices.length : 0;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

export function TodayQueueWrapper({
  initialInvoices,
}: {
  initialInvoices?: ZentraInvoice[];
}) {
  // Prefer server-provided count when available — initialInvoices comes
  // from the Supabase query in /today/page.tsx. That keeps the SSR
  // output correct (no flash of duplicate empty cards) before client
  // hydration takes over.
  const [count, setCount] = useState<number | null>(
    initialInvoices !== undefined ? initialInvoices.length : null,
  );
  useEffect(() => {
    setCount(readInvoiceCount());
  }, []);

  // Hide on SSR (count === null) AND when client-side reading confirms
  // zero invoices. The TodayHeroAndPills welcome card already covers
  // the "what should I do?" empty-state prompt.
  if (count === null || count === 0) return null;

  return <ZentraDashboard initialInvoices={initialInvoices} />;
}

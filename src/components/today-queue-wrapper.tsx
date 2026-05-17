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
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    setCount(readInvoiceCount());
  }, []);

  // On first SSR render we don't know the count — render the dashboard
  // so paid users see their queue immediately. Once mounted, hide it
  // when there's truly nothing.
  if (count === 0) return null;

  return <ZentraDashboard initialInvoices={initialInvoices} />;
}

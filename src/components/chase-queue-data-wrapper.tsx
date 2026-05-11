"use client";

import { useMemo } from "react";
import { ChaseQueue } from "@/components/chase-queue";
import { readLocalAccount } from "@/lib/demo-auth";
import { demoCashpilotInvoices as demoInvoices } from "@/lib/demo-data/zentra-demo-data";
import { importedInvoicesStorageKey } from "@/lib/import/zentra-import";
import type { Invoice } from "@/types/cashpilot";

const demoInvoiceStateStorageKey = "zentra.demoInvoiceState.v1";

function readInvoicesForQueue(): Invoice[] {
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

export function ChaseQueueDataWrapper({ onlyToday = false }: { onlyToday?: boolean }) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const invoices = useMemo(() => readInvoicesForQueue(), []);
  return <ChaseQueue initialInvoices={invoices} onlyToday={onlyToday} />;
}

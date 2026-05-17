"use client";

/**
 * useSupabaseInvoiceSync
 *
 * On mount for authenticated real users, fetches invoices from Supabase
 * and writes them into the invoice store (localStorage). This ensures
 * that invoice data persists across devices and survives browser cache
 * clears.
 *
 * The sync is one-directional on read: Supabase → localStorage.
 * Writes (patchInvoice, createInvoice, recordPayment) are already handled
 * by the invoice store which writes to Supabase via the import pipeline.
 *
 * Returns { syncing, lastSyncedAt, error }.
 */

import { useEffect, useState } from "react";
import { fetchInvoicesFromDb } from "@/lib/api/client-db";
import { writeInvoices, resolveStorageKey } from "@/lib/invoice-store";
import { hasSupabaseBrowserConfig, createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { Invoice } from "@/types/zentra";

interface SyncState {
  syncing: boolean;
  lastSyncedAt: Date | null;
  error: string | null;
  invoiceCount: number;
}

export function useSupabaseInvoiceSync(): SyncState {
  const [state, setState] = useState<SyncState>({
    syncing: false,
    lastSyncedAt: null,
    error: null,
    invoiceCount: 0,
  });

  useEffect(() => {
    if (!hasSupabaseBrowserConfig()) return;

    async function sync() {
      setState((s) => ({ ...s, syncing: true, error: null }));
      try {
        const supabase = createSupabaseBrowserClient();
        const { data: { user } } = await supabase.auth.getUser();

        // Only sync for authenticated (non-demo) users
        if (!user) {
          setState((s) => ({ ...s, syncing: false }));
          return;
        }

        const invoices: Invoice[] = await fetchInvoicesFromDb();
        if (invoices.length > 0) {
          // Write fetched invoices into the store so all components see them
          writeInvoices(invoices);
        }

        setState({
          syncing: false,
          lastSyncedAt: new Date(),
          error: null,
          invoiceCount: invoices.length,
        });
      } catch (err) {
        setState((s) => ({
          ...s,
          syncing: false,
          error: err instanceof Error ? err.message : "Sync failed",
        }));
      }
    }

    void sync();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return state;
}

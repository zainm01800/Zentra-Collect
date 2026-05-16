"use server";

/**
 * Sync server actions for accounting integrations.
 *
 * Fetches invoices from the third-party API, maps them to the Zentra schema,
 * and returns them to the client. The client then writes to localStorage so
 * the rest of the app sees the imported invoices exactly as if they came from
 * a CSV upload.
 *
 * No write-back: read-only. Lower risk surface for the launch — adding
 * write-back later is a small follow-up.
 */

import {
  getActiveAccountId,
  readConnection,
} from "@/lib/integrations/oauth-store";
import {
  fetchInvoices as fetchXeroInvoices,
} from "@/lib/integrations/xero/client";
import { mapXeroInvoices } from "@/lib/integrations/xero/mapper";
import {
  fetchInvoices as fetchQBInvoices,
} from "@/lib/integrations/quickbooks/client";
import { mapQBInvoices } from "@/lib/integrations/quickbooks/mapper";
import {
  fetchInvoices as fetchSageInvoices,
} from "@/lib/integrations/sage/client";
import { mapSageInvoices } from "@/lib/integrations/sage/mapper";
import {
  fetchInvoices as fetchFreeAgentInvoices,
} from "@/lib/integrations/freeagent/client";
import { mapFreeAgentInvoices } from "@/lib/integrations/freeagent/mapper";
import { getEmailsOnActiveDD } from "@/lib/integrations/gocardless/client";
import type { Invoice as ZentraInvoice } from "@/types/zentra";

export interface SyncResult {
  ok:              boolean;
  /** When ok=true, the list of invoices to write to localStorage. */
  invoices?:       ZentraInvoice[];
  /** Human-readable summary for the toast/banner. */
  summary?:        string;
  /** When ok=false. */
  error?:          string;
  /** True when the user simply hasn't configured the integration yet. */
  notConfigured?:  boolean;
  /** True when there's no stored connection for this user. */
  notConnected?:   boolean;
}

// ── Xero ──────────────────────────────────────────────────────────────────────

export async function syncFromXeroAction(): Promise<SyncResult> {
  const accountId = await getActiveAccountId();
  if (!accountId) {
    return { ok: false, error: "Not signed in." };
  }

  const connection = await readConnection(accountId, "xero");
  if (!connection) {
    return { ok: false, notConnected: true, error: "Xero is not connected." };
  }

  try {
    const xeroInvoices = await fetchXeroInvoices(
      accountId,
      connection.providerTenantId,
    );
    const invoices = mapXeroInvoices(
      xeroInvoices,
      accountId,
      connection.providerTenantId,
    );

    return {
      ok: true,
      invoices,
      summary: `Imported ${invoices.length} invoice${invoices.length === 1 ? "" : "s"} from ${connection.tenantName ?? "Xero"}.`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[syncFromXeroAction]", err);
    return { ok: false, error: message };
  }
}

// ── QuickBooks ────────────────────────────────────────────────────────────────

export async function syncFromQuickBooksAction(): Promise<SyncResult> {
  const accountId = await getActiveAccountId();
  if (!accountId) {
    return { ok: false, error: "Not signed in." };
  }

  const connection = await readConnection(accountId, "quickbooks");
  if (!connection) {
    return { ok: false, notConnected: true, error: "QuickBooks is not connected." };
  }

  try {
    const qbInvoices = await fetchQBInvoices(
      accountId,
      connection.providerTenantId,
    );
    const invoices = mapQBInvoices(
      qbInvoices,
      accountId,
      connection.providerTenantId,
    );

    return {
      ok: true,
      invoices,
      summary: `Imported ${invoices.length} invoice${invoices.length === 1 ? "" : "s"} from ${connection.tenantName ?? "QuickBooks"}.`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[syncFromQuickBooksAction]", err);
    return { ok: false, error: message };
  }
}

// ── Sage ──────────────────────────────────────────────────────────────────────

export async function syncFromSageAction(): Promise<SyncResult> {
  const accountId = await getActiveAccountId();
  if (!accountId) {
    return { ok: false, error: "Not signed in." };
  }

  const connection = await readConnection(accountId, "sage");
  if (!connection) {
    return { ok: false, notConnected: true, error: "Sage is not connected." };
  }

  try {
    const sageInvoices = await fetchSageInvoices(
      accountId,
      connection.providerTenantId,
    );
    const invoices = mapSageInvoices(
      sageInvoices,
      accountId,
      connection.providerTenantId,
    );

    return {
      ok: true,
      invoices,
      summary: `Imported ${invoices.length} invoice${invoices.length === 1 ? "" : "s"} from ${connection.tenantName ?? "Sage"}.`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[syncFromSageAction]", err);
    return { ok: false, error: message };
  }
}

// ── FreeAgent ─────────────────────────────────────────────────────────────────

export async function syncFromFreeAgentAction(): Promise<SyncResult> {
  const accountId = await getActiveAccountId();
  if (!accountId) return { ok: false, error: "Not signed in." };

  const connection = await readConnection(accountId, "freeagent");
  if (!connection) {
    return { ok: false, notConnected: true, error: "FreeAgent is not connected." };
  }

  try {
    const faInvoices = await fetchFreeAgentInvoices(accountId);
    const invoices = await mapFreeAgentInvoices(faInvoices, accountId, accountId);
    return {
      ok: true,
      invoices,
      summary: `Imported ${invoices.length} invoice${invoices.length === 1 ? "" : "s"} from ${connection.tenantName ?? "FreeAgent"}.`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[syncFromFreeAgentAction]", err);
    return { ok: false, error: message };
  }
}

// ── GoCardless ────────────────────────────────────────────────────────────────
// Mandate-based (not invoice-based). Returns a summary of how many
// customers are on active DD — the chase plan will consult this set to
// suppress chases for already-paying customers.

export async function syncFromGoCardlessAction(): Promise<SyncResult> {
  const accountId = await getActiveAccountId();
  if (!accountId) return { ok: false, error: "Not signed in." };

  const connection = await readConnection(accountId, "gocardless");
  if (!connection) {
    return { ok: false, notConnected: true, error: "GoCardless is not connected." };
  }

  try {
    const emails = await getEmailsOnActiveDD(accountId);
    return {
      ok: true,
      // No invoices — this provider produces mandate metadata.
      summary: `${emails.size} customer${emails.size === 1 ? "" : "s"} on active Direct Debit.`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[syncFromGoCardlessAction]", err);
    return { ok: false, error: message };
  }
}

// ── Status check ──────────────────────────────────────────────────────────────

export interface IntegrationStatus {
  xero:       { connected: boolean; tenantName?: string };
  quickbooks: { connected: boolean; tenantName?: string };
  sage:       { connected: boolean; tenantName?: string };
  freeagent:  { connected: boolean; tenantName?: string };
  gocardless: { connected: boolean; tenantName?: string };
}

export async function getIntegrationStatusAction(): Promise<IntegrationStatus> {
  const accountId = await getActiveAccountId();
  if (!accountId) {
    return {
      xero:       { connected: false },
      quickbooks: { connected: false },
      sage:       { connected: false },
      freeagent:  { connected: false },
      gocardless: { connected: false },
    };
  }

  const [xeroConn, qbConn, sageConn, faConn, gcConn] = await Promise.all([
    readConnection(accountId, "xero"),
    readConnection(accountId, "quickbooks"),
    readConnection(accountId, "sage"),
    readConnection(accountId, "freeagent"),
    readConnection(accountId, "gocardless"),
  ]);

  return {
    xero:       { connected: Boolean(xeroConn), tenantName: xeroConn?.tenantName },
    quickbooks: { connected: Boolean(qbConn),   tenantName: qbConn?.tenantName },
    sage:       { connected: Boolean(sageConn), tenantName: sageConn?.tenantName },
    freeagent:  { connected: Boolean(faConn),   tenantName: faConn?.tenantName },
    gocardless: { connected: Boolean(gcConn),   tenantName: gcConn?.tenantName },
  };
}

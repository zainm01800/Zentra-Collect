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

// ── Status check ──────────────────────────────────────────────────────────────

export interface IntegrationStatus {
  xero:       { connected: boolean; tenantName?: string };
  quickbooks: { connected: boolean; tenantName?: string };
  sage:       { connected: boolean; tenantName?: string };
}

export async function getIntegrationStatusAction(): Promise<IntegrationStatus> {
  const accountId = await getActiveAccountId();
  if (!accountId) {
    return {
      xero:       { connected: false },
      quickbooks: { connected: false },
      sage:       { connected: false },
    };
  }

  const [xeroConn, qbConn, sageConn] = await Promise.all([
    readConnection(accountId, "xero"),
    readConnection(accountId, "quickbooks"),
    readConnection(accountId, "sage"),
  ]);

  return {
    xero: {
      connected:  Boolean(xeroConn),
      tenantName: xeroConn?.tenantName,
    },
    quickbooks: {
      connected:  Boolean(qbConn),
      tenantName: qbConn?.tenantName,
    },
    sage: {
      connected:  Boolean(sageConn),
      tenantName: sageConn?.tenantName,
    },
  };
}

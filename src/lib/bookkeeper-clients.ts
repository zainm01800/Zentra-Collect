/**
 * src/lib/bookkeeper-clients.ts
 *
 * Storage helpers for the bookkeeper multi-client workspace feature.
 *
 * Storage keys:
 *   zentra.bookkeeperClients.v1          – ordered list of BookkeeperClient records
 *   zentra.client.{clientId}.invoices.v1 – Invoice[] for one client
 *   zentra.client.{clientId}.summary.v1  – ImportSummary for one client
 *   zentra.activeClientId.v1             – ID of the currently-active workspace
 */

import type { Invoice } from "@/types/zentra";
import type { ImportSummary } from "@/lib/import/zentra-import";

// ── Storage keys ──────────────────────────────────────────────────────────────

export const BOOKKEEPER_CLIENTS_KEY = "zentra.bookkeeperClients.v1";
export const ACTIVE_CLIENT_KEY      = "zentra.activeClientId.v1";

export function clientInvoicesKey(clientId: string) {
  return `zentra.client.${clientId}.invoices.v1`;
}
export function clientSummaryKey(clientId: string) {
  return `zentra.client.${clientId}.summary.v1`;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type BookkeeperClient = {
  id: string;
  name: string;       // business name
  label: string;      // short label / description shown in the switcher
  importedAt?: string;
  fileName?: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

export function generateClientId(): string {
  return `client_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

/** Read the client list from localStorage. Returns [] when empty or on error. */
export function readBookkeeperClients(): BookkeeperClient[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(BOOKKEEPER_CLIENTS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as BookkeeperClient[];
  } catch {
    return [];
  }
}

/** Write the full client list back to localStorage. */
export function saveBookkeeperClients(clients: BookkeeperClient[]): void {
  window.localStorage.setItem(BOOKKEEPER_CLIENTS_KEY, JSON.stringify(clients));
  void import("@/lib/sync/workspace-sync").then(({ pushDataType, getLocalSupabaseAccountId }) => {
    const id = getLocalSupabaseAccountId();
    if (id) return pushDataType("bookkeeper_clients", id);
  }).catch(() => {});
}

/** Add or update a single client record. */
export function upsertBookkeeperClient(client: BookkeeperClient): void {
  const clients = readBookkeeperClients();
  const idx = clients.findIndex((c) => c.id === client.id);
  if (idx >= 0) {
    clients[idx] = client;
  } else {
    clients.push(client);
  }
  saveBookkeeperClients(clients);
}

/** Remove a client and its associated invoice data. */
export function removeBookkeeperClient(clientId: string): void {
  const clients = readBookkeeperClients().filter((c) => c.id !== clientId);
  saveBookkeeperClients(clients);
  window.localStorage.removeItem(clientInvoicesKey(clientId));
  window.localStorage.removeItem(clientSummaryKey(clientId));
}

/** Read the active client ID. Returns "all" if not set. */
export function readActiveClientId(): string {
  if (typeof window === "undefined") return "all";
  return window.localStorage.getItem(ACTIVE_CLIENT_KEY) ?? "all";
}

/** Persist the active client ID and notify any same-tab listeners. */
export function writeActiveClientId(id: string): void {
  window.localStorage.setItem(ACTIVE_CLIENT_KEY, id);
  window.dispatchEvent(new CustomEvent("zentra:activeclient", { detail: id }));
}

/** Read invoices for a specific client. */
export function readClientInvoices(clientId: string): Invoice[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(clientInvoicesKey(clientId));
    if (!raw) return [];
    return JSON.parse(raw) as Invoice[];
  } catch {
    return [];
  }
}

/** Read import summary for a specific client. */
export function readClientSummary(clientId: string): ImportSummary | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(clientSummaryKey(clientId));
    if (!raw) return null;
    return JSON.parse(raw) as ImportSummary;
  } catch {
    return null;
  }
}

/** Save invoices for a specific client and update the client's importedAt / fileName. */
export function saveClientInvoices(
  clientId: string,
  invoices: Invoice[],
  summary: ImportSummary,
): void {
  window.localStorage.setItem(clientInvoicesKey(clientId), JSON.stringify(invoices));
  window.localStorage.setItem(clientSummaryKey(clientId), JSON.stringify(summary));
  // Update the client record's metadata
  const clients = readBookkeeperClients();
  const idx = clients.findIndex((c) => c.id === clientId);
  if (idx >= 0) {
    clients[idx].importedAt = summary.importedAt;
    clients[idx].fileName   = summary.fileName;
    saveBookkeeperClients(clients);
  }
}

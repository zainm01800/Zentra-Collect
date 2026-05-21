/**
 * Credit notes / refunds.
 *
 * A credit note represents money you're NOT collecting — either because
 * you're refunding a customer, cancelling a previously-issued invoice,
 * or correcting an over-invoice. It's effectively a negative invoice.
 *
 * Effects on books:
 *   - Reduces taxable income for the tax-year totals
 *   - Reduces output VAT (reversed) so the VAT estimate is accurate
 *   - Optionally linked to the original invoice for traceability
 *
 * Storage: localStorage "zentra.creditNotes.v1".
 */

import * as serverActions from "@/actions/credit-notes";

const STORAGE_KEY = "zentra.creditNotes.v1";

export interface CreditNote {
  id:              string;
  creditNoteNumber: string;        // CN-NNN
  /** Original invoice id (optional — standalone credit notes are allowed) */
  invoiceId?:      string;
  /** Original invoice number for display when invoiceId isn't a UUID we own */
  invoiceNumber?:  string;
  customerName:    string;
  issueDate:       string;
  reason:          string;
  /** Net (pre-VAT) amount being credited. Stored positive. */
  amountNet:       number;
  vatRate:         number;
  vatAmount:       number;
  /** Gross = amountNet + vatAmount. */
  amountGross:     number;
  createdAt:       string;
}

// ── Storage helpers ──────────────────────────────────────────────────────────

function safeRead(): CreditNote[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CreditNote[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function safeWrite(items: CreditNote[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent("zentra:credit-notes-change"));
    void import('@/lib/sync/workspace-sync').then(({ pushDataType, getLocalSupabaseAccountId }) => {
      const id = getLocalSupabaseAccountId();
      if (id) return pushDataType('credit_notes', id);
    }).catch(() => {});
  } catch {
    /* quota / SSR */
  }
}

export function readCreditNotes(): CreditNote[] {
  return safeRead().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function nextCreditNoteNumber(): string {
  const existing = safeRead();
  if (!existing.length) return "CN-001";
  const nums = existing
    .map((c) => c.creditNoteNumber.match(/CN-(\d+)/))
    .map((m) => (m ? parseInt(m[1], 10) : 0))
    .filter((n) => Number.isFinite(n));
  return `CN-${(Math.max(0, ...nums) + 1).toString().padStart(3, "0")}`;
}

export interface CreateCreditNoteInput {
  customerName: string;
  invoiceId?:   string;
  invoiceNumber?: string;
  issueDate:    string;
  reason:       string;
  amountNet:    number;
  vatRate:      number;
}

export function createCreditNote(input: CreateCreditNoteInput): CreditNote {
  const net   = Math.max(0, input.amountNet);
  const vat   = Math.round(net * (input.vatRate / 100) * 100) / 100;
  const gross = Math.round((net + vat) * 100) / 100;
  const cn: CreditNote = {
    id:               `cn-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    creditNoteNumber: nextCreditNoteNumber(),
    invoiceId:        input.invoiceId,
    invoiceNumber:    input.invoiceNumber,
    customerName:     input.customerName.trim(),
    issueDate:        input.issueDate,
    reason:           input.reason.trim(),
    amountNet:        net,
    vatRate:          input.vatRate,
    vatAmount:        vat,
    amountGross:      gross,
    createdAt:        new Date().toISOString(),
  };
  safeWrite([...safeRead(), cn]);
  void serverActions.addCreditNote({
    customerName:   cn.customerName,
    invoiceId:      cn.invoiceId,
    invoiceNumber:  cn.invoiceNumber,
    issueDate:      cn.issueDate,
    reason:         cn.reason,
    amountNet:      cn.amountNet,
    vatRate:        cn.vatRate,
    clientUuid:     cn.id,
  }).then((r) => {
    if (r.ok && r.creditNote) {
      const items = safeRead();
      const idx = items.findIndex((c) => c.id === cn.id);
      if (idx >= 0) {
        items[idx] = { ...items[idx], id: r.creditNote.id, creditNoteNumber: r.creditNote.creditNoteNumber };
        safeWrite(items);
      }
    }
  }).catch(() => { /* best-effort */ });
  return cn;
}

export function deleteCreditNote(id: string): void {
  safeWrite(safeRead().filter((c) => c.id !== id));
  void serverActions.deleteCreditNote(id).catch(() => { /* best-effort */ });
}

export async function hydrateCreditNotesFromServer(): Promise<void> {
  try {
    const items = await serverActions.getCreditNotes();
    if (!Array.isArray(items) || items.length === 0) return;
    safeWrite(items.map((r) => ({
      id:               r.id,
      creditNoteNumber: r.creditNoteNumber,
      invoiceId:        r.invoiceId,
      invoiceNumber:    r.invoiceNumber,
      customerName:     r.customerName,
      issueDate:        r.issueDate,
      reason:           r.reason,
      amountNet:        r.amountNet,
      vatRate:          r.vatRate,
      vatAmount:        r.vatAmount,
      amountGross:      r.amountGross,
      createdAt:        r.createdAt,
    })));
  } catch { /* best-effort */ }
}

export async function pushLocalCreditNotesToServer(): Promise<number> {
  const items = safeRead();
  if (!items.length) return 0;
  try {
    const r = await serverActions.bulkImportCreditNotes(items.map((c) => ({
      customerName:  c.customerName,
      invoiceId:     c.invoiceId,
      invoiceNumber: c.invoiceNumber,
      issueDate:     c.issueDate,
      reason:        c.reason,
      amountNet:     c.amountNet,
      vatRate:       c.vatRate,
      clientUuid:    c.id,
    })));
    return r.inserted ?? 0;
  } catch { return 0; }
}

// ── Aggregates ───────────────────────────────────────────────────────────────

/** Total NET credit issued in a date range. Reduces taxable income. */
export function totalCreditedNet(opts?: { from?: Date; to?: Date }): number {
  const items = safeRead();
  if (!items.length) return 0;
  const fromMs = opts?.from?.getTime() ?? -Infinity;
  const toMs   = opts?.to?.getTime() ?? Infinity;
  return items.reduce((s, c) => {
    const ts = new Date(c.issueDate).getTime();
    if (!Number.isFinite(ts) || ts < fromMs || ts > toMs) return s;
    return s + c.amountNet;
  }, 0);
}

/** Total VAT credited (output VAT reversed) in a date range. */
export function totalCreditedVat(opts?: { from?: Date; to?: Date }): number {
  const items = safeRead();
  if (!items.length) return 0;
  const fromMs = opts?.from?.getTime() ?? -Infinity;
  const toMs   = opts?.to?.getTime() ?? Infinity;
  return items.reduce((s, c) => {
    const ts = new Date(c.issueDate).getTime();
    if (!Number.isFinite(ts) || ts < fromMs || ts > toMs) return s;
    return s + c.vatAmount;
  }, 0);
}

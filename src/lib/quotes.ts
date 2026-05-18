/**
 * Quotes / Estimates.
 *
 * A quote is a draft invoice — same shape minus the "issued" state.
 * Workflow:
 *   draft   -> user is composing
 *   sent    -> emailed/handed to the customer
 *   accepted -> customer said yes; can be converted to an invoice
 *   declined -> customer said no
 *
 * Storage: localStorage "zentra.quotes.v1". Same pattern as the rest of
 * the books features so the smallest sole trader can use it without a
 * Supabase configuration.
 */

const STORAGE_KEY = "zentra.quotes.v1";

export type QuoteStatus = "draft" | "sent" | "accepted" | "declined" | "converted";

export interface QuoteLineItem {
  id:          string;
  description: string;
  quantity:    number;
  unitPrice:   number;   // net per unit
  amount:      number;   // qty * unitPrice
  vatRate?:    number;   // 0 / 5 / 20
  vatAmount?:  number;
}

export interface Quote {
  id:             string;
  quoteNumber:    string;        // e.g. QTE-001
  customerName:   string;
  customerEmail?: string;
  issueDate:      string;        // YYYY-MM-DD
  expiresOn?:     string;        // YYYY-MM-DD
  status:         QuoteStatus;
  lineItems:      QuoteLineItem[];
  notes?:         string;
  /** Once converted, the id of the invoice we created. */
  convertedToInvoiceId?: string;
  createdAt:      string;
  updatedAt:      string;
}

// ── Storage helpers ──────────────────────────────────────────────────────────

function safeRead(): Quote[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Quote[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function safeWrite(items: Quote[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent("zentra:quotes-change"));
  } catch {
    /* quota / SSR */
  }
}

export function readQuotes(): Quote[] {
  return safeRead().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function readQuote(id: string): Quote | null {
  return safeRead().find((q) => q.id === id) ?? null;
}

export function nextQuoteNumber(): string {
  const existing = safeRead();
  if (!existing.length) return "QTE-001";
  const nums = existing
    .map((q) => q.quoteNumber.match(/QTE-(\d+)/))
    .map((m) => (m ? parseInt(m[1], 10) : 0))
    .filter((n) => Number.isFinite(n));
  const next = (Math.max(0, ...nums) + 1).toString().padStart(3, "0");
  return `QTE-${next}`;
}

export interface CreateQuoteInput {
  customerName:   string;
  customerEmail?: string;
  issueDate:      string;
  expiresOn?:     string;
  amountNet:      number;
  vatRate:        number;   // 0 / 5 / 20
  description:    string;
  notes?:         string;
}

export function createQuote(input: CreateQuoteInput): Quote {
  const net  = Math.max(0, input.amountNet);
  const vat  = Math.round(net * (input.vatRate / 100) * 100) / 100;
  const now  = new Date().toISOString();
  const lineItem: QuoteLineItem = {
    id:          `qli-${Date.now()}`,
    description: input.description.trim() || "Quote",
    quantity:    1,
    unitPrice:   net,
    amount:      net,
    vatRate:     input.vatRate,
    vatAmount:   vat,
  };
  const quote: Quote = {
    id:            `q-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    quoteNumber:   nextQuoteNumber(),
    customerName:  input.customerName.trim(),
    customerEmail: input.customerEmail?.trim() || undefined,
    issueDate:     input.issueDate,
    expiresOn:     input.expiresOn || undefined,
    status:        "draft",
    lineItems:     [lineItem],
    notes:         input.notes?.trim() || undefined,
    createdAt:     now,
    updatedAt:     now,
  };
  safeWrite([...safeRead(), quote]);
  return quote;
}

export function setQuoteStatus(id: string, status: QuoteStatus): Quote | null {
  const items = safeRead();
  const idx = items.findIndex((q) => q.id === id);
  if (idx < 0) return null;
  items[idx] = { ...items[idx], status, updatedAt: new Date().toISOString() };
  safeWrite(items);
  return items[idx];
}

export function deleteQuote(id: string): void {
  safeWrite(safeRead().filter((q) => q.id !== id));
}

export function markConverted(id: string, invoiceId: string): Quote | null {
  const items = safeRead();
  const idx = items.findIndex((q) => q.id === id);
  if (idx < 0) return null;
  items[idx] = {
    ...items[idx],
    status: "converted",
    convertedToInvoiceId: invoiceId,
    updatedAt: new Date().toISOString(),
  };
  safeWrite(items);
  return items[idx];
}

// ── Totals helpers used by the UI ────────────────────────────────────────────

export function quoteNetTotal(q: Quote): number {
  return q.lineItems.reduce((s, li) => s + li.amount, 0);
}

export function quoteVatTotal(q: Quote): number {
  return q.lineItems.reduce((s, li) => s + (li.vatAmount ?? 0), 0);
}

export function quoteGrossTotal(q: Quote): number {
  return quoteNetTotal(q) + quoteVatTotal(q);
}

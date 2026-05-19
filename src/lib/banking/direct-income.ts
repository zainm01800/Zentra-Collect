/**
 * Direct income tags stored against bank-feed transactions.
 *
 * The bank feed auto-reconciles incoming payments against open invoices.
 * For credits that DON'T match any invoice (driving instructors, tutors,
 * tradespeople, anyone paid by bank transfer without raising an invoice)
 * the user can tag the transaction as "direct income" and have it counted
 * toward turnover for the Self-Assessment estimate.
 *
 * Storage: localStorage, keyed per active workspace where applicable.
 * Shape: array of TaggedIncome — one per tagged transaction.
 *
 * The income category is one of HMRC's standard turnover categories;
 * keep this short — the goal is "did this count as taxable income?" not
 * "what specific revenue line?".
 */

import * as serverActions from "@/actions/direct-income";

const STORAGE_KEY = "zentra.directIncome.v1";

export type IncomeCategory =
  | "services"      // most sole traders: lessons, consultancy, design, etc.
  | "products"
  | "rental"
  | "interest"
  | "other";

export interface TaggedIncome {
  /** TrueLayer transaction_id — uniquely identifies the bank txn */
  transactionId: string;
  amount:        number;          // GBP, positive
  date:          string;          // ISO date the transaction settled
  description:   string;          // bank-supplied description (truncated)
  category:      IncomeCategory;
  taggedAt:      string;          // ISO timestamp when the user tagged it
}

// ── Storage helpers ──────────────────────────────────────────────────────────

function safeRead(): TaggedIncome[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as TaggedIncome[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function safeWrite(items: TaggedIncome[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent("zentra:direct-income-change"));
  } catch {
    /* quota exceeded / SSR — silently swallow */
  }
}

export function readTaggedIncome(): TaggedIncome[] {
  return safeRead();
}

export function isTagged(transactionId: string): boolean {
  return safeRead().some((t) => t.transactionId === transactionId);
}

export function tagAsIncome(input: Omit<TaggedIncome, "taggedAt">): TaggedIncome {
  const items = safeRead();
  const existing = items.find((t) => t.transactionId === input.transactionId);
  if (existing) return existing;

  const next: TaggedIncome = { ...input, taggedAt: new Date().toISOString() };
  safeWrite([...items, next]);
  void serverActions.tagAsIncome({
    transactionId: input.transactionId,
    amount:        input.amount,
    date:          input.date,
    description:   input.description,
    category:      input.category,
  }).catch(() => { /* best-effort — local copy is enough */ });
  return next;
}

export function untagIncome(transactionId: string): void {
  const items = safeRead().filter((t) => t.transactionId !== transactionId);
  safeWrite(items);
  void serverActions.untagIncome(transactionId).catch(() => { /* best-effort */ });
}

export async function hydrateDirectIncomeFromServer(): Promise<void> {
  try {
    const items = await serverActions.getTaggedIncome();
    if (!Array.isArray(items) || items.length === 0) return;
    safeWrite(items);
  } catch { /* best-effort */ }
}

export async function pushLocalDirectIncomeToServer(): Promise<number> {
  const items = safeRead();
  if (!items.length) return 0;
  try {
    const r = await serverActions.bulkImportDirectIncome(items.map((t) => ({
      transactionId: t.transactionId,
      amount:        t.amount,
      date:          t.date,
      description:   t.description,
      category:      t.category,
    })));
    return r.inserted ?? 0;
  } catch { return 0; }
}

// ── Aggregates used elsewhere (P&L, tax estimate, dashboard hero) ───────────

/**
 * Total tagged income in a date range (inclusive). Defaults to the
 * current UK tax year (6 April → 5 April).
 */
export function totalTaggedIncome(opts?: { from?: Date; to?: Date }): number {
  const items = safeRead();
  if (!items.length) return 0;

  const { from, to } = opts ?? defaultTaxYearRange(new Date());
  const fromMs = from.getTime();
  const toMs = to.getTime();

  return items.reduce((sum, t) => {
    const ts = new Date(t.date).getTime();
    if (ts >= fromMs && ts <= toMs) return sum + t.amount;
    return sum;
  }, 0);
}

/** UK tax year that contains the given date — 6 Apr to 5 Apr the next year. */
export function defaultTaxYearRange(today: Date): { from: Date; to: Date } {
  const y = today.getFullYear();
  const startYear = today.getMonth() < 3 || (today.getMonth() === 3 && today.getDate() < 6)
    ? y - 1
    : y;
  const from = new Date(Date.UTC(startYear, 3, 6));        // 6 Apr 00:00 UTC
  const to   = new Date(Date.UTC(startYear + 1, 3, 5, 23, 59, 59));
  return { from, to };
}

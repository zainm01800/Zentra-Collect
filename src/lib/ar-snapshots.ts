/**
 * AR snapshot system — stores daily snapshots of AR data so trend charts
 * can show DSO and aging buckets changing over time.
 *
 * Snapshots are stored in localStorage under "zentra.arSnapshots.v1".
 * takeSnapshot() is called once per app load; it won't duplicate if one
 * already exists for today.
 *
 * Designed to be lightweight — each snapshot is < 500 bytes.
 */

import type { Invoice } from "@/types/zentra";

export interface ArSnapshot {
  date: string;          // YYYY-MM-DD
  dso: number;           // Days Sales Outstanding
  totalOutstanding: number;
  totalOverdue: number;
  buckets: {
    current: number;     // not yet due
    overdue_1_30: number;
    overdue_31_60: number;
    overdue_61_90: number;
    overdue_90plus: number;
  };
  invoiceCount: number;
  openCount: number;
}

const STORAGE_KEY = "zentra.arSnapshots.v1";
const MAX_SNAPSHOTS = 90; // keep up to 90 daily snapshots (~3 months)

export function readSnapshots(): ArSnapshot[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function writeSnapshots(snapshots: ArSnapshot[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshots));
  } catch { /* quota */ }
}

export function buildSnapshot(invoices: Invoice[]): ArSnapshot {
  const today = new Date().toISOString().slice(0, 10);
  const open = invoices.filter(
    (inv) => inv.status !== "paid" && inv.amountOutstanding > 0,
  );

  const totalOutstanding = open.reduce((s, inv) => s + inv.amountOutstanding, 0);
  const totalOverdue = open
    .filter((inv) => inv.daysOverdue > 0)
    .reduce((s, inv) => s + inv.amountOutstanding, 0);

  // DSO = (total AR / total annual revenue) * 365
  // Approximated as: average days outstanding weighted by amount
  let dso = 0;
  if (open.length > 0 && totalOutstanding > 0) {
    const weightedDays = open.reduce(
      (s, inv) => s + (inv.daysOverdue > 0 ? inv.daysOverdue : 0) * inv.amountOutstanding,
      0,
    );
    dso = Math.round(weightedDays / totalOutstanding);
  }

  const buckets = { current: 0, overdue_1_30: 0, overdue_31_60: 0, overdue_61_90: 0, overdue_90plus: 0 };
  for (const inv of open) {
    const d = inv.daysOverdue ?? 0;
    if (d <= 0)       buckets.current      += inv.amountOutstanding;
    else if (d <= 30)  buckets.overdue_1_30  += inv.amountOutstanding;
    else if (d <= 60)  buckets.overdue_31_60 += inv.amountOutstanding;
    else if (d <= 90)  buckets.overdue_61_90 += inv.amountOutstanding;
    else               buckets.overdue_90plus += inv.amountOutstanding;
  }

  return {
    date: today,
    dso,
    totalOutstanding,
    totalOverdue,
    buckets,
    invoiceCount: invoices.length,
    openCount: open.length,
  };
}

/** Take a snapshot for today (no-op if one already exists for today). */
export function takeSnapshot(invoices: Invoice[]): void {
  if (typeof window === "undefined") return;
  const today = new Date().toISOString().slice(0, 10);
  const snapshots = readSnapshots();
  if (snapshots.some((s) => s.date === today)) return; // already snapshotted today

  const snapshot = buildSnapshot(invoices);
  const updated = [snapshot, ...snapshots].slice(0, MAX_SNAPSHOTS);
  writeSnapshots(updated);
}

/** Get the most recent N snapshots sorted oldest → newest for charting. */
export function getRecentSnapshots(days: number = 30): ArSnapshot[] {
  const all = readSnapshots();
  return all
    .slice(0, days)
    .reverse(); // oldest first for charts
}

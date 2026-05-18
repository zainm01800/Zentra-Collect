"use client";

import { useMemo, useState } from "react";
import { Trash2, Plus } from "lucide-react";

const DAY_MS = 24 * 60 * 60 * 1000;

interface Row {
  id:        string;
  amount:    string;
  issueDate: string;
  paidDate:  string; // "" = still open
}

function newRow(): Row {
  return {
    id:        `row-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    amount:    "",
    issueDate: "",
    paidDate:  "",
  };
}

function fmtGBP(n: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency", currency: "GBP",
    maximumFractionDigits: 0,
  }).format(n);
}

export function DsoCalculatorClient() {
  const [rows, setRows] = useState<Row[]>(() => [
    { id: "demo-1", amount: "1500", issueDate: "2026-03-01", paidDate: "2026-03-28" },
    { id: "demo-2", amount: "2400", issueDate: "2026-03-15", paidDate: "2026-04-22" },
    { id: "demo-3", amount: "950",  issueDate: "2026-04-02", paidDate: "" },
    newRow(),
  ]);

  function update(id: string, field: keyof Row, value: string) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }
  function remove(id: string) {
    setRows((rs) => rs.filter((r) => r.id !== id));
  }
  function add() {
    setRows((rs) => [...rs, newRow()]);
  }

  const result = useMemo(() => {
    const now = Date.now();
    const valid = rows
      .map((r) => {
        const amount = parseFloat(r.amount);
        const issue = new Date(r.issueDate).getTime();
        const paid = r.paidDate ? new Date(r.paidDate).getTime() : NaN;
        if (!Number.isFinite(amount) || amount <= 0) return null;
        if (!Number.isFinite(issue)) return null;
        const endMs = Number.isFinite(paid) ? paid : now;
        const days = Math.max(0, Math.floor((endMs - issue) / DAY_MS));
        return { amount, days, open: !Number.isFinite(paid) };
      })
      .filter((r): r is { amount: number; days: number; open: boolean } => r !== null);

    if (valid.length === 0) return null;
    const totalRevenue = valid.reduce((s, r) => s + r.amount, 0);
    const weightedDays = valid.reduce((s, r) => s + r.days * r.amount, 0);
    const dso = weightedDays / totalRevenue;
    return {
      dso: Math.round(dso),
      sample: valid.length,
      totalRevenue,
      openCount: valid.filter((r) => r.open).length,
    };
  }, [rows]);

  // UK SMB benchmark: average DSO is around 41 days (Atradius / Allianz reports).
  const benchmark = (dso: number) => {
    if (dso <= 25) return { label: "Excellent", color: "var(--zn-safe)" };
    if (dso <= 35) return { label: "Healthy",   color: "var(--zn-safe)" };
    if (dso <= 50) return { label: "Average",   color: "var(--zn-ink-2)" };
    if (dso <= 70) return { label: "Slow",      color: "var(--zn-warn)" };
    return { label: "Critical", color: "var(--zn-risk)" };
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl overflow-hidden"
           style={{ background: "var(--zn-surface)", border: "1px solid var(--zn-line-soft)" }}>
        <div className="hidden sm:grid grid-cols-[1fr_1fr_1fr_40px] gap-2 px-4 py-2 text-[11px] uppercase tracking-wider"
             style={{ background: "var(--zn-bg-2)", color: "var(--zn-ink-3)" }}>
          <span>Amount (£)</span>
          <span>Issue date</span>
          <span>Paid date (blank if open)</span>
          <span></span>
        </div>
        {rows.map((r) => (
          <div key={r.id} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_40px] gap-2 px-4 py-2 border-t"
               style={{ borderColor: "var(--zn-line-soft)" }}>
            <input
              type="number" step="0.01" placeholder="1500.00"
              value={r.amount}
              onChange={(e) => update(r.id, "amount", e.target.value)}
              className="rounded-md px-2 py-1.5 text-[13.5px] border tabular-nums"
              style={{ borderColor: "var(--zn-line)" }}
            />
            <input
              type="date" value={r.issueDate}
              onChange={(e) => update(r.id, "issueDate", e.target.value)}
              className="rounded-md px-2 py-1.5 text-[13.5px] border"
              style={{ borderColor: "var(--zn-line)" }}
            />
            <input
              type="date" value={r.paidDate}
              onChange={(e) => update(r.id, "paidDate", e.target.value)}
              className="rounded-md px-2 py-1.5 text-[13.5px] border"
              style={{ borderColor: "var(--zn-line)" }}
            />
            <button
              type="button"
              onClick={() => remove(r.id)}
              aria-label="Remove row"
              className="p-1.5 rounded hover:bg-black/5"
              style={{ color: "var(--zn-ink-3)" }}
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={add}
          className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 text-[12.5px] font-medium border-t"
          style={{ borderColor: "var(--zn-line-soft)", color: "var(--zn-ink-2)" }}
        >
          <Plus className="size-3.5" />
          Add row
        </button>
      </div>

      {result && (
        <div className="rounded-xl p-5 space-y-3"
             style={{ background: "var(--zn-surface)", border: "1px solid var(--zn-line-soft)" }}>
          <div className="flex items-baseline justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider"
                  style={{ color: "var(--zn-ink-3)" }}>
              Your DSO (weighted average)
            </span>
            <span
              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wide"
              style={{
                background: "var(--zn-surface-2)",
                color: benchmark(result.dso).color,
              }}
            >
              {benchmark(result.dso).label}
            </span>
          </div>
          <p className="text-[36px] font-semibold tabular-nums leading-none"
             style={{ color: "var(--zn-ink)" }}>
            {result.dso} <span className="text-[16px]" style={{ color: "var(--zn-ink-3)" }}>days</span>
          </p>
          <p className="text-[12.5px]" style={{ color: "var(--zn-ink-3)" }}>
            Based on {result.sample} invoice{result.sample === 1 ? "" : "s"} ({fmtGBP(result.totalRevenue)} total revenue).
            {result.openCount > 0 && ` ${result.openCount} still open — counted to today.`}
          </p>
          <p className="text-[12px] pt-2 border-t" style={{ borderColor: "var(--zn-line-soft)", color: "var(--zn-ink-3)" }}>
            UK SMB benchmarks: under 25 days excellent · 25-35 healthy · 35-50 average · 50-70 slow · 70+ critical.
          </p>
        </div>
      )}
    </div>
  );
}

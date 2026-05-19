"use client";

import { Receipt } from "lucide-react";

const demoExpenses = [
  { id: "e-1",  date: "2026-05-12", description: "Adobe Creative Cloud",         category: "Software",       net: 49.99,  vat: 10.00, gross: 59.99 },
  { id: "e-2",  date: "2026-05-10", description: "Client lunch — BluePeak",      category: "Entertaining",   net: 68.00,  vat:  0.00, gross: 68.00 },
  { id: "e-3",  date: "2026-05-07", description: "Office supplies — Ryman",      category: "Office",         net: 24.50,  vat:  4.90, gross: 29.40 },
  { id: "e-4",  date: "2026-04-28", description: "Broadband — BT Business",      category: "Utilities",      net: 42.00,  vat:  8.40, gross: 50.40 },
  { id: "e-5",  date: "2026-04-22", description: "Train — London client visit",  category: "Travel",         net: 87.40,  vat:  0.00, gross: 87.40 },
  { id: "e-6",  date: "2026-04-18", description: "GitHub Pro",                   category: "Software",       net:  3.99,  vat:  0.80, gross:  4.79 },
  { id: "e-7",  date: "2026-04-15", description: "Printer ink cartridges",       category: "Office",         net: 31.20,  vat:  6.24, gross: 37.44 },
  { id: "e-8",  date: "2026-04-09", description: "Mobile phone bill",            category: "Utilities",      net: 35.00,  vat:  7.00, gross: 42.00 },
  { id: "e-9",  date: "2026-04-05", description: "Professional indemnity ins.",  category: "Insurance",      net: 220.00, vat:  0.00, gross: 220.00 },
  { id: "e-10", date: "2026-04-02", description: "Canva Pro subscription",        category: "Software",       net:  9.99,  vat:  2.00, gross: 11.99 },
];

const totalNet   = demoExpenses.reduce((s, e) => s + e.net,   0);
const totalVat   = demoExpenses.reduce((s, e) => s + e.vat,   0);
const totalGross = demoExpenses.reduce((s, e) => s + e.gross, 0);

const byCategory = demoExpenses.reduce<Record<string, number>>((acc, e) => {
  acc[e.category] = (acc[e.category] ?? 0) + e.net;
  return acc;
}, {});

function fmtGBP(n: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", minimumFractionDigits: 2 }).format(n);
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default function DemoExpensesPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="zn-section-label">Demo · Books</p>
        <h1 className="text-[28px] font-semibold tracking-[-0.02em] leading-[1.1] mt-1" style={{ color: "var(--zn-ink)" }}>
          Expenses
        </h1>
        <p className="mt-1 text-[13.5px]" style={{ color: "var(--zn-ink-3)" }}>
          Allowable business expenses · reduces your Self Assessment bill
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Total net"    value={fmtGBP(totalNet)} accent="var(--zn-accent)" />
        <Stat label="VAT reclaim"  value={fmtGBP(totalVat)} />
        <Stat label="Total gross"  value={fmtGBP(totalGross)} />
        <Stat label="Receipts"     value={`${demoExpenses.length}`} />
      </div>

      {/* By category */}
      <div className="zn-card px-5 py-4">
        <p className="text-[12px] font-semibold uppercase tracking-[0.07em] mb-3" style={{ color: "var(--zn-ink-3)" }}>By category</p>
        <div className="flex flex-wrap gap-2">
          {Object.entries(byCategory).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => (
            <div key={cat} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12.5px]"
                 style={{ background: "var(--zn-surface-2)", color: "var(--zn-ink-2)" }}>
              <span className="font-medium" style={{ color: "var(--zn-ink)" }}>{cat}</span>
              <span>{fmtGBP(amt)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Expense list */}
      <div className="zn-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b" style={{ borderColor: "var(--zn-line-soft)" }}>
          <p className="text-[13px] font-semibold" style={{ color: "var(--zn-ink)" }}>Recent expenses</p>
          <button type="button" disabled title="Disabled in demo — sign up to log real expenses"
                  className="zn-pill zn-pill-ghost opacity-50 cursor-not-allowed text-[12px]" style={{ height: 30 }}>
            <Receipt className="size-3.5" /> Add expense
          </button>
        </div>
        <div className="divide-y" style={{ borderColor: "var(--zn-line-soft)" }}>
          {demoExpenses.map((e) => (
            <div key={e.id} className="flex items-center gap-4 px-5 py-3">
              <div className="w-16 text-[11.5px] tabular-nums shrink-0" style={{ color: "var(--zn-ink-3)" }}>{fmtDate(e.date)}</div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium truncate" style={{ color: "var(--zn-ink)" }}>{e.description}</p>
                <p className="text-[11.5px]" style={{ color: "var(--zn-ink-3)" }}>{e.category}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[13px] font-semibold tabular-nums" style={{ color: "var(--zn-ink)" }}>{fmtGBP(e.gross)}</p>
                {e.vat > 0 && <p className="text-[11px] tabular-nums" style={{ color: "var(--zn-ink-3)" }}>+{fmtGBP(e.vat)} VAT</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="zn-card p-4">
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.07em]" style={{ color: "var(--zn-ink-3)" }}>{label}</p>
      <p className="mt-2 text-[22px] font-bold tabular-nums leading-none" style={{ color: accent ?? "var(--zn-ink)" }}>{value}</p>
    </div>
  );
}

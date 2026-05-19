"use client";

const months = ["Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May"];
const revenue =  [6200, 8400, 5900, 7100, 9200, 8800, 6400];
const expenses = [2100, 2800, 2200, 2600, 3100, 2900, 2200];
const profit   = revenue.map((r, i) => r - expenses[i]);

const totalRevenue  = revenue.reduce((s, v) => s + v, 0);
const totalExpenses = expenses.reduce((s, v) => s + v, 0);
const totalProfit   = totalRevenue - totalExpenses;
const margin        = Math.round((totalProfit / totalRevenue) * 100);

function fmtGBP(n: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", minimumFractionDigits: 0 }).format(n);
}

const maxVal = Math.max(...revenue);

export default function DemoPLPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="zn-section-label">Demo · Books</p>
        <h1 className="text-[28px] font-semibold tracking-[-0.02em] leading-[1.1] mt-1" style={{ color: "var(--zn-ink)" }}>
          Profit & Loss
        </h1>
        <p className="mt-1 text-[13.5px]" style={{ color: "var(--zn-ink-3)" }}>
          Tax year 2025/26 · Nov 2025 – May 2026
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Revenue"  value={fmtGBP(totalRevenue)} />
        <Stat label="Expenses" value={fmtGBP(totalExpenses)} />
        <Stat label="Net profit" value={fmtGBP(totalProfit)} accent="var(--zn-safe)" />
        <Stat label="Margin"   value={`${margin}%`} accent="var(--zn-accent)" />
      </div>

      {/* Bar chart */}
      <div className="zn-card px-5 py-4">
        <p className="text-[12px] font-semibold uppercase tracking-[0.07em] mb-4" style={{ color: "var(--zn-ink-3)" }}>
          Monthly overview
        </p>
        <div className="flex items-end gap-2 h-36">
          {months.map((m, i) => (
            <div key={m} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full flex flex-col justify-end gap-0.5" style={{ height: 120 }}>
                <div className="w-full rounded-t-sm" style={{
                  height: `${Math.round((revenue[i] / maxVal) * 100)}%`,
                  background: "var(--zn-accent)",
                  opacity: 0.25,
                }} />
                <div className="w-full rounded-t-sm" style={{
                  height: `${Math.round((profit[i] / maxVal) * 100)}%`,
                  background: "var(--zn-safe)",
                }} />
              </div>
              <p className="text-[10.5px]" style={{ color: "var(--zn-ink-3)" }}>{m}</p>
            </div>
          ))}
        </div>
        <div className="flex gap-4 mt-3">
          <div className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--zn-ink-3)" }}>
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: "var(--zn-accent)", opacity: 0.25 }} />Revenue
          </div>
          <div className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--zn-ink-3)" }}>
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: "var(--zn-safe)" }} />Profit
          </div>
        </div>
      </div>

      {/* Monthly table */}
      <div className="zn-card overflow-hidden">
        <div className="hidden sm:grid grid-cols-4 gap-4 px-5 py-2.5 border-b text-[11px] font-semibold uppercase tracking-[0.06em]"
             style={{ borderColor: "var(--zn-line-soft)", color: "var(--zn-ink-3)" }}>
          <span>Month</span><span className="text-right">Revenue</span><span className="text-right">Expenses</span><span className="text-right">Net</span>
        </div>
        <div className="divide-y" style={{ borderColor: "var(--zn-line-soft)" }}>
          {months.map((m, i) => (
            <div key={m} className="grid grid-cols-4 gap-4 px-5 py-3">
              <p className="text-[13px] font-medium" style={{ color: "var(--zn-ink)" }}>{m}</p>
              <p className="text-[13px] tabular-nums text-right" style={{ color: "var(--zn-ink-2)" }}>{fmtGBP(revenue[i])}</p>
              <p className="text-[13px] tabular-nums text-right" style={{ color: "var(--zn-ink-3)" }}>{fmtGBP(expenses[i])}</p>
              <p className="text-[13px] font-semibold tabular-nums text-right" style={{ color: "var(--zn-safe)" }}>{fmtGBP(profit[i])}</p>
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

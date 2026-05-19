"use client";

const demoInvoices = [
  { customer: "BluePeak Design",       amount: 8900,  status: "overdue",  daysOverdue: 64 },
  { customer: "Northline Creative",    amount: 6400,  status: "overdue",  daysOverdue: 63 },
  { customer: "Summit Ventures",       amount: 3600,  status: "overdue",  daysOverdue: 51 },
  { customer: "Clearview Recruitment", amount: 2180,  status: "paid",     daysOverdue: 0  },
  { customer: "Orchard HR Ltd",        amount: 1760,  status: "paid",     daysOverdue: 0  },
  { customer: "Greenstone Consulting", amount: 2680,  status: "disputed", daysOverdue: 42 },
];

const totalOutstanding = demoInvoices.filter(i => i.status === "overdue").reduce((s, i) => s + i.amount, 0);
const totalPaid        = demoInvoices.filter(i => i.status === "paid").reduce((s, i) => s + i.amount, 0);
const recoveryRate     = Math.round((totalPaid / (totalPaid + totalOutstanding)) * 100);

function fmtGBP(n: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", minimumFractionDigits: 0 }).format(n);
}

export default function DemoReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="zn-section-label">Demo · Collections</p>
        <h1 className="text-[28px] font-semibold tracking-[-0.02em] leading-[1.1] mt-1" style={{ color: "var(--zn-ink)" }}>
          Reports
        </h1>
        <p className="mt-1 text-[13.5px]" style={{ color: "var(--zn-ink-3)" }}>Last 90 days · Acme Studio Ltd</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Outstanding"   value={fmtGBP(totalOutstanding)} accent="var(--zn-risk)" />
        <Stat label="Collected"     value={fmtGBP(totalPaid)} accent="var(--zn-safe)" />
        <Stat label="Recovery rate" value={`${recoveryRate}%`} accent="var(--zn-accent)" />
        <Stat label="Chases sent"   value="14" />
      </div>

      {/* Aged debt bands */}
      <div className="zn-card overflow-hidden">
        <div className="px-5 py-3.5 border-b" style={{ borderColor: "var(--zn-line-soft)" }}>
          <p className="text-[13px] font-semibold" style={{ color: "var(--zn-ink)" }}>Aged debt summary</p>
        </div>
        {[
          { band: "0–30 days",  amount: 0,     count: 0 },
          { band: "31–60 days", amount: 2180,  count: 1 },
          { band: "61–90 days", amount: 15300, count: 2 },
          { band: "90+ days",   amount: 2680,  count: 1 },
        ].map((row) => (
          <div key={row.band} className="flex items-center gap-4 px-5 py-3 border-b last:border-0"
               style={{ borderColor: "var(--zn-line-soft)" }}>
            <p className="w-28 text-[12.5px]" style={{ color: "var(--zn-ink-3)" }}>{row.band}</p>
            <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "var(--zn-surface-2)" }}>
              <div className="h-full rounded-full" style={{
                width: `${Math.round((row.amount / 18160) * 100)}%`,
                background: row.amount > 10000 ? "var(--zn-risk)" : row.amount > 0 ? "var(--zn-warn)" : "var(--zn-safe)",
              }} />
            </div>
            <p className="w-20 text-right text-[13px] font-semibold tabular-nums" style={{ color: "var(--zn-ink)" }}>
              {row.amount > 0 ? fmtGBP(row.amount) : "—"}
            </p>
            <p className="w-16 text-right text-[11.5px]" style={{ color: "var(--zn-ink-3)" }}>
              {row.count > 0 ? `${row.count} inv.` : "—"}
            </p>
          </div>
        ))}
      </div>

      {/* Invoice list */}
      <div className="zn-card overflow-hidden">
        <div className="px-5 py-3.5 border-b" style={{ borderColor: "var(--zn-line-soft)" }}>
          <p className="text-[13px] font-semibold" style={{ color: "var(--zn-ink)" }}>Invoice breakdown</p>
        </div>
        <div className="divide-y" style={{ borderColor: "var(--zn-line-soft)" }}>
          {demoInvoices.map((inv, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium" style={{ color: "var(--zn-ink)" }}>{inv.customer}</p>
                {inv.daysOverdue > 0 && (
                  <p className="text-[11.5px]" style={{ color: "var(--zn-risk)" }}>{inv.daysOverdue} days overdue</p>
                )}
              </div>
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{
                background: inv.status === "paid" ? "var(--zn-safe-soft)" : inv.status === "disputed" ? "var(--zn-warn-soft)" : "var(--zn-risk-soft)",
                color: inv.status === "paid" ? "var(--zn-safe)" : inv.status === "disputed" ? "var(--zn-warn)" : "var(--zn-risk)",
              }}>
                {inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
              </span>
              <p className="text-[13px] font-semibold tabular-nums w-20 text-right" style={{ color: "var(--zn-ink)" }}>
                {fmtGBP(inv.amount)}
              </p>
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

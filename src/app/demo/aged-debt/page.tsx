"use client";

const demoAged = [
  { customer: "BluePeak Design",       inv: "BB-2154", amount: 8900,  days: 64, status: "overdue"  },
  { customer: "Northline Creative",    inv: "ACM-1009",amount: 6400,  days: 63, status: "overdue"  },
  { customer: "Summit Ventures",       inv: "RC-5102", amount: 3600,  days: 51, status: "overdue"  },
  { customer: "Greenstone Consulting", inv: "ACM-1015",amount: 2680,  days: 42, status: "disputed" },
  { customer: "Clearview Recruitment", inv: "BB-2188", amount: 2180,  days: 50, status: "overdue"  },
  { customer: "Orchard HR Ltd",        inv: "FFC-4107",amount: 1760,  days: 20, status: "overdue"  },
  { customer: "Delta Media",           inv: "DM-0031", amount: 4200,  days: 7,  status: "chased"   },
  { customer: "Pinnacle Events",       inv: "PE-118",  amount: 1100,  days: 3,  status: "chased"   },
];

function fmtGBP(n: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", minimumFractionDigits: 0 }).format(n);
}

const total = demoAged.reduce((s, i) => s + i.amount, 0);
const oldest = Math.max(...demoAged.map(i => i.days));

export default function DemoAgedDebtPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="zn-section-label">Demo · Collections</p>
        <h1 className="text-[28px] font-semibold tracking-[-0.02em] leading-[1.1] mt-1" style={{ color: "var(--zn-ink)" }}>
          Aged debt
        </h1>
        <p className="mt-1 text-[13.5px]" style={{ color: "var(--zn-ink-3)" }}>All open invoices sorted by age · Acme Studio Ltd</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Total open"    value={fmtGBP(total)} accent="var(--zn-risk)" />
        <Stat label="Open invoices" value={`${demoAged.length}`} />
        <Stat label="Oldest"        value={`${oldest} days`} accent="var(--zn-risk)" />
        <Stat label="Disputed"      value="1" />
      </div>

      <div className="zn-card overflow-hidden">
        <div className="hidden sm:grid grid-cols-[2fr_1fr_80px_90px_100px] gap-4 px-5 py-2.5 border-b text-[11px] font-semibold uppercase tracking-[0.06em]"
             style={{ borderColor: "var(--zn-line-soft)", color: "var(--zn-ink-3)" }}>
          <span>Customer / Invoice</span><span>Days</span><span>Status</span><span className="text-right">Amount</span><span />
        </div>
        <div className="divide-y" style={{ borderColor: "var(--zn-line-soft)" }}>
          {demoAged.map((inv) => (
            <div key={inv.inv} className="flex sm:grid sm:grid-cols-[2fr_1fr_80px_90px_100px] items-center gap-4 px-5 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium" style={{ color: "var(--zn-ink)" }}>{inv.customer}</p>
                <p className="text-[11.5px]" style={{ color: "var(--zn-ink-3)" }}>{inv.inv}</p>
              </div>
              <p className="text-[13px] tabular-nums hidden sm:block"
                 style={{ color: inv.days > 30 ? "var(--zn-risk)" : "var(--zn-ink-3)" }}>
                {inv.days}d
              </p>
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap hidden sm:inline-flex" style={{
                background: inv.status === "disputed" ? "var(--zn-warn-soft)" : inv.status === "chased" ? "var(--zn-surface-2)" : "var(--zn-risk-soft)",
                color: inv.status === "disputed" ? "var(--zn-warn)" : inv.status === "chased" ? "var(--zn-ink-3)" : "var(--zn-risk)",
              }}>
                {inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
              </span>
              <p className="text-[13px] font-semibold tabular-nums text-right" style={{ color: "var(--zn-ink)" }}>
                {fmtGBP(inv.amount)}
              </p>
              <div className="hidden sm:flex justify-end">
                <button disabled className="zn-pill zn-pill-ghost opacity-40 cursor-not-allowed text-[11.5px]" style={{ height: 28 }}>
                  Chase
                </button>
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

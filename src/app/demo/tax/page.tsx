"use client";

import { useState } from "react";
import { Check, Copy, ChevronDown, ChevronRight } from "lucide-react";
import {
  demoMileageTrips,
  demoCreditNotes,
  demoDirectIncome,
} from "@/lib/demo-data/demo-books-data";
import { DEMO_EXPENSES_TOTALS, BASE_EXPENSES } from "@/lib/demo-data/demo-expenses-data";
import { calcMileageAllowance } from "@/lib/mileage";
import { estimateUkSelfEmployedTax } from "@/lib/tax/uk-self-employed";

// ── helpers ───────────────────────────────────────────────────────────────────
function fmtGBP(n: number) {
  return (
    "£" +
    Math.abs(n).toLocaleString("en-GB", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}
function fmtRound(n: number) {
  return "£" + Math.round(Math.abs(n)).toLocaleString("en-GB");
}

const T = {
  bg:     "#FAF7F2",
  card:   "#FFFFFF",
  ink:    "#1A1916",
  ink2:   "#374151",
  muted:  "#8A8680",
  border: "rgba(0,0,0,0.08)",
  green:  "#16A34A",
  amber:  "#C28800",
  red:    "#DC2626",
  blue:   "#2563EB",
  greenBg:"#F0FDF4",
  amberBg:"#FFFBEB",
  blueBg: "#EFF6FF",
  surface:"#F4F4F5",
};

// ── computed values ───────────────────────────────────────────────────────────
const DEMO_INVOICED_INCOME = 38_400;
const DEMO_INVOICED_VAT    = 7_680;
const directIncomeTotal    = demoDirectIncome.reduce((s, d) => s + d.amount, 0);
const totalMiles           = demoMileageTrips.reduce((s, t) => s + t.miles, 0);
const mileageAllowance     = calcMileageAllowance(totalMiles).allowance;
const creditedNet          = demoCreditNotes.reduce((s, c) => s + c.amountNet, 0);
const creditedVat          = demoCreditNotes.reduce((s, c) => s + c.vatAmount, 0);
const income               = Math.max(0, DEMO_INVOICED_INCOME + directIncomeTotal - creditedNet);
const expenses             = DEMO_EXPENSES_TOTALS.totalAllowNet + mileageAllowance;
const vatOutput            = DEMO_INVOICED_VAT - creditedVat;
const vatReclaimable       = DEMO_EXPENSES_TOTALS.totalConfirmedVat;
const vatPayable           = Math.max(0, vatOutput - vatReclaimable);
const vatRate              = vatOutput > 0 ? Math.round((vatPayable / income) * 100 * 10) / 10 : 0;

// ── sub-components ────────────────────────────────────────────────────────────
function KpiCard({
  label, value, sub, color,
}: {
  label: string; value: string; sub?: string; color?: string;
}) {
  return (
    <div style={{
      background: T.card, border: `1px solid ${T.border}`, borderRadius: 10,
      padding: "18px 20px",
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: T.muted, marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.01em", fontVariantNumeric: "tabular-nums", color: color ?? T.ink }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: T.muted, marginTop: 5, lineHeight: 1.4 }}>{sub}</div>
      )}
    </div>
  );
}

function BreakdownSection({
  name, items, total, link, onLink,
}: {
  name: string;
  items: { desc: string; amount: number }[];
  total: number;
  link?: string;
  onLink?: () => void;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div style={{ borderBottom: `1px solid ${T.border}` }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "13px 18px", background: "transparent", border: 0, cursor: "pointer", textAlign: "left",
          fontFamily: "inherit",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {open ? <ChevronDown size={14} color={T.muted} /> : <ChevronRight size={14} color={T.muted} />}
          <span style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>{name}</span>
        </div>
        <span style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: T.ink }}>
          {fmtGBP(total)}
        </span>
      </button>
      {open && (
        <div style={{ padding: "0 18px 14px 40px" }}>
          {items.map((i, idx) => (
            <div key={idx} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "6px 0", borderBottom: idx < items.length - 1 ? `1px solid ${T.border}` : "none",
            }}>
              <span style={{ fontSize: 12.5, color: T.ink2 }}>{i.desc}</span>
              <span style={{ fontSize: 12.5, fontVariantNumeric: "tabular-nums", color: T.ink }}>{fmtGBP(i.amount)}</span>
            </div>
          ))}
          {link && (
            <button
              onClick={onLink}
              style={{ marginTop: 10, fontSize: 12, color: T.blue, background: "none", border: 0, cursor: "pointer", padding: 0 }}
            >
              {link} →
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function DemoTaxPage() {
  const [copiedBox, setCopiedBox] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const estimate = estimateUkSelfEmployedTax({ income, expenses }, "2026/27");

  function copyVal(box: string, value: number) {
    const str = Math.abs(value).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    navigator.clipboard.writeText(str).catch(() => {});
    setCopiedBox(box);
    setTimeout(() => setCopiedBox((c) => (c === box ? null : c)), 1500);
    setToast(`Box ${box} copied to clipboard`);
    setTimeout(() => setToast(null), 2000);
  }

  // Income items for breakdown
  const incomeItems = [
    { desc: `Invoiced income (8 invoices)`, amount: DEMO_INVOICED_INCOME },
    { desc: `Direct income (${demoDirectIncome.length} bank-tagged transactions)`, amount: directIncomeTotal },
    { desc: `Credit notes issued (${demoCreditNotes.length})`, amount: -creditedNet },
  ];

  // Expense categories
  const catTotals: Record<string, number> = {};
  for (const e of BASE_EXPENSES) {
    const net = e.vatLines.reduce((s, l) => s + l.net, 0);
    catTotals[e.category] = (catTotals[e.category] ?? 0) + net;
  }
  const expenseItems = Object.entries(catTotals).map(([cat, amt]) => ({ desc: cat, amount: amt }));
  expenseItems.push({ desc: `Mileage allowance (${totalMiles} mi × 45p HMRC rate)`, amount: mileageAllowance });

  const sa103 = [
    { box: "9",  label: "Turnover",             subLabel: "Total invoiced + direct income, less credit notes", value: income },
    { box: "17", label: "Total allowable expenses", subLabel: "Business expenses + mileage allowance",         value: expenses },
    { box: "18", label: "Net profit / (loss)",   subLabel: "Box 9 minus Box 17",                               value: Math.max(0, estimate.netProfit) },
    { box: "27", label: "Total tax due (estimated)", subLabel: "Net profit × 20% basic rate (after personal allowance)", value: estimate.estimatedTaxOwed },
  ];

  return (
    <div>
      {/* Page header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-0.01em", color: T.ink, margin: 0 }}>
            Tax estimate — 2026/27
          </h1>
          <div style={{ marginTop: 6, display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 13, color: T.muted }}>Self-employment · estimate only · sample data</span>
            <span style={{ fontSize: 11, borderRadius: 4, padding: "2px 8px", background: T.amberBg, color: T.amber, fontWeight: 600 }}>
              Not financial advice
            </span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <button style={{
            height: 34, padding: "0 14px", borderRadius: 8, border: `1px solid ${T.border}`,
            background: T.card, fontSize: 13, fontWeight: 500, color: T.ink2, cursor: "pointer", fontFamily: "inherit",
          }}>
            Download PDF
          </button>
          <button style={{
            height: 34, padding: "0 14px", borderRadius: 999, border: "none",
            background: T.ink, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
          }}>
            Send to accountant
          </button>
        </div>
      </div>

      {/* KPI row 1: Income, Expenses, Net profit */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
        <KpiCard label="Total income" value={fmtRound(income)} sub="Invoiced + direct − credit notes" />
        <KpiCard label="Business expenses" value={fmtRound(expenses)} sub="Expenses + mileage allowance" />
        <KpiCard label="Net profit" value={fmtRound(estimate.netProfit)} sub="Profit before tax" color={T.green} />
      </div>

      {/* KPI row 2: Tax, VAT reclaimable, VAT to pay */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 24 }}>
        <KpiCard label="Est. tax owed" value={fmtRound(estimate.estimatedTaxOwed)} sub="@ 20% basic rate · payable Jan 2028" color={T.amber} />
        <KpiCard label="VAT reclaimable" value={fmtRound(vatReclaimable)} sub="Input VAT from expenses" color={T.blue} />
        <KpiCard label="VAT to pay HMRC" value={fmtRound(vatPayable)} sub="Net of reclaimable" />
      </div>

      {/* Income breakdown */}
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, marginBottom: 14, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderBottom: `1px solid ${T.border}` }}>
          <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: T.ink }}>Income breakdown</h2>
          <span style={{ fontSize: 12, color: T.muted }}>Total {fmtGBP(income)}</span>
        </div>
        <BreakdownSection
          name="Invoiced income"
          items={incomeItems.slice(0, 1)}
          total={DEMO_INVOICED_INCOME}
          link="View invoices"
        />
        <BreakdownSection
          name="Direct income"
          items={demoDirectIncome.map((d) => ({ desc: d.description, amount: d.amount }))}
          total={directIncomeTotal}
          link="View bank feed"
        />
        {creditedNet > 0 && (
          <BreakdownSection
            name="Credit notes issued"
            items={demoCreditNotes.map((c) => ({ desc: c.reason, amount: c.amountNet }))}
            total={-creditedNet}
            link="View credit notes"
          />
        )}
      </div>

      {/* Expenses breakdown */}
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, marginBottom: 14, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderBottom: `1px solid ${T.border}` }}>
          <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: T.ink }}>Expenses breakdown</h2>
          <span style={{ fontSize: 12, color: T.muted }}>Total {fmtGBP(expenses)}</span>
        </div>
        <BreakdownSection
          name="Tracked expenses"
          items={expenseItems.filter((e) => !e.desc.startsWith("Mileage"))}
          total={DEMO_EXPENSES_TOTALS.totalAllowNet}
          link="View expenses"
        />
        <BreakdownSection
          name="Mileage allowance"
          items={[{ desc: `${totalMiles} miles × 45p/mi (HMRC AMAP rate)`, amount: mileageAllowance }]}
          total={mileageAllowance}
          link="View mileage log"
        />
      </div>

      {/* SA103S */}
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, marginBottom: 14, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderBottom: `1px solid ${T.border}` }}>
          <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: T.ink }}>SA103S — Short Self-Employment pages</h2>
          <span style={{ fontSize: 12, color: T.muted }}>Self Assessment 2026/27</span>
        </div>
        {sa103.map((row, i) => (
          <div key={row.box} style={{
            display: "grid", gridTemplateColumns: "52px 1fr auto auto", alignItems: "center", gap: 16,
            padding: "14px 18px",
            borderBottom: i < sa103.length - 1 ? `1px solid ${T.border}` : "none",
          }}>
            <span style={{
              fontSize: 10.5, fontWeight: 700, color: T.muted, background: T.surface,
              border: `1px solid ${T.border}`, borderRadius: 5, padding: "3px 7px", textAlign: "center",
            }}>
              Box {row.box}
            </span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: T.ink2 }}>{row.label}</div>
              <div style={{ fontSize: 11, color: T.muted, marginTop: 1 }}>{row.subLabel}</div>
            </div>
            <div style={{
              fontSize: 14, fontWeight: 700, fontVariantNumeric: "tabular-nums",
              color: row.box === "18" ? T.green : row.box === "27" ? T.amber : T.ink,
            }}>
              {fmtGBP(row.value)}
            </div>
            <button
              onClick={() => copyVal(row.box, row.value)}
              title="Copy value"
              style={{
                width: 28, height: 28, borderRadius: 6, border: `1px solid ${T.border}`,
                background: copiedBox === row.box ? T.greenBg : T.card,
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                color: copiedBox === row.box ? T.green : T.muted, transition: "all 0.15s",
              }}
            >
              {copiedBox === row.box ? <Check size={13} /> : <Copy size={13} />}
            </button>
          </div>
        ))}
      </div>

      {/* VAT return */}
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, marginBottom: 20, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderBottom: `1px solid ${T.border}` }}>
          <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: T.ink }}>VAT return estimate</h2>
          <span style={{ fontSize: 12, color: T.muted }}>Quarterly · MTD-compatible</span>
        </div>
        {[
          { name: "Output VAT", sub: "20% of total income", amt: vatOutput, color: T.blue, sign: "" },
          { name: "Input VAT (reclaimable)", sub: "From expenses with receipts", amt: vatReclaimable, color: T.blue, sign: "−" },
          { name: "VAT payable", sub: `To HMRC by 7 Aug 2026`, amt: vatPayable, color: T.ink, sign: "" },
          { name: "Effective rate", sub: "Payable as % of turnover", amt: null, color: T.muted, sign: "", text: `${vatRate}%` },
        ].map((row, i, arr) => (
          <div key={row.name} style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "12px 18px",
            borderBottom: i < arr.length - 1 ? `1px solid ${T.border}` : "none",
          }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: T.ink }}>{row.name}</div>
              <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{row.sub}</div>
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: row.color }}>
              {row.text ?? `${row.sign}${fmtGBP(row.amt ?? 0)}`}
            </div>
          </div>
        ))}
        <div style={{ padding: "10px 18px", borderTop: `1px solid ${T.border}`, fontSize: 11.5, color: T.muted, lineHeight: 1.5 }}>
          VAT return estimates are for planning purposes only. Figures vary based on scheme, partial exemption, and capital goods adjustments. Always confirm with your accountant or HMRC online account.
        </div>
      </div>

      {/* Disclaimer */}
      <div style={{
        padding: "10px 14px", borderRadius: 8, fontSize: 11.5,
        background: T.amberBg, color: T.amber, lineHeight: 1.5,
      }}>
        Estimate only. Zentra is not a regulated accounting service. File via HMRC or hand these figures to your accountant.
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 32, left: "50%", transform: "translateX(-50%)",
          background: T.ink, color: "#fff", borderRadius: 999,
          padding: "8px 16px", fontSize: 13, fontWeight: 500,
          display: "flex", alignItems: "center", gap: 8, zIndex: 1000,
          boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
        }}>
          <Check size={13} color="#fff" />
          {toast}
        </div>
      )}
    </div>
  );
}

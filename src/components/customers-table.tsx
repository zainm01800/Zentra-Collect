"use client";

import { useReview } from "@/components/review-context";
import { formatCurrency } from "@/lib/formatters";
import type { Invoice } from "@/types/cashpilot";

export type CustomerRow = {
  name: string;
  outstanding: number;
  invoiceCount: number;
  oldest: number;
  risk: "low" | "med" | "high";
};

const RISK_LABEL: Record<CustomerRow["risk"], string> = {
  low: "Low risk",
  med: "Medium risk",
  high: "High risk",
};

/**
 * CustomersTable — client component with row click → opens the review drawer
 * for the customer's most pressing invoice (their oldest overdue).
 */
export function CustomersTable({
  rows,
  invoices,
}: {
  rows: CustomerRow[];
  invoices: Invoice[];
}) {
  const review = useReview();

  function openMostPressing(customerName: string) {
    const inv = invoices
      .filter((i) => i.customerName === customerName && i.status !== "Paid")
      .sort((a, b) => (b.daysOverdue ?? 0) - (a.daysOverdue ?? 0))[0];
    if (inv) review.open(inv);
  }

  return (
    <table
      className="border-collapse"
      style={{ tableLayout: "fixed", width: "100%", minWidth: 720 }}
    >
      <thead>
        <tr>
          <th className="zn-label text-left" style={{ padding: "12px 22px" }}>Customer</th>
          <th className="zn-label text-left" style={{ padding: "12px 10px", width: 130 }}>Outstanding</th>
          <th className="zn-label text-left" style={{ padding: "12px 10px", width: 100 }}>Invoices</th>
          <th className="zn-label text-left" style={{ padding: "12px 10px", width: 110 }}>Oldest</th>
          <th className="zn-label text-left" style={{ padding: "12px 22px", width: 130 }}>Risk</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr
            key={r.name}
            onClick={() => openMostPressing(r.name)}
            className="transition-colors hover:bg-[#f3ecd8] cursor-pointer"
            style={{ borderTop: "1px solid var(--zn-line-soft)" }}
          >
            <td style={{ padding: "14px 22px" }}>
              <div className="flex items-center gap-3">
                <span
                  className="size-7 rounded-lg flex items-center justify-center text-[11px] font-semibold flex-shrink-0"
                  style={{ background: "var(--zn-accent)", color: "var(--zn-accent-ink)" }}
                >
                  {r.name.split(" ").slice(0, 2).map((p) => p[0]).join("").toUpperCase()}
                </span>
                <span className="text-[13.5px] font-semibold text-[#1d1813]">{r.name}</span>
              </div>
            </td>
            <td className="text-[13px] font-medium tabular-nums" style={{ padding: "14px 10px", color: "var(--zn-ink)" }}>
              {formatCurrency(r.outstanding)}
            </td>
            <td className="text-[12.5px]" style={{ padding: "14px 10px", color: "var(--zn-ink-3)" }}>
              {r.invoiceCount}
            </td>
            <td style={{ padding: "14px 10px" }}>
              {r.oldest > 0 ? (
                <span
                  className="text-[12.5px] font-semibold"
                  style={{
                    color:
                      r.oldest > 60 ? "var(--zn-risk)" :
                      r.oldest > 30 ? "var(--zn-warn)" :
                                     "var(--zn-ink-2)",
                  }}
                >
                  {r.oldest}d
                </span>
              ) : (
                <span className="text-[12px]" style={{ color: "var(--zn-ink-3)" }}>not due</span>
              )}
            </td>
            <td style={{ padding: "14px 22px" }}>
              <span
                className={`zn-risk-chip ${
                  r.risk === "high" ? "zn-risk-high" :
                  r.risk === "med"  ? "zn-risk-med"  :
                                      "zn-risk-low"
                }`}
              >
                <span className="zn-risk-dot" />
                {RISK_LABEL[r.risk]}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

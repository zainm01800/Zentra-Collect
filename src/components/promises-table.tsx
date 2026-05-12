"use client";

import { useReview } from "@/components/review-context";
import { formatCurrency } from "@/lib/formatters";
import type { Invoice } from "@/types/cashpilot";

export type PromiseRow = {
  id: string;
  customerName: string;
  invoiceNumber: string;
  amount: number;
  promisedFor: string; // ISO
  channel: "Email" | "Call";
  status: "due" | "kept" | "missed";
};

export function PromisesTable({
  rows,
  invoices,
}: {
  rows: PromiseRow[];
  invoices: Invoice[];
}) {
  const review = useReview();

  function openReview(invoiceId: string) {
    const inv = invoices.find((i) => i.id === invoiceId);
    if (inv) review.open(inv);
  }

  return (
    <table className="border-collapse" style={{ width: "100%", minWidth: 760 }}>
      <thead>
        <tr>
          <th className="zn-label text-left" style={{ padding: "12px 22px" }}>Customer</th>
          <th className="zn-label text-left" style={{ padding: "12px 10px" }}>Invoice</th>
          <th className="zn-label text-left" style={{ padding: "12px 10px" }}>Promised</th>
          <th className="zn-label text-left" style={{ padding: "12px 10px" }}>Channel</th>
          <th className="zn-label text-left" style={{ padding: "12px 10px" }}>Amount</th>
          <th className="zn-label text-left" style={{ padding: "12px 22px" }}>Status</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((p) => (
          <tr
            key={p.id}
            onClick={() => openReview(p.id)}
            style={{ borderTop: "1px solid var(--zn-line-soft)" }}
            className="hover:bg-[#f3ecd8] dark:hover:bg-[#2d2820] transition-colors cursor-pointer"
          >
            <td className="text-[13px] font-semibold" style={{ padding: "14px 22px" }}>
              {p.customerName}
            </td>
            <td className="zn-kind-tag" style={{ padding: "14px 10px" }}>
              {p.invoiceNumber}
            </td>
            <td className="text-[12.5px]" style={{ padding: "14px 10px", color: "var(--zn-ink-3)" }}>
              {new Date(p.promisedFor).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
            </td>
            <td style={{ padding: "14px 10px" }}>
              <span className="zn-chip">{p.channel}</span>
            </td>
            <td className="text-[13px] font-semibold tabular-nums" style={{ padding: "14px 10px" }}>
              {formatCurrency(p.amount)}
            </td>
            <td style={{ padding: "14px 22px" }}>
              <span
                className={`zn-risk-chip ${
                  p.status === "missed" ? "zn-risk-high" :
                  p.status === "kept"   ? "zn-risk-low"  :
                                          "zn-risk-med"
                }`}
              >
                <span className="zn-risk-dot" />
                {p.status === "missed" ? "Missed" : p.status === "kept" ? "Kept" : "Due"}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

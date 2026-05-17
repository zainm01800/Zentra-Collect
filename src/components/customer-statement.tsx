"use client";

/**
 * src/components/customer-statement.tsx
 *
 * Printable statement of account for a single customer.
 * Shows all open invoices with totals and a clear summary.
 * Designed for screen + @media print (browser PDF save).
 */

import { useEffect, useMemo, useState } from "react";
import { Printer } from "lucide-react";
import { demoCustomers, demoInvoices } from "@/lib/demo-data/zentra-demo-data";
import { demoSingleBusiness } from "@/lib/demo-data/zentra-demo-data";
import { readLocalAccount } from "@/lib/demo-auth";
import { importedInvoicesStorageKey } from "@/lib/import/zentra-import";
import {
  readActiveClientId,
  clientInvoicesKey,
} from "@/lib/bookkeeper-clients";
import type { Invoice as ZentraInvoice } from "@/types/zentra";

const BOOKKEEPER_PLAN_IDS = ["bookkeeper_starter", "bookkeeper_pro"];

function resolveInvoiceKey(planId: string): string {
  if (BOOKKEEPER_PLAN_IDS.includes(planId)) {
    const activeClientId = readActiveClientId();
    if (activeClientId && activeClientId !== "all") {
      return clientInvoicesKey(activeClientId);
    }
  }
  return importedInvoicesStorageKey;
}

function readRealInvoices(planId: string): ZentraInvoice[] {
  if (typeof window === "undefined") return [];
  const key = resolveInvoiceKey(planId);
  const stored = window.localStorage.getItem(key);
  if (!stored) return [];
  try {
    const parsed = JSON.parse(stored) as ZentraInvoice[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function fmtGBP(n: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

interface StatementInvoice {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate?: string;
  amount: number;
  amountOutstanding: number;
  daysOverdue: number;
  status: string;
}

export function CustomerStatement({ customerId }: { customerId: string }) {
  // Account state, loaded on mount.
  const [localAccount, setLocalAccount] = useState<ReturnType<typeof readLocalAccount>>(null);

  useEffect(() => {
    setLocalAccount(readLocalAccount());
  }, []);

  const isDemo = localAccount?.planId === "demo";

  // ── Resolve customer + invoices for both demo and real-user paths ─────────
  const data = useMemo(() => {
    if (!localAccount) return null;

    if (isDemo) {
      const customer = demoCustomers.find((c) => c.id === customerId);
      if (!customer) return { notFound: true } as const;
      const all = demoInvoices.filter((i) => i.customerId === customerId);
      return {
        customer: {
          name: customer.name,
          contactName: customer.contactName,
          contactRole: customer.contactRole,
          apEmail: customer.apEmail,
        },
        invoices: all,
        business: {
          name: demoSingleBusiness.name,
          tradingName: demoSingleBusiness.tradingName,
          replyToEmail: demoSingleBusiness.replyToEmail,
        },
      };
    }

    // ── Real-user path ──────────────────────────────────────────────────────
    const realInvoices = readRealInvoices(localAccount.planId);
    const matchingInvoices = realInvoices.filter((i) => i.customerId === customerId);
    if (matchingInvoices.length === 0) return { notFound: true } as const;

    // Derive customer info from the imported invoices (real users don't have
    // a separate customer record — just the rows from their CSV).
    const customerName = matchingInvoices[0].customerName;
    const customerEmail = matchingInvoices[0].customerEmail;
    const contactRole = matchingInvoices[0].customerContactRole;

    return {
      customer: {
        name: customerName,
        contactName: undefined,
        contactRole,
        apEmail: customerEmail,
      },
      invoices: matchingInvoices,
      business: {
        name: localAccount.businessName || localAccount.name || "Your business",
        tradingName: undefined,
        replyToEmail: localAccount.email,
      },
    };
  }, [localAccount, isDemo, customerId]);

  if (!localAccount) {
    return (
      <div className="py-16 text-center text-[14px]" style={{ color: "var(--zn-ink-3)" }}>
        Loading statement…
      </div>
    );
  }

  if (!data || ("notFound" in data && data.notFound)) {
    return (
      <div className="py-16 text-center text-[14px]" style={{ color: "var(--zn-ink-3)" }}>
        {isDemo
          ? "Customer not found."
          : "No imported invoices for this customer. Import an AR export to generate a statement."}
      </div>
    );
  }

  const customer = data.customer;
  const all = data.invoices;
  const business = data.business;

  const open: StatementInvoice[] = all
    .filter((i) => (i.status as string).toLowerCase() !== "paid" && (i.amountOutstanding ?? 0) > 0)
    .map((i) => ({
      id: i.id,
      invoiceNumber: i.invoiceNumber,
      invoiceDate: i.invoiceDate,
      dueDate: i.dueDate ?? undefined,
      amount: i.amount,
      amountOutstanding: i.amountOutstanding ?? i.amount,
      daysOverdue: i.daysOverdue,
      status: i.status as string,
    }))
    .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));

  const totalOutstanding = open.reduce((s, i) => s + i.amountOutstanding, 0);
  const overdueInvoices = open.filter((i) => i.daysOverdue > 0);
  const totalOverdue = overdueInvoices.reduce((s, i) => s + i.amountOutstanding, 0);

  return (
    <div>
      {/* Print + Email statement — hidden in print */}
      <div className="flex justify-end gap-2 mb-6 print:hidden">
        <button
          type="button"
          onClick={() => {
            const ap = customer.apEmail ?? "";
            const subject = `Statement of account — ${customer.name}`;
            const body =
              `Hi ${customer.name},\n\n` +
              `Please find attached / linked our current statement of account showing ${overdueInvoices.length} overdue invoice(s) totalling £${totalOverdue.toLocaleString("en-GB", { minimumFractionDigits: 2 })}.\n\n` +
              `Could you confirm when these will be settled?\n\n` +
              `Statement: ${typeof window !== "undefined" ? window.location.href : ""}\n\n` +
              `Thanks,`;
            const href = `mailto:${encodeURIComponent(ap)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
            window.location.href = href;
          }}
          className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-medium border transition-colors hover:bg-[#ece3cc] dark:hover:bg-[#28231c]"
          style={{ borderColor: "var(--zn-line)", color: "var(--zn-ink-2)" }}
        >
          Email statement
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-medium border transition-colors hover:bg-[#ece3cc] dark:hover:bg-[#28231c]"
          style={{ borderColor: "var(--zn-line)", color: "var(--zn-ink-2)" }}
        >
          <Printer className="size-3.5" />
          Print / Save PDF
        </button>
      </div>

      {/* Statement card */}
      <div
        className="rounded-[16px] overflow-hidden print:rounded-none print:shadow-none"
        style={{
          background: "var(--zn-surface)",
          border: "1px solid var(--zn-line-soft)",
          printColorAdjust: "exact",
        } as React.CSSProperties}
      >
        {/* Header */}
        <div
          className="px-8 py-7"
          style={{ borderBottom: "1px solid var(--zn-line-soft)" }}
        >
          <div className="flex items-start justify-between gap-6">
            <div>
              <p className="text-[22px] font-semibold tracking-tight" style={{ color: "var(--zn-ink)" }}>
                Statement of Account
              </p>
              <p className="mt-1 text-[13px]" style={{ color: "var(--zn-ink-3)" }}>
                Prepared {fmtDate(todayISO())}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[15px] font-semibold" style={{ color: "var(--zn-ink)" }}>
                {business.tradingName ?? business.name}
              </p>
              <p className="text-[12.5px] mt-0.5" style={{ color: "var(--zn-ink-3)" }}>
                {business.replyToEmail}
              </p>
            </div>
          </div>

          <div className="mt-6 pt-5" style={{ borderTop: "1px solid var(--zn-line-soft)" }}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] mb-1" style={{ color: "var(--zn-ink-3)" }}>
              To
            </p>
            <p className="text-[16px] font-semibold" style={{ color: "var(--zn-ink)" }}>
              {customer.name}
            </p>
            {customer.contactName && (
              <p className="text-[13px] mt-0.5" style={{ color: "var(--zn-ink-2)" }}>
                Attn: {customer.contactName}{customer.contactRole ? `, ${customer.contactRole}` : ""}
              </p>
            )}
            {customer.apEmail && (
              <p className="text-[12.5px] mt-0.5" style={{ color: "var(--zn-ink-3)" }}>
                {customer.apEmail}
              </p>
            )}
          </div>
        </div>

        {/* Summary strip */}
        <div
          className="grid grid-cols-3 divide-x"
          style={{ borderBottom: "1px solid var(--zn-line-soft)", divideColor: "var(--zn-line-soft)" } as React.CSSProperties}
        >
          {[
            { label: "Open invoices", value: String(open.length) },
            { label: "Total outstanding", value: fmtGBP(totalOutstanding) },
            { label: "Total overdue", value: totalOverdue > 0 ? fmtGBP(totalOverdue) : "—", highlight: totalOverdue > 0 },
          ].map(({ label, value, highlight }) => (
            <div key={label} className="px-6 py-4">
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--zn-ink-3)" }}>
                {label}
              </p>
              <p
                className="mt-1 text-[20px] font-bold tabular-nums"
                style={{ color: highlight ? "var(--zn-risk)" : "var(--zn-ink)" }}
              >
                {value}
              </p>
            </div>
          ))}
        </div>

        {/* Invoice table */}
        {open.length === 0 ? (
          <div className="px-8 py-12 text-center">
            <p className="text-[14px] font-medium" style={{ color: "var(--zn-ink-2)" }}>
              No outstanding invoices
            </p>
            <p className="mt-1 text-[13px]" style={{ color: "var(--zn-ink-3)" }}>
              This account is fully up to date.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr style={{ background: "var(--zn-bg-2)", borderBottom: "1px solid var(--zn-line-soft)" }}>
                  {["Invoice #", "Invoice date", "Due date", "Days overdue", "Invoice total", "Amount due"].map((h) => (
                    <th
                      key={h}
                      className="px-6 py-3 text-[11px] font-semibold"
                      style={{ color: "var(--zn-ink-3)" }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {open.map((inv, idx) => {
                  const isOverdue = inv.daysOverdue > 0;
                  return (
                    <tr
                      key={inv.id}
                      style={{
                        borderTop: idx === 0 ? "none" : "1px solid var(--zn-line-soft)",
                        background: "var(--zn-surface)",
                      }}
                    >
                      <td className="px-6 py-3.5 text-[12.5px] font-mono font-medium" style={{ color: "var(--zn-ink)" }}>
                        {inv.invoiceNumber}
                      </td>
                      <td className="px-6 py-3.5 text-[12.5px]" style={{ color: "var(--zn-ink-2)" }}>
                        {fmtDate(inv.invoiceDate)}
                      </td>
                      <td className="px-6 py-3.5 text-[12.5px]" style={{ color: "var(--zn-ink-2)" }}>
                        {fmtDate(inv.dueDate)}
                      </td>
                      <td className="px-6 py-3.5 text-[12.5px] font-semibold tabular-nums" style={{ color: isOverdue ? "var(--zn-risk)" : "var(--zn-ink-3)" }}>
                        {isOverdue ? `${inv.daysOverdue}d` : "Current"}
                      </td>
                      <td className="px-6 py-3.5 text-[12.5px] tabular-nums" style={{ color: "var(--zn-ink-2)" }}>
                        {fmtGBP(inv.amount)}
                      </td>
                      <td className="px-6 py-3.5 text-[13px] font-semibold tabular-nums" style={{ color: "var(--zn-ink)" }}>
                        {fmtGBP(inv.amountOutstanding)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: "2px solid var(--zn-line)", background: "var(--zn-bg-2)" }}>
                  <td colSpan={5} className="px-6 py-3.5 text-[12.5px] font-semibold" style={{ color: "var(--zn-ink-2)" }}>
                    Total outstanding
                  </td>
                  <td className="px-6 py-3.5 text-[15px] font-bold tabular-nums" style={{ color: "var(--zn-ink)" }}>
                    {fmtGBP(totalOutstanding)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* Footer note */}
        <div
          className="px-8 py-5"
          style={{ borderTop: "1px solid var(--zn-line-soft)" }}
        >
          <p className="text-[11.5px]" style={{ color: "var(--zn-ink-3)" }}>
            Please arrange payment for any overdue invoices at your earliest convenience.
            If you have any queries about this statement, please contact us at{" "}
            <span style={{ color: "var(--zn-ink-2)" }}>{business.replyToEmail}</span>.
          </p>
        </div>
      </div>
    </div>
  );
}

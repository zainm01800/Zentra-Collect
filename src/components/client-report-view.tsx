"use client";

/**
 * Client AR Report — print-optimised view.
 *
 * Designed for letter/A4 paper. Use the browser's "Save as PDF" via the print
 * dialog to export. Looks clean both on-screen and on paper.
 *
 * Reads invoices from localStorage so it works for both demo and real users.
 * Bookkeeper plan users with an active client see ONLY that client's invoices.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";
import { computeClientReport, type InvoiceForReport } from "@/lib/client-report";
import { readLocalAccount } from "@/lib/demo-auth";
import { demoCashpilotInvoices as demoInvoices } from "@/lib/demo-data/zentra-demo-data";
import { importedInvoicesStorageKey } from "@/lib/import/zentra-import";
import {
  readActiveClientId,
  clientInvoicesKey,
  readBookkeeperClients,
} from "@/lib/bookkeeper-clients";
import { formatCurrency } from "@/lib/formatters";
import type { Invoice } from "@/types/cashpilot";

const demoInvoiceStateStorageKey = "zentra.demoInvoiceState.v1";
const BOOKKEEPER_PLAN_IDS = ["founding_bookkeeper", "bookkeeper_starter", "bookkeeper_pro"];

interface ClientReportViewProps {
  /** Optional client ID — overrides workspace active client. Defaults to active workspace. */
  clientIdOverride?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function resolveInvoiceKey(planId: string, clientIdOverride?: string): string {
  if (BOOKKEEPER_PLAN_IDS.includes(planId)) {
    const activeClientId = clientIdOverride ?? readActiveClientId();
    if (activeClientId && activeClientId !== "all") {
      return clientInvoicesKey(activeClientId);
    }
  }
  return importedInvoicesStorageKey;
}

function readInvoices(clientIdOverride?: string): InvoiceForReport[] {
  if (typeof window === "undefined") return [];
  const localAccount = readLocalAccount();
  const isDemo = localAccount?.planId === "demo";

  if (isDemo) {
    const stored = window.localStorage.getItem(demoInvoiceStateStorageKey);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as Invoice[];
        if (Array.isArray(parsed) && parsed.length) return parsed;
      } catch { /* fall through */ }
    }
    return demoInvoices as Invoice[];
  }

  const key = resolveInvoiceKey(localAccount?.planId ?? "", clientIdOverride);
  const stored = window.localStorage.getItem(key);
  if (!stored) return [];
  try {
    const parsed = JSON.parse(stored) as InvoiceForReport[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getClientName(clientIdOverride?: string): string {
  if (typeof window === "undefined") return "";
  const localAccount = readLocalAccount();
  if (localAccount?.planId === "demo") return "Demo workspace";
  if (!localAccount || !BOOKKEEPER_PLAN_IDS.includes(localAccount.planId)) {
    return localAccount?.businessName || "Your business";
  }
  const targetId = clientIdOverride ?? readActiveClientId();
  if (!targetId || targetId === "all") return "All clients";
  const clients = readBookkeeperClients();
  const match = clients.find((c) => c.id === targetId);
  return match?.label || match?.name || "Client";
}

function getBookkeeperName(): string {
  if (typeof window === "undefined") return "";
  const account = readLocalAccount();
  return account?.businessName || account?.name || "Your firm";
}

// ── Main view ────────────────────────────────────────────────────────────────

export function ClientReportView({ clientIdOverride }: ClientReportViewProps) {
  const [invoices, setInvoices] = useState<InvoiceForReport[]>([]);
  const [clientName, setClientName] = useState("");
  const [bookkeeperName, setBookkeeperName] = useState("");
  const [generatedAt, setGeneratedAt] = useState("");

  useEffect(() => {
    setInvoices(readInvoices(clientIdOverride));
    setClientName(getClientName(clientIdOverride));
    setBookkeeperName(getBookkeeperName());
    setGeneratedAt(new Date().toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }));
  }, [clientIdOverride]);

  const report = useMemo(() => computeClientReport(invoices), [invoices]);

  function handlePrint() {
    window.print();
  }

  return (
    <>
      {/* Print-only styles */}
      <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
          .print-page {
            background: white !important;
            color: black !important;
            padding: 20mm !important;
            max-width: none !important;
            margin: 0 !important;
            box-shadow: none !important;
          }
          .print-page * { color: black !important; }
          .print-page .muted-text { color: #666 !important; }
          .print-page .accent { color: #c2410c !important; }
          .print-page .risk-text { color: #b91c1c !important; }
          @page { margin: 0; size: A4; }
          body { background: white !important; }
        }
      `}</style>

      {/* Toolbar — hidden in print */}
      <div className="no-print mb-4 flex items-center justify-between">
        <Link
          href="/portfolio"
          className="inline-flex items-center gap-1.5 text-[12.5px] font-medium hover:opacity-70"
          style={{ color: "var(--zn-ink-3)" }}
        >
          <ArrowLeft className="size-3.5" />
          Back to portfolio
        </Link>
        <button
          type="button"
          onClick={handlePrint}
          className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-semibold"
          style={{
            background: "var(--zn-ink)",
            color: "var(--zn-bg)",
          }}
        >
          <Printer className="size-3.5" />
          Print / Save as PDF
        </button>
      </div>

      {/* The report itself — print-optimised */}
      <div
        className="print-page mx-auto"
        style={{
          maxWidth: 820,
          background: "white",
          color: "#1d1813",
          padding: "32px 40px",
          borderRadius: 8,
          boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
          fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between pb-5 mb-6" style={{ borderBottom: "2px solid #1d1813" }}>
          <div>
            <div className="text-[11px] font-semibold tracking-[0.16em] uppercase muted-text" style={{ color: "#8a7d69" }}>
              Accounts Receivable summary
            </div>
            <h1 className="text-[28px] font-semibold leading-tight mt-2">
              {clientName}
            </h1>
            <p className="text-[12.5px] mt-1 muted-text" style={{ color: "#8a7d69" }}>
              Prepared by {bookkeeperName} · {generatedAt}
            </p>
          </div>
          <div className="text-right">
            <div className="text-[10.5px] font-semibold tracking-[0.12em] uppercase muted-text" style={{ color: "#8a7d69" }}>
              Total outstanding
            </div>
            <div className="text-[26px] font-semibold tabular-nums mt-1">
              {formatCurrency(report.totalOutstanding)}
            </div>
            {report.totalOverdue > 0 && (
              <div className="text-[12px] mt-0.5 risk-text" style={{ color: "#b91c1c" }}>
                {formatCurrency(report.totalOverdue)} overdue
              </div>
            )}
          </div>
        </div>

        {/* Summary KPIs */}
        <div className="grid grid-cols-4 gap-4 mb-7">
          <Kpi label="Open invoices" value={String(report.openInvoiceCount)} />
          <Kpi label="Customers" value={String(report.customerCount)} />
          <Kpi label="Avg overdue" value={report.averageDaysOverdue > 0 ? `${report.averageDaysOverdue}d` : "—"} />
          <Kpi label="Oldest overdue" value={report.oldestOverdueDays > 0 ? `${report.oldestOverdueDays}d` : "—"} accent={report.oldestOverdueDays >= 60} />
        </div>

        {/* Aged debt table */}
        <Section title="Aged debt breakdown">
          <div className="grid grid-cols-5 gap-2">
            {report.agedDebt.map((bucket) => (
              <div
                key={bucket.label}
                className="px-3 py-2.5 rounded"
                style={{
                  border: "1px solid #e5dcc6",
                  background: bucket.label === "90+ days" && bucket.amount > 0 ? "#fef2f2" : "#fafafa",
                }}
              >
                <div className="text-[10px] font-semibold uppercase tracking-[0.08em] muted-text" style={{ color: "#8a7d69" }}>
                  {bucket.label}
                </div>
                <div className="text-[14.5px] font-semibold tabular-nums mt-1">
                  {formatCurrency(bucket.amount)}
                </div>
                <div className="text-[10.5px] mt-0.5 muted-text" style={{ color: "#8a7d69" }}>
                  {bucket.invoiceCount} invoice{bucket.invoiceCount === 1 ? "" : "s"}
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* Top overdue invoices table */}
        {report.topOverdue.length > 0 && (
          <Section title="Top overdue invoices">
            <table className="w-full text-[12.5px]" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #1d1813" }}>
                  <Th>Customer</Th>
                  <Th>Invoice</Th>
                  <Th align="right">Amount</Th>
                  <Th align="right">Due</Th>
                  <Th align="right">Overdue</Th>
                </tr>
              </thead>
              <tbody>
                {report.topOverdue.map((inv, idx) => (
                  <tr
                    key={inv.id ?? `${inv.invoiceNumber}-${idx}`}
                    style={{ borderBottom: "1px solid #f0e8d5" }}
                  >
                    <Td>{inv.customerName}</Td>
                    <Td mono>{inv.invoiceNumber}</Td>
                    <Td align="right" mono>{formatCurrency(inv.amountOutstanding ?? inv.amount)}</Td>
                    <Td align="right" mono>{inv.dueDate ? new Date(inv.dueDate).toLocaleDateString("en-GB") : "—"}</Td>
                    <Td align="right" mono accent={inv.daysOverdue >= 60}>{inv.daysOverdue}d</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        )}

        {/* Top debtors */}
        {report.topDebtors.length > 0 && (
          <Section title="Top customers by outstanding balance">
            <table className="w-full text-[12.5px]" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #1d1813" }}>
                  <Th>Customer</Th>
                  <Th align="right">Invoices</Th>
                  <Th align="right">Max overdue</Th>
                  <Th align="right">Outstanding</Th>
                </tr>
              </thead>
              <tbody>
                {report.topDebtors.map((d) => (
                  <tr key={d.customerName} style={{ borderBottom: "1px solid #f0e8d5" }}>
                    <Td>{d.customerName}</Td>
                    <Td align="right" mono>{d.invoiceCount}</Td>
                    <Td align="right" mono accent={d.maxDaysOverdue >= 60}>
                      {d.maxDaysOverdue > 0 ? `${d.maxDaysOverdue}d` : "—"}
                    </Td>
                    <Td align="right" mono>{formatCurrency(d.totalOutstanding)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        )}

        {report.openInvoiceCount === 0 && (
          <div
            className="text-center py-12 text-[14px] muted-text"
            style={{ color: "#8a7d69" }}
          >
            No open invoices for this client. AR position is clear.
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 pt-4 text-[10.5px] leading-5 muted-text" style={{ borderTop: "1px solid #e5dcc6", color: "#8a7d69" }}>
          <p>
            Generated by Zentra Collect on {generatedAt}. This report summarises the position
            of open and overdue invoices at the moment of generation. Days overdue are
            calculated against each invoice&apos;s recorded due date. Statutory interest may
            apply on B2B debt under the Late Payment of Commercial Debts (Interest) Act 1998.
            This is a summary, not legal or financial advice.
          </p>
        </div>
      </div>
    </>
  );
}

// ── Small inline components ───────────────────────────────────────────────────

function Kpi({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-[0.1em] muted-text" style={{ color: "#8a7d69" }}>
        {label}
      </div>
      <div
        className="text-[20px] font-semibold tabular-nums mt-1"
        style={{ color: accent ? "#b91c1c" : "#1d1813" }}
      >
        {value}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-7">
      <h2
        className="text-[10.5px] font-semibold uppercase tracking-[0.14em] mb-3"
        style={{ color: "#8a7d69" }}
      >
        {title}
      </h2>
      {children}
    </div>
  );
}

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th
      style={{
        textAlign: align,
        fontWeight: 600,
        padding: "8px 6px",
        fontSize: 10.5,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        color: "#1d1813",
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align = "left",
  mono = false,
  accent = false,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  mono?: boolean;
  accent?: boolean;
}) {
  return (
    <td
      style={{
        textAlign: align,
        padding: "8px 6px",
        fontFamily: mono ? "var(--font-geist-mono), ui-monospace, monospace" : undefined,
        fontVariantNumeric: "tabular-nums",
        color: accent ? "#b91c1c" : "#1d1813",
      }}
    >
      {children}
    </td>
  );
}

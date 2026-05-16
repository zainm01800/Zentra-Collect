"use client";

/**
 * Today screen header — single hero line ("Recover £X — top action: ...")
 * plus a row of count pills for Promises and Disputes that filter the
 * queue when clicked.
 *
 * Reads the same invoice data as the rest of the app so it stays in sync
 * with imports / new invoices / status flips.
 */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ShieldAlert, ArrowRight } from "lucide-react";
import { importedInvoicesStorageKey } from "@/lib/import/zentra-import";
import { readActiveClientId, clientInvoicesKey } from "@/lib/bookkeeper-clients";
import { readLocalAccount } from "@/lib/demo-auth";
import { demoCashpilotInvoices as demoInvoices } from "@/lib/demo-data/zentra-demo-data";
import type { Invoice as ZentraInvoice } from "@/types/zentra";

const BOOKKEEPER_PLAN_IDS = ["founding_bookkeeper", "bookkeeper_starter", "bookkeeper_pro"];

function resolveKey(planId: string): string {
  if (BOOKKEEPER_PLAN_IDS.includes(planId)) {
    const id = readActiveClientId();
    if (id && id !== "all") return clientInvoicesKey(id);
  }
  return importedInvoicesStorageKey;
}

function readInvoices(): ZentraInvoice[] {
  if (typeof window === "undefined") return [];
  const account = readLocalAccount();
  const isDemo = account?.planId === "demo";
  const raw = window.localStorage.getItem(resolveKey(account?.planId ?? ""));
  if (!raw) return isDemo ? (demoInvoices as unknown as ZentraInvoice[]) : [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length
      ? parsed
      : (isDemo ? (demoInvoices as unknown as ZentraInvoice[]) : []);
  } catch {
    return [];
  }
}

function fmtGBP(n: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency", currency: "GBP",
    maximumFractionDigits: 0,
  }).format(n);
}

export function TodayHeroAndPills() {
  const [invoices, setInvoices] = useState<ZentraInvoice[]>([]);
  useEffect(() => { setInvoices(readInvoices()); }, []);

  const stats = useMemo(() => {
    const open = invoices.filter(
      (i) => i.amountOutstanding > 0 && i.status !== "paid" && i.status !== "do_not_chase",
    );
    const overdue = open.filter((i) => i.daysOverdue > 0);
    const totalOverdue = overdue.reduce((s, i) => s + i.amountOutstanding, 0);
    const promises = invoices.filter(
      (i) => i.status === "promised" || i.status === "missed_promise" || i.promiseToPay,
    ).length;
    const disputes = invoices.filter(
      (i) => i.status === "disputed" || i.dispute?.status === "open",
    ).length;
    // Pick the single highest-impact open invoice as the "top action"
    const topAction = [...overdue].sort(
      (a, b) => (b.daysOverdue * b.amountOutstanding) - (a.daysOverdue * a.amountOutstanding),
    )[0];
    return { totalOverdue, openCount: open.length, promises, disputes, topAction };
  }, [invoices]);

  if (invoices.length === 0) {
    return (
      <div
        className="rounded-2xl p-5"
        style={{ background: "var(--zn-surface)", border: "1px solid var(--zn-line-soft)" }}
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em]"
           style={{ color: "var(--zn-ink-3)" }}>
          Welcome
        </p>
        <h2 className="text-[20px] font-semibold mt-1" style={{ color: "var(--zn-ink)" }}>
          You don&rsquo;t have any invoices yet.
        </h2>
        <p className="mt-1 text-[13px]" style={{ color: "var(--zn-ink-3)" }}>
          Import an AR ageing export or create your first invoice to start tracking.
        </p>
        <div className="mt-4 flex gap-2 flex-wrap">
          <Link
            href="/invoices?create=1"
            className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-semibold"
            style={{ background: "var(--zn-ink)", color: "var(--zn-bg)" }}
          >
            New invoice
          </Link>
          <Link
            href="/import"
            className="inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-[13px] font-medium"
            style={{ borderColor: "var(--zn-line)", color: "var(--zn-ink-2)" }}
          >
            Import a CSV
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Hero */}
      <div
        className="rounded-2xl p-5"
        style={{ background: "var(--zn-surface)", border: "1px solid var(--zn-line-soft)" }}
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em]"
           style={{ color: "var(--zn-ink-3)" }}>
          Today
        </p>
        <h2 className="text-[20px] sm:text-[22px] font-semibold mt-1 leading-tight"
            style={{ color: "var(--zn-ink)" }}>
          Recover <span className="tabular-nums">{fmtGBP(stats.totalOverdue)}</span> sitting overdue.
        </h2>
        {stats.topAction ? (
          <p className="mt-2 text-[13.5px] leading-6" style={{ color: "var(--zn-ink-2)" }}>
            Start with <strong>{stats.topAction.customerName}</strong> ({stats.topAction.invoiceNumber})
            — {fmtGBP(stats.topAction.amountOutstanding)}, {stats.topAction.daysOverdue} days overdue.
          </p>
        ) : (
          <p className="mt-2 text-[13.5px]" style={{ color: "var(--zn-ink-3)" }}>
            Nothing overdue right now. Nice.
          </p>
        )}
        {stats.topAction && (
          <Link
            href={`/chase-today?customer=${encodeURIComponent(stats.topAction.customerName)}`}
            className="inline-flex items-center gap-1.5 mt-3 rounded-full px-4 py-2 text-[13px] font-semibold"
            style={{ background: "var(--zn-ink)", color: "var(--zn-bg)" }}
          >
            Open this action <ArrowRight className="size-3.5" />
          </Link>
        )}
      </div>

      {/* Pills */}
      <div className="flex flex-wrap gap-2">
        {stats.promises > 0 && (
          <Link
            href="/promises"
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium"
            style={{ background: "var(--zn-warn-soft)", color: "var(--zn-warn)" }}
          >
            <AlertTriangle className="size-3" />
            {stats.promises} promise{stats.promises === 1 ? "" : "s"} to check
          </Link>
        )}
        {stats.disputes > 0 && (
          <Link
            href="/disputes"
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium"
            style={{ background: "var(--zn-risk-soft)", color: "var(--zn-risk)" }}
          >
            <ShieldAlert className="size-3" />
            {stats.disputes} active dispute{stats.disputes === 1 ? "" : "s"}
          </Link>
        )}
        <Link
          href="/chase-today"
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium border ml-auto"
          style={{ borderColor: "var(--zn-line)", color: "var(--zn-ink-2)" }}
        >
          Full queue ({stats.openCount}) <ArrowRight className="size-3" />
        </Link>
      </div>
    </div>
  );
}

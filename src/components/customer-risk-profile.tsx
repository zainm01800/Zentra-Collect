"use client";

/**
 * Customer risk profile section.
 *
 * Shown on the Customer detail page. Three columns:
 *   1. Payment behaviour (uses lib/risk-score)
 *   2. Statutory interest accrued across all open invoices (lib/statutory-interest)
 *   3. Companies House credit signal (lib/companies-house via server action)
 *
 * Each section degrades gracefully — Companies House shows a setup prompt
 * when the API key isn't configured, statutory interest hides if not material.
 */

import { useEffect, useMemo, useState } from "react";
import { AlertOctagon, Building2, ExternalLink, ShieldCheck, Sparkles } from "lucide-react";
import { lookupCompanyAction } from "@/actions/companies-house";
import {
  calculateStatutoryInterest,
  isInterestMaterial,
} from "@/lib/statutory-interest";
import {
  computeCustomerRisk,
  type InvoiceForRisk,
} from "@/lib/risk-score";
import { formatCurrency } from "@/lib/formatters";
import { RiskBadge } from "@/components/risk-badge";
import type { CompanyLookupResult } from "@/lib/companies-house";

interface CustomerRiskProfileProps {
  customerName:    string;
  invoices:        InvoiceForRisk[];
}

export function CustomerRiskProfile({
  customerName,
  invoices,
}: CustomerRiskProfileProps) {
  // ── 1. Risk score ──────────────────────────────────────────────────────────
  const risk = useMemo(
    () => computeCustomerRisk(customerName, invoices),
    [customerName, invoices],
  );

  // ── 2. Total statutory interest across all open overdue invoices ───────────
  const interestSummary = useMemo(() => {
    const overdueInvoices = invoices.filter(
      (inv) =>
        inv.status.toLowerCase() !== "paid" &&
        inv.daysOverdue > 0 &&
        isInterestMaterial(inv.amount, inv.daysOverdue),
    );
    if (overdueInvoices.length === 0) return null;
    let interest = 0;
    let compensation = 0;
    for (const inv of overdueInvoices) {
      const r = calculateStatutoryInterest(inv.amount, inv.daysOverdue);
      interest += r.interest;
      compensation += r.compensation;
    }
    return {
      interest,
      compensation,
      total: interest + compensation,
      invoiceCount: overdueInvoices.length,
    };
  }, [invoices]);

  // ── 3. Companies House lookup ──────────────────────────────────────────────
  const [chData, setChData] = useState<CompanyLookupResult | null>(null);
  const [chLoading, setChLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setChLoading(true);
    lookupCompanyAction(customerName)
      .then((r) => {
        if (!cancelled) setChData(r);
      })
      .catch(() => {
        if (!cancelled) {
          setChData({
            match: null,
            alternatives: [],
            risk: null,
            notConfigured: false,
            noMatch: false,
            apiError: true,
          });
        }
      })
      .finally(() => {
        if (!cancelled) setChLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [customerName]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="zn-card p-5 lg:p-6">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="size-3.5" style={{ color: "var(--zn-ink-3)" }} />
        <span
          className="text-[10.5px] font-semibold uppercase tracking-[0.12em]"
          style={{ color: "var(--zn-ink-3)" }}
        >
          Risk profile
        </span>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        {/* 1. Payment behaviour ── */}
        <PaymentBehaviourBlock risk={risk} />

        {/* 2. Statutory interest ── */}
        <InterestBlock summary={interestSummary} />

        {/* 3. Companies House ── */}
        <CompaniesHouseBlock data={chData} loading={chLoading} />
      </div>
    </div>
  );
}

// ── Block 1: Payment behaviour ────────────────────────────────────────────────

function PaymentBehaviourBlock({
  risk,
}: {
  risk: ReturnType<typeof computeCustomerRisk>;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <ShieldCheck className="size-3.5" style={{ color: "var(--zn-ink-3)" }} />
        <span
          className="text-[11px] font-semibold uppercase tracking-[0.08em]"
          style={{ color: "var(--zn-ink-3)" }}
        >
          Payment behaviour
        </span>
      </div>
      <div className="mb-2">
        <RiskBadge risk={risk} size="md" />
      </div>
      <ul className="space-y-1 text-[12px]" style={{ color: "var(--zn-ink-2)" }}>
        {risk.stats.openInvoiceCount > 0 && (
          <>
            <Stat label="Open invoices" value={String(risk.stats.openInvoiceCount)} />
            <Stat label="Outstanding" value={formatCurrency(risk.stats.totalOutstanding)} />
            <Stat label="Max days overdue" value={risk.stats.maxDaysOverdue > 0 ? `${risk.stats.maxDaysOverdue}d` : "—"} />
            <Stat label="Times chased" value={String(risk.stats.totalChaseCount)} />
            {risk.stats.brokenPromises > 0 && (
              <Stat label="Broken promises" value={String(risk.stats.brokenPromises)} highlight />
            )}
            {risk.stats.disputedInvoices > 0 && (
              <Stat label="Disputes" value={String(risk.stats.disputedInvoices)} highlight />
            )}
          </>
        )}
      </ul>
    </div>
  );
}

function Stat({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <li className="flex items-baseline justify-between gap-2">
      <span style={{ color: "var(--zn-ink-3)" }}>{label}</span>
      <span
        className="tabular-nums font-medium"
        style={{ color: highlight ? "var(--zn-risk)" : "var(--zn-ink)" }}
      >
        {value}
      </span>
    </li>
  );
}

// ── Block 2: Statutory interest ───────────────────────────────────────────────

function InterestBlock({
  summary,
}: {
  summary: { interest: number; compensation: number; total: number; invoiceCount: number } | null;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span
          className="text-[11px] font-semibold uppercase tracking-[0.08em]"
          style={{ color: "var(--zn-ink-3)" }}
        >
          Statutory interest accrued
        </span>
      </div>
      {summary ? (
        <>
          <div
            className="text-[20px] font-semibold tabular-nums leading-tight mb-2"
            style={{ color: "var(--zn-ink)" }}
          >
            {formatCurrency(summary.total)}
          </div>
          <ul className="space-y-1 text-[12px]" style={{ color: "var(--zn-ink-2)" }}>
            <Stat label="Interest" value={formatCurrency(summary.interest)} />
            <Stat label="Compensation" value={formatCurrency(summary.compensation)} />
            <Stat label="Across invoices" value={String(summary.invoiceCount)} />
          </ul>
          <p className="text-[10.5px] leading-4 mt-2" style={{ color: "var(--zn-ink-3)" }}>
            Late Payment of Commercial Debts Act. B2B only — not legal advice.
          </p>
        </>
      ) : (
        <p className="text-[12px]" style={{ color: "var(--zn-ink-3)" }}>
          No material interest accrued. Customer is paying on time or invoices are too small / too recently overdue.
        </p>
      )}
    </div>
  );
}

// ── Block 3: Companies House ──────────────────────────────────────────────────

function CompaniesHouseBlock({
  data,
  loading,
}: {
  data: CompanyLookupResult | null;
  loading: boolean;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Building2 className="size-3.5" style={{ color: "var(--zn-ink-3)" }} />
        <span
          className="text-[11px] font-semibold uppercase tracking-[0.08em]"
          style={{ color: "var(--zn-ink-3)" }}
        >
          Companies House
        </span>
      </div>

      {loading && (
        <p className="text-[12px]" style={{ color: "var(--zn-ink-3)" }}>
          Checking registry…
        </p>
      )}

      {!loading && data?.notConfigured && (
        <div className="text-[12px] leading-5" style={{ color: "var(--zn-ink-3)" }}>
          <p className="mb-1">Not configured.</p>
          <p className="text-[11px]">
            Add <code className="font-mono">COMPANIES_HOUSE_API_KEY</code> to enable free UK company credit signals.
            Sign up at{" "}
            <a
              href="https://developer.company-information.service.gov.uk/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              developer.company-information.service.gov.uk
            </a>
            .
          </p>
        </div>
      )}

      {!loading && data?.apiError && (
        <p className="text-[12px]" style={{ color: "var(--zn-risk)" }}>
          Lookup failed. Try again later.
        </p>
      )}

      {!loading && data && data.noMatch && (
        <p className="text-[12px]" style={{ color: "var(--zn-ink-3)" }}>
          No matching company found on the register. May be a sole trader or use a different trading name.
        </p>
      )}

      {!loading && data?.match && data.risk && (
        <>
          <div
            className="rounded-lg px-2.5 py-2 mb-2"
            style={{
              background: data.risk.shouldWarn ? "var(--zn-risk-soft)" : "var(--zn-safe-soft)",
              color: data.risk.shouldWarn ? "var(--zn-risk)" : "var(--zn-safe)",
            }}
          >
            <div className="flex items-center gap-1.5">
              {data.risk.shouldWarn ? (
                <AlertOctagon className="size-3" />
              ) : (
                <ShieldCheck className="size-3" />
              )}
              <span className="text-[11.5px] font-semibold capitalize">
                {data.risk.flag.replace(/_/g, " ")}
              </span>
            </div>
            <p className="text-[11px] leading-4 mt-1">{data.risk.summary}</p>
          </div>
          <div className="text-[11.5px] leading-5" style={{ color: "var(--zn-ink-2)" }}>
            <div className="font-medium" style={{ color: "var(--zn-ink)" }}>
              {data.match.companyName}
            </div>
            <div style={{ color: "var(--zn-ink-3)" }}>
              No. {data.match.companyNumber}
              {data.match.dateOfCreation && (
                <> · Incorporated {data.match.dateOfCreation.slice(0, 7)}</>
              )}
            </div>
            <a
              href={`https://find-and-update.company-information.service.gov.uk/company/${data.match.companyNumber}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-1.5 hover:underline"
              style={{ color: "var(--zn-ink-3)" }}
            >
              View on Companies House
              <ExternalLink className="size-2.5" />
            </a>
          </div>
        </>
      )}
    </div>
  );
}

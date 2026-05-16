"use client";

/**
 * Compact tax-estimate widget — surfaced on the dashboard so Trader-tier
 * users see "you'll owe ~£X to HMRC for this tax year" alongside their
 * cash forecast, without having to dig.
 *
 * Hidden when income < £1,000 — no point cluttering the dashboard with
 * a £0 estimate for users who haven't issued an invoice yet.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Calculator } from "lucide-react";
import {
  currentUkTaxYear,
  estimateUkSelfEmployedTax,
} from "@/lib/tax/uk-self-employed";
import { totalsForTaxYear, type TaxYearTotals } from "@/lib/tax/summary";

function fmtGBP(n: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency", currency: "GBP",
    maximumFractionDigits: 0,
  }).format(n);
}

export function TaxEstimateWidget() {
  const [totals, setTotals] = useState<TaxYearTotals | null>(null);
  useEffect(() => {
    setTotals(totalsForTaxYear(currentUkTaxYear()));
  }, []);

  const estimate = useMemo(() => {
    if (!totals) return null;
    return estimateUkSelfEmployedTax(
      { income: totals.income, expenses: totals.expenses },
      currentUkTaxYear(),
    );
  }, [totals]);

  if (!totals || !estimate) return null;
  if (totals.income < 1_000) return null; // suppress for empty workspaces

  return (
    <Link
      href="/tax-estimate"
      className="block rounded-xl p-4 transition-colors hover:bg-[var(--zn-surface-2)]"
      style={{ background: "var(--zn-surface)", border: "1px solid var(--zn-line-soft)" }}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <Calculator className="size-3.5" style={{ color: "var(--zn-ink-3)" }} />
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em]"
           style={{ color: "var(--zn-ink-3)" }}>
          Tax estimate · {currentUkTaxYear()}
        </p>
      </div>
      <p className="text-[26px] font-semibold tabular-nums leading-none"
         style={{ color: "var(--zn-ink)" }}>
        {fmtGBP(estimate.estimatedTaxOwed)}
      </p>
      <p className="mt-1.5 text-[11.5px]" style={{ color: "var(--zn-ink-3)" }}>
        Estimate only · on net profit {fmtGBP(estimate.netProfit)}
      </p>
    </Link>
  );
}

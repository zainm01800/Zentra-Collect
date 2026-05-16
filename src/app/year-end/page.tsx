/**
 * GET /year-end?year=2025/26
 *
 * Print-optimised year-end summary for a UK tax year. Designed to be
 * "Save as PDF" or "Email to my accountant" from the browser — no
 * server-side PDF library needed.
 *
 * Rendered as a server component shell + client child for the data
 * (which lives in localStorage). Auto-triggers window.print() once
 * data is loaded so the user lands directly in their browser's print
 * dialog.
 */

import { Suspense } from "react";
import { YearEndClient } from "./client";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Year-end summary",
  description:
    "One-page year-end summary for your UK Self Assessment — revenue, expenses, profit, estimated tax. Estimate only.",
  robots: { index: false, follow: false },
};

export default async function YearEndPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const taxYear = params.year;
  return (
    <Suspense fallback={null}>
      <YearEndClient initialTaxYear={taxYear} />
    </Suspense>
  );
}

/**
 * Tax-year income & expense aggregator.
 *
 * Reads from the existing localStorage data sources (no duplicate
 * persistence layer): zentra.expenses.v1 for expenses, and the
 * imported / per-client invoice arrays for income.
 *
 * "Income" for self-employment tax = total invoiced + paid value within
 * the tax year — we use invoice issue date as the accounting reference.
 * The user can switch to cash basis (paid-date) later; for v1 we use
 * accrual (issue-date) which is the SA default.
 */

import { ukTaxYearRange } from "./uk-self-employed";
import { importedInvoicesStorageKey } from "@/lib/import/zentra-import";
import { readActiveClientId, clientInvoicesKey } from "@/lib/bookkeeper-clients";
import { readLocalAccount } from "@/lib/demo-auth";
import { readTaggedIncome } from "@/lib/banking/direct-income";
import { totalMileageAllowance } from "@/lib/mileage";
import { totalCreditedNet, totalCreditedVat } from "@/lib/credit-notes";
import type { Invoice } from "@/types/zentra";

const BOOKKEEPER_PLAN_IDS = ["bookkeeper_starter", "bookkeeper_pro"];
const EXPENSES_KEY = "zentra.expenses.v1";

interface SimpleExpense {
  date:         string;
  amount:       number;
  category?:    string;
  allowability?: string; // "allowable" | "not-allowable" | "review" | undefined
}

function readInvoicesForCurrentContext(): Invoice[] {
  if (typeof window === "undefined") return [];
  const account = readLocalAccount();
  let key = importedInvoicesStorageKey;
  if (account && BOOKKEEPER_PLAN_IDS.includes(account.planId)) {
    const activeClientId = readActiveClientId();
    if (activeClientId && activeClientId !== "all") {
      key = clientInvoicesKey(activeClientId);
    }
  }
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readExpenses(): SimpleExpense[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(EXPENSES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((e) => e && typeof e.date === "string" && typeof e.amount === "number")
      .filter((e) => e.allowability !== "not-allowable" && e.allowability !== "review")
      .map((e) => ({ date: e.date, amount: e.amount, category: e.category, allowability: e.allowability }));
  } catch {
    return [];
  }
}

export interface TaxYearTotals {
  taxYear:        string;
  startIso:       string;
  endIso:         string;
  income:         number;
  expenses:       number;
  invoiceCount:   number;
  expenseCount:   number;
  /** Sum of VAT amounts captured on invoice line items in this tax year. */
  vatCharged:     number;
}

/**
 * Sum income (from invoices issued in the tax year) and expenses
 * (incurred in the tax year). Income uses the accrual basis — invoice
 * issue date determines which tax year it lands in.
 */
export function totalsForTaxYear(taxYear: string): TaxYearTotals {
  const { startIso, endIso } = ukTaxYearRange(taxYear);
  const start = new Date(startIso).getTime();
  const end   = new Date(endIso).getTime() + 86_399_000; // end-of-day inclusive

  const invoices = readInvoicesForCurrentContext();
  const expenses = readExpenses();
  const directIncome = readTaggedIncome();

  let income = 0;
  let invoiceCount = 0;
  let vatCharged = 0;
  for (const inv of invoices) {
    const d = new Date(inv.invoiceDate).getTime();
    if (!Number.isFinite(d) || d < start || d > end) continue;
    income += inv.amount;
    invoiceCount += 1;
    // Sum per-line VAT amounts (added in the VAT-on-invoice-lines feature).
    // Older invoices without VAT fields contribute 0.
    if (Array.isArray(inv.lineItems)) {
      for (const li of inv.lineItems) {
        const v = typeof li.vatAmount === "number" ? li.vatAmount : 0;
        if (Number.isFinite(v)) vatCharged += v;
      }
    }
  }
  // Direct income (bank-feed credits tagged by the user as income without
  // an invoice — driving instructors, tutors, dog walkers, etc.) counts
  // toward turnover for Self-Assessment.
  for (const di of directIncome) {
    const d = new Date(di.date).getTime();
    if (!Number.isFinite(d) || d < start || d > end) continue;
    income += di.amount;
  }

  let exp = 0;
  let expenseCount = 0;
  for (const e of expenses) {
    const d = new Date(e.date).getTime();
    if (!Number.isFinite(d) || d < start || d > end) continue;
    exp += e.amount;
    expenseCount += 1;
  }

  // Mileage allowance — HMRC AMAP rate × business miles in the tax year.
  // Counts as an allowable expense for self-employment.
  const mileageAllowance = totalMileageAllowance({
    from: new Date(start),
    to:   new Date(end),
  });
  exp += mileageAllowance;

  // Credit notes — money the user has formally NOT collected this period.
  // Net amount reduces taxable income; VAT amount reduces output VAT
  // (so VAT charged is net of any refunds issued).
  const range = { from: new Date(start), to: new Date(end) };
  const creditedNet = totalCreditedNet(range);
  const creditedVat = totalCreditedVat(range);
  income     = Math.max(0, income - creditedNet);
  vatCharged = Math.max(0, vatCharged - creditedVat);

  const round2 = (n: number) => Math.round(n * 100) / 100;
  return {
    taxYear,
    startIso,
    endIso,
    income:       round2(income),
    expenses:     round2(exp),
    invoiceCount,
    expenseCount,
    vatCharged:   round2(vatCharged),
  };
}

import { groupActionsByCategory, rankCollectionActions } from "@/lib/collections/decision-engine";
import { buildCustomerBehaviourProfile } from "@/lib/collections/customer-behaviour";
import type { ImportDiffOutput } from "@/lib/import/zentra-import";
import type { Customer, CustomerBehaviourProfile, Invoice } from "@/types/zentra";

export type WeeklyDigestBrief = {
  weekStarting: string;
  generatedAt: string;
  totalCashNeedingAttention: number;
  actionsRecommendedThisWeek: number;
  promisesDueThisWeek: number;
  missedPromises: number;
  unresolvedDisputes: number;
  topCustomersToReview: Array<{
    customerId: string;
    customerName: string;
    amountOutstanding: number;
    riskLabel: CustomerBehaviourProfile["riskLabel"];
    reason: string;
  }>;
  cashLikelyToLandThisWeek: number;
  biggestBlocker: string;
  changedSinceLastImport: string;
  recommendedFocus: string;
  topActions: Array<{
    label: string;
    count: number;
    amount: number;
  }>;
  promisesToCheck: Invoice[];
  exceptions: Invoice[];
  customerRisks: CustomerBehaviourProfile[];
  emailSubject: string;
  emailBody: string;
};

export function generateWeeklyDigestBrief({
  invoices,
  customers,
  profiles,
  importDiff,
  referenceDate = "2026-05-07",
}: {
  invoices: Invoice[];
  customers: Customer[];
  profiles?: CustomerBehaviourProfile[];
  importDiff?: ImportDiffOutput | null;
  referenceDate?: string;
}): WeeklyDigestBrief {
  const behaviourProfiles =
    profiles?.length
      ? profiles
      : customers.map((customer) => buildCustomerBehaviourProfile(customer, invoices));
  const plan = rankCollectionActions({
    invoices,
    customers,
    customerBehaviourProfiles: behaviourProfiles,
    referenceDate,
  });
  const grouped = groupActionsByCategory(plan);
  const activeActions = plan.filter((item) => item.dashboardGroup !== "do_not_chase");
  const promisesDueThisWeek = invoices.filter((invoice) =>
    isWithinNextDays(invoice.promisedPaymentDate, referenceDate, 7),
  );
  const missedPromises = invoices.filter(
    (invoice) =>
      invoice.status === "missed_promise" ||
      invoice.promiseToPay?.status === "missed",
  );
  const unresolvedDisputes = invoices.filter(
    (invoice) => invoice.status === "disputed" || invoice.dispute?.status === "open",
  );
  const exceptions = invoices.filter((invoice) =>
    ["disputed", "awaiting_remittance", "awaiting_statement", "needs_ap_contact"].includes(
      invoice.status,
    ),
  );
  const cashLikelyToLandThisWeek = promisesDueThisWeek.reduce(
    (total, invoice) => total + invoice.amountOutstanding,
    0,
  );
  const topCustomersToReview = behaviourProfiles
    .filter((profile) => profile.openInvoices > 0)
    .sort((a, b) => customerRiskScore(b) - customerRiskScore(a))
    .slice(0, 5)
    .map((profile) => ({
      customerId: profile.customerId,
      customerName: profile.customerName,
      amountOutstanding: profile.totalOutstanding,
      riskLabel: profile.riskLabel,
      reason: profile.memoryNotes[0] ?? "Based on previous imported data.",
    }));
  const topActions = Object.entries(
    activeActions.reduce<Record<string, { count: number; amount: number }>>(
      (summary, item) => {
        const key = item.recommendedAction;
        summary[key] ??= { count: 0, amount: 0 };
        summary[key].count += 1;
        summary[key].amount += item.amountOutstanding;
        return summary;
      },
      {},
    ),
  )
    .map(([action, summary]) => ({
      label: humanAction(action),
      ...summary,
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);
  const biggestBlocker = getBiggestBlocker({
    unresolvedDisputes: unresolvedDisputes.length,
    remittance: grouped.exceptions_to_resolve.filter(
      (item) => item.scenario === "REQUEST_REMITTANCE",
    ).length,
    missingContacts: grouped.exceptions_to_resolve.filter(
      (item) => item.scenario === "ASK_FOR_AP_CONTACT",
    ).length,
    missedPromises: missedPromises.length,
  });
  const changedSinceLastImport = importDiff
    ? `${formatCurrency(importDiff.totalPaidAmount)} paid since last import; ${importDiff.newlyOverdue.length} newly overdue; ${importDiff.stillOverdue.length} still overdue.`
    : "No re-import comparison is available yet.";
  const recommendedFocus = getRecommendedFocus({
    missedPromises: missedPromises.length,
    disputes: unresolvedDisputes.length,
    chaseNow: grouped.chase_now.length,
    exceptions: grouped.exceptions_to_resolve.length,
    likelyCash: cashLikelyToLandThisWeek,
  });
  const totalCashNeedingAttention = activeActions.reduce(
    (total, item) => total + item.amountOutstanding,
    0,
  );
  const weekStarting = getWeekStart(referenceDate);

  return {
    weekStarting,
    generatedAt: new Date().toISOString(),
    totalCashNeedingAttention,
    actionsRecommendedThisWeek: activeActions.length,
    promisesDueThisWeek: promisesDueThisWeek.length,
    missedPromises: missedPromises.length,
    unresolvedDisputes: unresolvedDisputes.length,
    topCustomersToReview,
    cashLikelyToLandThisWeek,
    biggestBlocker,
    changedSinceLastImport,
    recommendedFocus,
    topActions,
    promisesToCheck: promisesDueThisWeek,
    exceptions,
    customerRisks: topCustomersToReview
      .map((item) =>
        behaviourProfiles.find((profile) => profile.customerId === item.customerId),
      )
      .filter(Boolean) as CustomerBehaviourProfile[],
    emailSubject: "Your weekly Zentra Flow brief",
    emailBody: buildEmailBody({
      totalCashNeedingAttention,
      activeActions: activeActions.length,
      promisesDue: promisesDueThisWeek.length,
      missedPromises: missedPromises.length,
      unresolvedDisputes: unresolvedDisputes.length,
      likelyCash: cashLikelyToLandThisWeek,
      biggestBlocker,
      changedSinceLastImport,
      recommendedFocus,
    }),
  };
}

function getBiggestBlocker(input: {
  unresolvedDisputes: number;
  remittance: number;
  missingContacts: number;
  missedPromises: number;
}) {
  const blockers = [
    { label: "unresolved disputes", count: input.unresolvedDisputes },
    { label: "missing remittance advice", count: input.remittance },
    { label: "missing AP contacts", count: input.missingContacts },
    { label: "missed promises", count: input.missedPromises },
  ].sort((a, b) => b.count - a.count);

  return blockers[0]?.count
    ? `${blockers[0].count} ${blockers[0].label}`
    : "No major blocker detected.";
}

function getRecommendedFocus(input: {
  missedPromises: number;
  disputes: number;
  chaseNow: number;
  exceptions: number;
  likelyCash: number;
}) {
  if (input.missedPromises > 0) {
    return "Start with missed promises, then review high-value payment reminders.";
  }
  if (input.disputes > 0) {
    return "Resolve disputes before sending more payment reminders.";
  }
  if (input.exceptions > input.chaseNow) {
    return "Clear exceptions first so more invoices become safe to chase.";
  }
  if (input.likelyCash > 0) {
    return "Check promised payments early in the week, then chase the highest-value overdue invoices.";
  }
  return "Work through the highest-priority chase-now list.";
}

function buildEmailBody(input: {
  totalCashNeedingAttention: number;
  activeActions: number;
  promisesDue: number;
  missedPromises: number;
  unresolvedDisputes: number;
  likelyCash: number;
  biggestBlocker: string;
  changedSinceLastImport: string;
  recommendedFocus: string;
}) {
  return [
    "Hi,",
    "",
    "Here is this week's Zentra Flow brief.",
    "",
    `Cash needing attention: ${formatCurrency(input.totalCashNeedingAttention)}`,
    `Actions recommended this week: ${input.activeActions}`,
    `Promises due this week: ${input.promisesDue}`,
    `Missed promises: ${input.missedPromises}`,
    `Unresolved disputes: ${input.unresolvedDisputes}`,
    `Cash likely to land this week: ${formatCurrency(input.likelyCash)}`,
    "",
    `Biggest blocker: ${input.biggestBlocker}`,
    `What changed since last import: ${input.changedSinceLastImport}`,
    "",
    `Recommended focus: ${input.recommendedFocus}`,
    "",
    "Open Zentra Flow to review the chase plan before sending any messages.",
  ].join("\n");
}

function customerRiskScore(profile: CustomerBehaviourProfile) {
  const riskWeight: Record<CustomerBehaviourProfile["riskLabel"], number> = {
    "high risk": 50,
    "dispute-prone": 45,
    "regular late payer": 35,
    "slightly slow": 20,
    reliable: 10,
    unknown: 5,
  };

  return riskWeight[profile.riskLabel] + profile.totalOutstanding / 500;
}

function isWithinNextDays(date: string | undefined, referenceDate: string, days: number) {
  if (!date) return false;
  const start = new Date(`${referenceDate}T00:00:00.000Z`).getTime();
  const end = start + days * 24 * 60 * 60 * 1000;
  const value = new Date(`${date}T00:00:00.000Z`).getTime();
  return value >= start && value <= end;
}

function getWeekStart(referenceDate: string) {
  const date = new Date(`${referenceDate}T00:00:00.000Z`);
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - day + 1);
  return date.toISOString().slice(0, 10);
}

function humanAction(action: string) {
  return action
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(amount);
}

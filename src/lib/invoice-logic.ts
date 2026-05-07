import type { Invoice, ReminderTone, UrgencyLevel } from "@/types/cashpilot";
import { formatCurrency, formatDate } from "@/lib/formatters";

const highValueThreshold = 5000;
const today = new Date("2026-05-07T00:00:00.000Z");

export type QueueFilter =
  | "today"
  | "all"
  | "calls"
  | "promises"
  | "disputes"
  | "final"
  | "paid";

export function calculateDaysOverdue(dueDate: string) {
  const today = new Date();
  const due = new Date(dueDate);
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);

  return Math.max(
    0,
    Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)),
  );
}

export function getRecommendedTone(invoice: Invoice): ReminderTone {
  if (invoice.status === "Disputed") return "Neutral";
  if (invoice.daysOverdue >= 46) return "Final notice";
  if (invoice.daysOverdue >= 22) return "Firm";
  if (invoice.daysOverdue >= 8) return "Neutral";
  return "Friendly";
}

export function getInvoiceUrgency(invoice: Invoice): UrgencyLevel {
  if (invoice.status === "Disputed") return "Blocked";
  if (invoice.status === "Paid" || invoice.status === "Not due") return "Low";

  let score = 0;
  if (invoice.daysOverdue > 0) score += 1;
  if (invoice.daysOverdue >= 8) score += 1;
  if (invoice.daysOverdue >= 22) score += 1;
  if (invoice.daysOverdue >= 46) score += 1;
  if (invoice.amount >= highValueThreshold) score += 1;
  if (invoice.chaseCount >= 2) score += 1;
  if (invoice.relationshipType === "problematic payer") score += 1;
  if (invoice.status === "Needs call") score += 2;
  if (invoice.status === "Promised payment") score += 1;

  if (score >= 6) return "Critical";
  if (score >= 4) return "High";
  if (score >= 2) return "Medium";
  return "Low";
}

export function getSuggestedAction(invoice: Invoice) {
  if (invoice.status === "Paid") return "No action needed";
  if (invoice.status === "Disputed") return "Resolve dispute before chasing";
  if (invoice.status === "Promised payment") return "Confirm promised payment";
  if (invoice.daysOverdue <= 0) return "No action needed";
  if (invoice.daysOverdue >= 46 || invoice.status === "Needs call") {
    return "Call customer";
  }
  if (invoice.daysOverdue >= 22) return "Send firm reminder";
  if (invoice.daysOverdue >= 8) return "Send neutral reminder";
  return "Send friendly reminder";
}

export function invoiceNeedsActionToday(invoice: Invoice) {
  if (["Paid", "Not due", "Due soon"].includes(invoice.status)) return false;
  if (invoice.status === "Disputed") return true;
  if (invoice.status === "Promised payment") {
    if (!invoice.followUpDate && !invoice.promisedPaymentDate) return true;
    const checkDate = new Date(invoice.followUpDate ?? invoice.promisedPaymentDate!);
    checkDate.setHours(0, 0, 0, 0);
    return checkDate <= today;
  }
  if (invoice.daysOverdue <= 0) return false;
  if (!invoice.lastChasedAt) return true;

  const lastChased = new Date(invoice.lastChasedAt);
  const daysSinceChased = Math.floor(
    (Date.now() - lastChased.getTime()) / (1000 * 60 * 60 * 24),
  );

  return daysSinceChased >= 3;
}

export function getRiskLabels(invoice: Invoice) {
  const labels: string[] = [];

  if (invoice.amount >= highValueThreshold) labels.push("High value");
  if (invoice.relationshipType === "problematic payer") {
    labels.push("Repeat late payer");
  }
  if (invoice.chaseCount >= 3) labels.push("No response");
  if (invoice.status === "Promised payment") labels.push("Promise to check");
  if (invoice.status === "Disputed") labels.push("Disputed");
  if (invoice.daysOverdue >= 46) labels.push("Final notice candidate");
  if (!invoice.lastChasedAt && invoice.daysOverdue > 0) labels.push("First chase");

  return labels;
}

export function getCustomerProfile(invoices: Invoice[], invoice: Invoice) {
  const customerInvoices = invoices.filter(
    (item) => item.customerName === invoice.customerName,
  );
  const paidInvoices = customerInvoices.filter((item) => item.status === "Paid");
  const overdueInvoices = customerInvoices.filter((item) => item.daysOverdue > 0);
  const disputes = customerInvoices.filter((item) => item.status === "Disputed").length;
  const totalOutstanding = customerInvoices
    .filter((item) => item.status !== "Paid")
    .reduce((total, item) => total + item.amount, 0);
  const averageDaysLate = overdueInvoices.length
    ? Math.round(
        overdueInvoices.reduce((total, item) => total + item.daysOverdue, 0) /
          overdueInvoices.length,
      )
    : 0;

  return {
    invoiceCount: customerInvoices.length,
    paidCount: paidInvoices.length,
    disputes,
    totalOutstanding,
    averageDaysLate,
    summary:
      disputes > 0
        ? "Has an active dispute. Resolve the blocker before chasing."
        : averageDaysLate >= 45
          ? "Usually needs escalation and direct follow-up."
          : averageDaysLate >= 15
            ? "Often pays late; ask for a clear payment date."
            : "Generally low-risk; keep the reminder relationship-friendly.",
  };
}

export function filterInvoices(invoices: Invoice[], filter: QueueFilter) {
  return invoices.filter((invoice) => {
    if (filter === "today") return invoiceNeedsActionToday(invoice);
    if (filter === "calls") return getSuggestedAction(invoice) === "Call customer";
    if (filter === "promises") return invoice.status === "Promised payment";
    if (filter === "disputes") return invoice.status === "Disputed";
    if (filter === "final") return invoice.daysOverdue >= 46 && invoice.status !== "Paid";
    if (filter === "paid") return invoice.status === "Paid";
    return invoice.status !== "Paid";
  });
}

export function getTodayPlan(invoices: Invoice[]) {
  const actionInvoices = sortInvoicesByPriority(invoices.filter(invoiceNeedsActionToday));
  const callInvoices = actionInvoices.filter(
    (invoice) => getSuggestedAction(invoice) === "Call customer",
  );
  const disputeInvoices = actionInvoices.filter(
    (invoice) => invoice.status === "Disputed",
  );
  const promisedInvoices = actionInvoices.filter(
    (invoice) => invoice.status === "Promised payment",
  );
  const highRiskInvoices = actionInvoices.filter((invoice) =>
    ["Critical", "High"].includes(getInvoiceUrgency(invoice)),
  );
  const highRiskAmount = highRiskInvoices.reduce(
    (total, invoice) => total + invoice.amount,
    0,
  );
  const topInvoice = actionInvoices[0];

  return {
    actionCount: actionInvoices.length,
    callCount: callInvoices.length,
    disputeCount: disputeInvoices.length,
    promisedCount: promisedInvoices.length,
    highRiskAmount,
    topInvoice,
    headline: actionInvoices.length
      ? `Chase ${actionInvoices.length} invoices today. Start with ${formatCurrency(highRiskAmount)} high-risk overdue.`
      : "No urgent chasing today. Keep an eye on due-soon invoices.",
    nextBestAction: topInvoice
      ? `${getSuggestedAction(topInvoice)} for ${topInvoice.customerName} (${topInvoice.invoiceNumber}).`
      : "Review due-soon invoices and keep Xero synced.",
    detail:
      disputeInvoices.length > 0
        ? `${disputeInvoices.length} dispute needs resolving before payment can move.`
        : promisedInvoices.length > 0
          ? `${promisedInvoices.length} promised payment needs confirming.`
          : topInvoice
            ? `${topInvoice.customerName} is ${topInvoice.daysOverdue} days overdue; last chased ${formatDate(topInvoice.lastChasedAt)}.`
            : "No blockers in the recovery queue.",
  };
}

export function sortInvoicesByPriority(invoices: Invoice[]) {
  const urgencyWeight: Record<UrgencyLevel, number> = {
    Critical: 5,
    High: 4,
    Blocked: 3,
    Medium: 2,
    Low: 1,
  };

  return [...invoices].sort((a, b) => {
    const urgencyDelta =
      urgencyWeight[getInvoiceUrgency(b)] - urgencyWeight[getInvoiceUrgency(a)];
    if (urgencyDelta !== 0) return urgencyDelta;
    if (b.daysOverdue !== a.daysOverdue) return b.daysOverdue - a.daysOverdue;
    return b.amount - a.amount;
  });
}

export function getDashboardStats(invoices: Invoice[]) {
  const overdueInvoices = invoices.filter(
    (invoice) =>
      invoice.daysOverdue > 0 &&
      invoice.status !== "Paid" &&
      invoice.status !== "Disputed",
  );
  const dueThisWeek = invoices.filter((invoice) => {
    const due = new Date(invoice.dueDate).getTime();
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const inSevenDays = now.getTime() + 7 * 24 * 60 * 60 * 1000;
    return due >= now.getTime() && due <= inSevenDays && invoice.status !== "Paid";
  });

  const overdueAmount = overdueInvoices.reduce(
    (total, invoice) => total + invoice.amount,
    0,
  );
  const dueThisWeekAmount = dueThisWeek.reduce(
    (total, invoice) => total + invoice.amount,
    0,
  );
  const averageDaysOverdue = overdueInvoices.length
    ? Math.round(
        overdueInvoices.reduce((total, invoice) => total + invoice.daysOverdue, 0) /
          overdueInvoices.length,
      )
    : 0;
  const recoveredAfterChase = invoices
    .filter((invoice) => invoice.status === "Paid" && invoice.chaseCount > 0)
    .reduce((total, invoice) => total + invoice.amount, 0);
  const averageChasesToPayment = invoices.filter(
    (invoice) => invoice.status === "Paid" && invoice.chaseCount > 0,
  ).length
    ? Math.round(
        invoices
          .filter((invoice) => invoice.status === "Paid" && invoice.chaseCount > 0)
          .reduce((total, invoice) => total + invoice.chaseCount, 0) /
          invoices.filter((invoice) => invoice.status === "Paid" && invoice.chaseCount > 0)
            .length,
      )
    : 0;

  return {
    overdueAmount,
    overdueCount: overdueInvoices.length,
    dueThisWeekAmount,
    needsActionToday: invoices.filter(invoiceNeedsActionToday).length,
    promisedPayments: invoices.filter(
      (invoice) => invoice.status === "Promised payment",
    ).length,
    disputedInvoices: invoices.filter((invoice) => invoice.status === "Disputed")
      .length,
    averageDaysOverdue,
    recoveredAfterChase,
    averageChasesToPayment,
  };
}

import type { Customer, CustomerBehaviourProfile, Invoice } from "@/types/zentra";

export function buildCustomerBehaviourProfile(
  customer: Customer,
  invoices: Invoice[],
): CustomerBehaviourProfile {
  const customerInvoices = invoices.filter(
    (invoice) => invoice.customerId === customer.id,
  );
  const openInvoices = customerInvoices.filter(
    (invoice) => invoice.amountOutstanding > 0,
  );
  const paidInvoices = customerInvoices.filter(
    (invoice) => invoice.status === "paid" || invoice.amountOutstanding <= 0,
  );
  const paidLate = paidInvoices.filter((invoice) => invoice.daysOverdue > 0);
  const paidOnTime = paidInvoices.filter((invoice) => invoice.daysOverdue <= 0);
  const missedPromises = customerInvoices.filter(
    (invoice) =>
      invoice.status === "missed_promise" ||
      invoice.promiseToPay?.status === "missed",
  ).length;
  const disputesCount = customerInvoices.filter(
    (invoice) => invoice.status === "disputed" || invoice.dispute,
  ).length;
  const remittanceRequestsCount = customerInvoices.filter(
    (invoice) => invoice.status === "awaiting_remittance" || invoice.remittanceNeeded,
  ).length;
  const statementRequestsCount = customerInvoices.filter(
    (invoice) => invoice.status === "awaiting_statement" || invoice.statementNeeded,
  ).length;
  const totalOutstanding = openInvoices.reduce(
    (total, invoice) => total + invoice.amountOutstanding,
    0,
  );
  const averageDaysLate = average(
    customerInvoices
      .filter((invoice) => invoice.daysOverdue > 0)
      .map((invoice) => invoice.daysOverdue),
  );
  const averageChaseCount = average(
    customerInvoices.map((invoice) => invoice.previousChaseCount),
  );
  const averageDaysToPaymentAfterFirstReminder = paidLate.length
    ? Math.round(
        average(
          paidLate.map((invoice) =>
            Math.max(0, invoice.daysOverdue - Math.min(invoice.daysOverdue, 7)),
          ),
        ),
      )
    : null;
  const remindersUsuallyNeeded = Math.round(averageChaseCount);
  const lastPaidInvoice = [...paidInvoices].sort((a, b) =>
    String(b.lastChasedDate ?? b.dueDate).localeCompare(
      String(a.lastChasedDate ?? a.dueDate),
    ),
  )[0];
  const riskLabel = getRiskLabel({
    totalInvoices: customerInvoices.length,
    averageDaysLate,
    missedPromises,
    disputesCount,
    totalOutstanding,
    averageChaseCount,
  });
  const preferredToneSuggestion = getPreferredToneSuggestion(riskLabel);
  const paymentTermsRecommendation = getPaymentTermsRecommendation(riskLabel);
  const recommendation = getCustomerRecommendation({
    riskLabel,
    missedPromises,
    disputesCount,
    remittanceRequestsCount,
    averageDaysLate,
  });

  return {
    customerId: customer.id,
    businessId: customer.businessId,
    customerName: customer.name,
    totalInvoices: customerInvoices.length,
    openInvoices: openInvoices.length,
    totalOutstanding,
    averageDaysLate,
    invoicesPaidOnTime: paidOnTime.length,
    invoicesPaidLate: paidLate.length,
    averageDaysToPaymentAfterFirstReminder,
    remindersUsuallyNeeded,
    averageChaseCount,
    promisesMade: customerInvoices.filter((invoice) => invoice.promiseToPay).length,
    promisesMissed: missedPromises,
    missedPromisesCount: missedPromises,
    disputesOpen: customerInvoices.filter(
      (invoice) => invoice.dispute?.status && invoice.dispute.status !== "resolved",
    ).length,
    disputesCount,
    remittanceRequestsCount,
    statementRequestsCount,
    paymentsClaimedWithoutRemittance: remittanceRequestsCount,
    lastPaymentDate: lastPaidInvoice?.lastChasedDate,
    lastPaymentBehaviour: lastPaidInvoice
      ? lastPaidInvoice.daysOverdue > 0
        ? `Last paid invoice was ${lastPaidInvoice.daysOverdue} days overdue.`
        : "Last paid invoice appears to have been paid on time."
      : "No paid invoice history in imported data.",
    riskLabel,
    preferredToneSuggestion,
    paymentTermsRecommendation,
    recommendation,
    behaviourLabel: behaviourLabelForRisk(riskLabel),
    memoryNotes: getCustomerMemorySummary({
      customerName: customer.name,
      totalInvoices: customerInvoices.length,
      averageDaysLate,
      remindersUsuallyNeeded,
      missedPromises,
      disputesCount,
      remittanceRequestsCount,
      statementRequestsCount,
      riskLabel,
    }),
  };
}

export function getRiskLabel(metrics: {
  totalInvoices: number;
  averageDaysLate: number;
  missedPromises: number;
  disputesCount: number;
  totalOutstanding: number;
  averageChaseCount: number;
}): CustomerBehaviourProfile["riskLabel"] {
  if (metrics.totalInvoices < 2) return "unknown";
  if (metrics.disputesCount >= 2) return "dispute-prone";
  if (
    metrics.missedPromises >= 2 ||
    metrics.averageDaysLate >= 45 ||
    metrics.totalOutstanding >= 10000
  ) {
    return "high risk";
  }
  if (metrics.averageDaysLate >= 21 || metrics.averageChaseCount >= 2.5) {
    return "regular late payer";
  }
  if (metrics.averageDaysLate >= 7 || metrics.averageChaseCount >= 1) {
    return "slightly slow";
  }
  return "reliable";
}

export function getPreferredToneSuggestion(
  riskLabel: CustomerBehaviourProfile["riskLabel"],
): CustomerBehaviourProfile["preferredToneSuggestion"] {
  if (riskLabel === "high risk") return "firm";
  if (riskLabel === "regular late payer") return "firm";
  if (riskLabel === "dispute-prone") return "neutral";
  if (riskLabel === "unknown") return "neutral";
  return "friendly";
}

export function getPaymentTermsRecommendation(
  riskLabel: CustomerBehaviourProfile["riskLabel"],
) {
  const recommendations: Record<CustomerBehaviourProfile["riskLabel"], string> = {
    reliable: "Keep current terms unless the account context changes.",
    "slightly slow": "Consider a friendly reminder schedule before the due date.",
    "regular late payer": "Consider tighter terms or direct debit for future work.",
    "high risk": "Consider deposit or upfront payment for future work.",
    "dispute-prone": "Request PO or written approval before work starts.",
    unknown: "Not enough history yet to recommend changing terms.",
  };

  return recommendations[riskLabel];
}

export function getCustomerMemorySummary(input: {
  customerName: string;
  totalInvoices: number;
  averageDaysLate: number;
  remindersUsuallyNeeded: number;
  missedPromises: number;
  disputesCount: number;
  remittanceRequestsCount: number;
  statementRequestsCount: number;
  riskLabel: CustomerBehaviourProfile["riskLabel"];
}) {
  if (input.totalInvoices < 2) {
    return ["Not enough history yet."];
  }

  return [
    `Based on previous imported data, ${input.customerName} is labelled ${input.riskLabel}.`,
    `Average days late is ${input.averageDaysLate}.`,
    `Usually needs around ${input.remindersUsuallyNeeded} reminder${input.remindersUsuallyNeeded === 1 ? "" : "s"}.`,
    input.missedPromises
      ? `${input.missedPromises} missed promise${input.missedPromises === 1 ? "" : "s"} recorded.`
      : "",
    input.disputesCount
      ? `${input.disputesCount} dispute${input.disputesCount === 1 ? "" : "s"} recorded.`
      : "",
    input.remittanceRequestsCount
      ? `${input.remittanceRequestsCount} remittance request${input.remittanceRequestsCount === 1 ? "" : "s"} recorded.`
      : "",
    input.statementRequestsCount
      ? `${input.statementRequestsCount} statement request${input.statementRequestsCount === 1 ? "" : "s"} recorded.`
      : "",
  ].filter(Boolean);
}

function getCustomerRecommendation(input: {
  riskLabel: CustomerBehaviourProfile["riskLabel"];
  missedPromises: number;
  disputesCount: number;
  remittanceRequestsCount: number;
  averageDaysLate: number;
}): CustomerBehaviourProfile["recommendation"] {
  if (input.riskLabel === "unknown") return "not enough history yet";
  if (input.riskLabel === "high risk" || input.missedPromises >= 2) {
    return "consider deposit/upfront payment";
  }
  if (input.averageDaysLate >= 21) return "ask for direct debit";
  if (input.disputesCount > 0 || input.remittanceRequestsCount > 1) {
    return "request PO before work starts";
  }
  if (input.riskLabel === "regular late payer") {
    return "account manager should follow up";
  }
  return "keep friendly tone";
}

function behaviourLabelForRisk(
  riskLabel: CustomerBehaviourProfile["riskLabel"],
): CustomerBehaviourProfile["behaviourLabel"] {
  const labels: Record<
    CustomerBehaviourProfile["riskLabel"],
    CustomerBehaviourProfile["behaviourLabel"]
  > = {
    reliable: "usually pays promptly",
    "slightly slow": "needs light chasing",
    "regular late payer": "slow payer",
    "high risk": "high-value risk",
    "dispute-prone": "dispute-prone",
    unknown: "needs light chasing",
  };

  return labels[riskLabel];
}

function average(values: number[]) {
  if (!values.length) return 0;
  return Math.round(values.reduce((total, value) => total + value, 0) / values.length);
}

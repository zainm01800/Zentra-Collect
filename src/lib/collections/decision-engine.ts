import type {
  ActivityEvent,
  CollectionAction,
  CollectionScenario,
  CollectionsDashboardGroup,
  CollectionsPlanItem,
  ConfidenceLevel,
  Customer,
  CustomerBehaviourProfile,
  Dispute,
  Invoice,
  PromiseToPay,
  SafetyCheckCode,
  SafetyCheckResult,
  SafetyStatus,
  SuggestedMessageType,
  UrgencyLevel,
} from "@/types/zentra";

const DAY_MS = 1000 * 60 * 60 * 24;
const DEFAULT_REFERENCE_DATE = "2026-05-07";

type DecisionContext = {
  invoices: Invoice[];
  customers: Customer[];
  activityHistory?: ActivityEvent[];
  promises?: PromiseToPay[];
  disputes?: Dispute[];
  customerBehaviourProfiles?: CustomerBehaviourProfile[];
  referenceDate?: string;
};

type ScenarioContext = {
  customer?: Customer;
  profile?: CustomerBehaviourProfile;
  safetyChecks: SafetyCheckResult[];
  daysSinceLastChase: number | null;
  customerOutstandingTotal: number;
  customerOpenInvoiceCount: number;
  referenceDate: string;
};

export function calculateDaysOverdue(dueDate?: string, referenceDate = DEFAULT_REFERENCE_DATE) {
  if (!dueDate) return 0;

  const due = startOfDay(dueDate);
  const ref = startOfDay(referenceDate);
  return Math.max(0, Math.floor((ref.getTime() - due.getTime()) / DAY_MS));
}

export function getCustomerOutstandingTotal(invoices: Invoice[], customerId: string) {
  return invoices
    .filter((invoice) => invoice.customerId === customerId)
    .reduce((total, invoice) => total + invoice.amountOutstanding, 0);
}

export function getCustomerOpenInvoiceCount(invoices: Invoice[], customerId: string) {
  return invoices.filter(
    (invoice) => invoice.customerId === customerId && invoice.amountOutstanding > 0,
  ).length;
}

export function detectScenario(invoice: Invoice, context: ScenarioContext): CollectionScenario {
  if (invoice.status === "paid" || invoice.amountOutstanding <= 0) return "DO_NOT_CHASE";
  if (invoice.status === "do_not_chase" || context.customer?.doNotChase) {
    return "DO_NOT_CHASE";
  }
  if (!invoice.customerEmail && !context.customer?.apEmail) return "ASK_FOR_AP_CONTACT";
  if (invoice.status === "disputed" || invoice.dispute?.status === "open") {
    return "DISPUTE_RESPONSE";
  }
  if (invoice.paymentClaimed || invoice.remittanceNeeded || invoice.status === "awaiting_remittance") {
    return "REQUEST_REMITTANCE";
  }
  if (invoice.status === "awaiting_statement" || invoice.statementNeeded) {
    return "STATEMENT_OF_ACCOUNT";
  }
  if (hasMissingPoSignal(invoice)) return "INTERNAL_REVIEW";
  if (invoice.status === "needs_ap_contact") return "ASK_FOR_AP_CONTACT";
  if (invoice.promisedPaymentDate || invoice.promiseToPay) {
    return isFutureDate(
      invoice.promisedPaymentDate ?? invoice.promiseToPay?.promisedDate,
      context.referenceDate,
    )
      ? "WAIT"
      : "PROMISE_TO_PAY_FOLLOW_UP";
  }
  if (invoice.status === "missed_promise") return "PROMISE_TO_PAY_FOLLOW_UP";
  if (context.daysSinceLastChase !== null && context.daysSinceLastChase <= 2) {
    return isHighRisk(invoice, context.profile) ? "PAYMENT_REMINDER" : "WAIT";
  }
  if (invoice.daysOverdue <= 0) return "WAIT";
  if (invoice.status === "due_soon" && invoice.daysOverdue === 0) {
    return "CONFIRM_INVOICE_RECEIVED";
  }
  if (context.customerOpenInvoiceCount >= 3) return "STATEMENT_OF_ACCOUNT";

  return "PAYMENT_REMINDER";
}

export function calculatePriorityScore(
  invoice: Invoice,
  scenario: CollectionScenario,
  context: ScenarioContext,
) {
  if (scenario === "DO_NOT_CHASE") return 0;
  if (invoice.status === "paid" || invoice.amountOutstanding <= 0) return 0;

  let score = 10;
  score += Math.min(30, Math.max(invoice.daysOverdue, calculateDaysOverdue(invoice.dueDate, context.referenceDate)) * 0.45);
  score += Math.min(24, invoice.amountOutstanding / 500);
  score += Math.min(12, context.customerOutstandingTotal / 1500);
  score += Math.min(8, context.customerOpenInvoiceCount * 2);
  score += Math.min(10, invoice.previousChaseCount * 2);

  if (scenario === "PROMISE_TO_PAY_FOLLOW_UP") score += 22;
  if (scenario === "REQUEST_REMITTANCE") score += 12;
  if (scenario === "DISPUTE_RESPONSE") score += 10;
  if (scenario === "STATEMENT_OF_ACCOUNT") score += 8;
  if (scenario === "ASK_FOR_AP_CONTACT") score += 4;
  if (scenario === "INTERNAL_REVIEW") score += 2;
  if (scenario === "WAIT") score -= 30;

  if (invoice.status === "missed_promise") score += 18;
  if (invoice.relationshipType === "high-value customer") score += 10;
  if (invoice.relationshipType === "strategic account") score += 6;
  if (["slow payer", "problematic payer"].includes(invoice.relationshipType)) score += 8;
  if (context.profile?.behaviourLabel === "slow payer") score += 8;
  if (context.profile?.behaviourLabel === "high-value risk") score += 10;
  if (context.profile?.promisesMissed) score += Math.min(8, context.profile.promisesMissed * 4);

  if (context.daysSinceLastChase !== null && context.daysSinceLastChase <= 2) {
    score -= isHighRisk(invoice, context.profile) ? 8 : 28;
  }
  if (invoice.amountOutstanding < 500 && invoice.daysOverdue <= 7) score -= 14;
  if (invoice.daysOverdue <= 0) score -= 18;
  if (invoice.dispute || invoice.status === "disputed") score -= 8;
  if (invoice.relationshipType === "strategic account") score -= 3;

  return clamp(Math.round(score), 0, 100);
}

export function generateReason(
  invoice: Invoice,
  scenario: CollectionScenario,
  context: ScenarioContext,
) {
  const parts: string[] = [];

  if (invoice.amountOutstanding > 0) {
    parts.push(`£${invoice.amountOutstanding.toLocaleString("en-GB")} remains outstanding`);
  }
  if (invoice.daysOverdue > 0) parts.push(`${invoice.daysOverdue} days overdue`);
  if (context.customerOutstandingTotal > invoice.amountOutstanding) {
    parts.push(`customer total outstanding is £${context.customerOutstandingTotal.toLocaleString("en-GB")}`);
  }
  if (context.customerOpenInvoiceCount > 1) {
    parts.push(`${context.customerOpenInvoiceCount} open invoices`);
  }
  if (invoice.previousChaseCount > 0) {
    parts.push(`${invoice.previousChaseCount} previous chase${invoice.previousChaseCount === 1 ? "" : "s"}`);
  }

  const scenarioReason: Record<CollectionScenario, string> = {
    PAYMENT_REMINDER: "standard reminder is appropriate",
    PROMISE_TO_PAY_FOLLOW_UP: "promised payment date has passed or needs checking",
    REQUEST_REMITTANCE: "customer appears to have claimed payment but the balance remains open",
    DISPUTE_RESPONSE: "invoice is disputed, so resolve the issue before chasing payment",
    STATEMENT_OF_ACCOUNT: "multiple open items make a statement more useful than a single-invoice reminder",
    CONFIRM_INVOICE_RECEIVED: "invoice is not yet seriously overdue, so confirm receipt first",
    ASK_FOR_AP_CONTACT: "no usable accounts payable contact is available",
    DO_NOT_CHASE: "invoice is paid, excluded, or has no outstanding balance",
    WAIT: "recent chase, future promise date, or not-yet-due status means waiting is safer",
    INTERNAL_REVIEW: "import notes suggest a data or PO issue that should be checked internally",
  };

  parts.push(scenarioReason[scenario]);
  return sentence(parts);
}

export function getSafetyChecks(invoice: Invoice, context: Omit<ScenarioContext, "safetyChecks">) {
  const checks: SafetyCheckResult[] = [];

  if (invoice.amountOutstanding <= 0 || invoice.status === "paid") {
    checks.push(makeSafety(invoice, "blocked", "paid_invoice", "No balance to chase", "The invoice is paid or has no outstanding amount.", false));
  }
  if (invoice.status === "do_not_chase" || context.customer?.doNotChase) {
    checks.push(makeSafety(invoice, "blocked", "do_not_chase", "Do not chase", "This invoice or customer is explicitly excluded from chasing.", false));
  }
  if (!invoice.customerEmail && !context.customer?.apEmail) {
    checks.push(makeSafety(invoice, "blocked", "missing_customer_email", "Missing AP contact", "Add a customer email or AP contact before drafting a message.", false));
  }
  if (invoice.status === "disputed" || invoice.dispute?.status === "open") {
    checks.push(makeSafety(invoice, "blocked", "active_dispute", "Active dispute", "Use a dispute response, not a payment reminder.", true));
  }
  if (invoice.paymentClaimed || invoice.remittanceNeeded) {
    checks.push(makeSafety(invoice, "needs_review", "payment_claimed", "Payment claimed", "Ask for remittance advice before sending another reminder.", true));
  }
  if (invoice.statementNeeded || invoice.status === "awaiting_statement") {
    checks.push(makeSafety(invoice, "needs_review", "statement_needed", "Statement needed", "A statement of account may be clearer than another single-invoice message.", true));
  }
  if (isFutureDate(invoice.promisedPaymentDate ?? invoice.promiseToPay?.promisedDate, context.referenceDate)) {
    checks.push(makeSafety(invoice, "needs_review", "promise_not_due", "Promise date not due", "Wait until the promised payment date has passed.", false));
  }
  if (invoice.status === "missed_promise") {
    checks.push(makeSafety(invoice, "needs_review", "missed_promise", "Missed promise", "Follow up carefully and ask for a revised payment date.", true));
  }
  if (context.daysSinceLastChase !== null && context.daysSinceLastChase <= 2) {
    checks.push(makeSafety(invoice, "needs_review", "recently_chased", "Recently chased", "This customer was chased in the last 48 hours.", true));
  }
  if (invoice.amountOutstanding >= 8000 || invoice.relationshipType === "high-value customer") {
    checks.push(makeSafety(invoice, "needs_review", "high_value", "High-value balance", "Review wording carefully before sending.", true));
  }
  if (!invoice.dueDate || !invoice.invoiceNumber) {
    checks.push(makeSafety(invoice, "needs_review", "data_missing", "Missing invoice data", "Check the import mapping before acting.", false));
  }

  return checks;
}

export function rankCollectionActions(context: DecisionContext): CollectionsPlanItem[] {
  const referenceDate = context.referenceDate ?? DEFAULT_REFERENCE_DATE;
  const promises = context.promises ?? context.invoices.flatMap((invoice) => invoice.promiseToPay ? [invoice.promiseToPay] : []);
  const disputes = context.disputes ?? context.invoices.flatMap((invoice) => invoice.dispute ? [invoice.dispute] : []);

  return context.invoices
    .map((invoice) => {
      const customer = context.customers.find((item) => item.id === invoice.customerId);
      const profile = context.customerBehaviourProfiles?.find(
        (item) => item.customerId === invoice.customerId,
      );
      const daysSinceLastChase = invoice.lastChasedDate
        ? daysBetween(invoice.lastChasedDate, referenceDate)
        : null;
      const customerOutstandingTotal = getCustomerOutstandingTotal(context.invoices, invoice.customerId);
      const customerOpenInvoiceCount = getCustomerOpenInvoiceCount(context.invoices, invoice.customerId);
      const matchingPromise = promises.find((promise) => promise.invoiceId === invoice.id);
      const matchingDispute = disputes.find((dispute) => dispute.invoiceId === invoice.id);
      const hydratedInvoice = {
        ...invoice,
        promiseToPay: invoice.promiseToPay ?? matchingPromise,
        dispute: invoice.dispute ?? matchingDispute,
      };
      const safetyContext = {
        customer,
        profile,
        daysSinceLastChase,
        customerOutstandingTotal,
        customerOpenInvoiceCount,
        referenceDate,
      };
      const safetyChecks = getSafetyChecks(hydratedInvoice, safetyContext);
      const scenarioContext = { ...safetyContext, safetyChecks };
      const scenario = detectScenario(hydratedInvoice, scenarioContext);
      const priorityScore = calculatePriorityScore(hydratedInvoice, scenario, scenarioContext);
      const recommendedAction = actionForScenario(scenario);

      return {
        id: `plan-${invoice.id}`,
        invoiceId: invoice.id,
        customerId: invoice.customerId,
        businessId: invoice.businessId,
        customerName: invoice.customerName,
        invoiceNumber: invoice.invoiceNumber,
        amountOutstanding: invoice.amountOutstanding,
        recommendedAction,
        scenario,
        reason: generateReason(hydratedInvoice, scenario, scenarioContext),
        priorityScore,
        urgencyLevel: urgencyForScore(priorityScore),
        confidenceLevel: confidenceFor(hydratedInvoice, scenario, safetyChecks),
        safetyStatus: safetyStatusFor(safetyChecks),
        suggestedMessageType: messageTypeForScenario(scenario, hydratedInvoice),
        nextFollowUpDate: nextFollowUpDateFor(hydratedInvoice, scenario, referenceDate),
        safetyChecks,
        dashboardGroup: dashboardGroupFor(scenario, safetyChecks, priorityScore),
      } satisfies CollectionsPlanItem;
    })
    .sort((a, b) => b.priorityScore - a.priorityScore);
}

export function groupActionsByCategory(plan: CollectionsPlanItem[]) {
  const groups: Record<CollectionsDashboardGroup, CollectionsPlanItem[]> = {
    chase_now: [],
    promises_to_check: [],
    exceptions_to_resolve: [],
    wait_low_priority: [],
    do_not_chase: [],
  };

  for (const item of plan) {
    groups[item.dashboardGroup].push(item);
  }

  return groups;
}

function actionForScenario(scenario: CollectionScenario): CollectionAction {
  const actions: Record<CollectionScenario, CollectionAction> = {
    PAYMENT_REMINDER: "send_payment_reminder",
    PROMISE_TO_PAY_FOLLOW_UP: "follow_up_promise_to_pay",
    REQUEST_REMITTANCE: "request_remittance_advice",
    DISPUTE_RESPONSE: "respond_to_dispute",
    STATEMENT_OF_ACCOUNT: "send_statement_of_account",
    CONFIRM_INVOICE_RECEIVED: "send_payment_reminder",
    ASK_FOR_AP_CONTACT: "find_ap_contact",
    DO_NOT_CHASE: "do_not_chase",
    WAIT: "no_action_needed",
    INTERNAL_REVIEW: "no_action_needed",
  };

  return actions[scenario];
}

function messageTypeForScenario(
  scenario: CollectionScenario,
  invoice: Invoice,
): SuggestedMessageType {
  if (scenario === "PAYMENT_REMINDER") {
    if (invoice.daysOverdue >= 30 || invoice.previousChaseCount >= 2) return "firm_reminder";
    if (invoice.daysOverdue >= 8) return "neutral_reminder";
    return "friendly_reminder";
  }

  const messageTypes: Record<Exclude<CollectionScenario, "PAYMENT_REMINDER">, SuggestedMessageType> = {
    PROMISE_TO_PAY_FOLLOW_UP: "promise_follow_up",
    REQUEST_REMITTANCE: "remittance_request",
    DISPUTE_RESPONSE: "dispute_response",
    STATEMENT_OF_ACCOUNT: "statement_request",
    CONFIRM_INVOICE_RECEIVED: "invoice_received_check",
    ASK_FOR_AP_CONTACT: "ap_contact_request",
    DO_NOT_CHASE: "no_message",
    WAIT: "no_message",
    INTERNAL_REVIEW: "no_message",
  };

  return messageTypes[scenario];
}

function dashboardGroupFor(
  scenario: CollectionScenario,
  safetyChecks: SafetyCheckResult[],
  priorityScore: number,
): CollectionsDashboardGroup {
  if (scenario === "DO_NOT_CHASE") return "do_not_chase";
  if (scenario === "PROMISE_TO_PAY_FOLLOW_UP") return "promises_to_check";
  if (
    ["DISPUTE_RESPONSE", "REQUEST_REMITTANCE", "STATEMENT_OF_ACCOUNT", "ASK_FOR_AP_CONTACT", "INTERNAL_REVIEW"].includes(
      scenario,
    ) ||
    safetyChecks.some((check) => check.status === "blocked")
  ) {
    return "exceptions_to_resolve";
  }
  if (scenario === "WAIT" || priorityScore < 35) return "wait_low_priority";
  return "chase_now";
}

function safetyStatusFor(checks: SafetyCheckResult[]): SafetyStatus {
  if (checks.some((check) => check.status === "blocked")) return "blocked";
  if (checks.some((check) => check.status === "needs_review")) return "needs_review";
  return "safe_to_draft";
}

function urgencyForScore(score: number): UrgencyLevel {
  if (score >= 80) return "critical";
  if (score >= 60) return "high";
  if (score >= 35) return "medium";
  return "low";
}

function confidenceFor(
  invoice: Invoice,
  scenario: CollectionScenario,
  checks: SafetyCheckResult[],
): ConfidenceLevel {
  if (!invoice.dueDate || !invoice.customerName || checks.some((check) => check.code === "data_missing")) {
    return "low";
  }
  if (["INTERNAL_REVIEW", "ASK_FOR_AP_CONTACT"].includes(scenario)) return "medium";
  if (checks.some((check) => check.status === "blocked")) return "high";
  if (checks.some((check) => check.status === "needs_review")) return "medium";
  return "high";
}

function nextFollowUpDateFor(
  invoice: Invoice,
  scenario: CollectionScenario,
  referenceDate: string,
) {
  if (scenario === "WAIT") {
    return invoice.promisedPaymentDate && isFutureDate(invoice.promisedPaymentDate, referenceDate)
      ? invoice.promisedPaymentDate
      : addDays(referenceDate, 2);
  }
  if (scenario === "PROMISE_TO_PAY_FOLLOW_UP") return addDays(referenceDate, 1);
  if (scenario === "REQUEST_REMITTANCE" || scenario === "DISPUTE_RESPONSE") {
    return addDays(referenceDate, 3);
  }
  if (scenario === "PAYMENT_REMINDER") return addDays(referenceDate, invoice.daysOverdue >= 30 ? 3 : 5);
  return undefined;
}

function makeSafety(
  invoice: Invoice,
  status: SafetyStatus,
  code: SafetyCheckCode,
  title: string,
  explanation: string,
  canDraftMessage: boolean,
): SafetyCheckResult {
  return {
    id: `${invoice.id}-${code}`,
    invoiceId: invoice.id,
    status,
    code,
    title,
    explanation,
    canDraftMessage,
    requiresHumanReview: status !== "safe_to_draft",
  };
}

function hasMissingPoSignal(invoice: Invoice) {
  return [invoice.customerNotes, invoice.disputeReason, ...(invoice.activityHistory ?? []).map((event) => event.description)]
    .filter(Boolean)
    .some((text) => /po\b|purchase order|reference/i.test(String(text)));
}

function isHighRisk(invoice: Invoice, profile?: CustomerBehaviourProfile) {
  return (
    invoice.amountOutstanding >= 8000 ||
    invoice.relationshipType === "high-value customer" ||
    invoice.relationshipType === "problematic payer" ||
    profile?.behaviourLabel === "high-value risk" ||
    profile?.behaviourLabel === "slow payer"
  );
}

function isFutureDate(date: string | undefined, referenceDate: string) {
  if (!date) return false;
  return startOfDay(date).getTime() > startOfDay(referenceDate).getTime();
}

function daysBetween(date: string, referenceDate: string) {
  return Math.floor(
    (startOfDay(referenceDate).getTime() - startOfDay(date).getTime()) / DAY_MS,
  );
}

function addDays(date: string, days: number) {
  const next = startOfDay(date);
  next.setDate(next.getDate() + days);
  return next.toISOString().slice(0, 10);
}

function startOfDay(date: string) {
  const next = new Date(`${date.slice(0, 10)}T00:00:00.000Z`);
  return Number.isNaN(next.getTime()) ? new Date(`${DEFAULT_REFERENCE_DATE}T00:00:00.000Z`) : next;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function sentence(parts: string[]) {
  const text = parts.filter(Boolean).join("; ");
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}.`;
}

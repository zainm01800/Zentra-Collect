import { formatCurrency, formatDate } from "@/lib/formatters";
import { buildInvoiceMessageSafetyResult, type UnifiedSafetyResult } from "@/lib/collections/safety";
import type {
  CollectionsPlanItem,
  Invoice,
  Customer,
  CustomerBehaviourProfile,
  ActionScenario,
  CollectionScenario,
  ScenarioDetails,
} from "@/types/zentra";
import type { DraftScenario, DraftTone } from "@/lib/ai/zentra-drafts";

export function emptyScenarioDetails(): ScenarioDetails {
  return {
    promisedDate: "",
    promisedAmount: "",
    promisedBy: "",
    paymentClaimDate: "",
    paymentReference: "",
    amountClaimedPaid: "",
    disputeReason: "",
    disputeOwner: "",
    nextResolutionDate: "",
    disputeNotes: "",
    includeMultipleInvoices: false,
    totalOutstanding: "",
    statementSummary: "",
    currentContact: "",
    requestedContactRole: "",
    internalOwner: "",
    escalationNote: "",
  };
}

export function scenarioDetailsForInvoice(
  invoice: Invoice,
  allInvoices: Invoice[],
): ScenarioDetails {
  const customerInvoices = allInvoices.filter(
    (i) => i.customerId === invoice.customerId && i.amountOutstanding > 0,
  );
  const totalOutstanding = customerInvoices.reduce(
    (sum, i) => sum + i.amountOutstanding,
    0,
  );

  return {
    promisedDate: invoice.promisedPaymentDate || "",
    promisedAmount: String(invoice.amountOutstanding),
    promisedBy: "",
    paymentClaimDate: "",
    paymentReference: "",
    amountClaimedPaid: String(invoice.amountOutstanding),
    disputeReason: invoice.disputeReason || "",
    disputeOwner: "",
    nextResolutionDate: "",
    disputeNotes: "",
    includeMultipleInvoices: customerInvoices.length > 1,
    totalOutstanding: String(totalOutstanding),
    statementSummary: `Total outstanding: ${formatCurrency(totalOutstanding)}`,
    currentContact: invoice.customerEmail || "",
    requestedContactRole: "AP/Accounts Payable",
    internalOwner: "",
    escalationNote: `Invoice ${invoice.invoiceNumber} requires escalation.`,
  };
}

export function actionScenarioForPlan(item: CollectionsPlanItem): ActionScenario {
  const scenarios: Partial<Record<CollectionScenario, ActionScenario>> = {
    PAYMENT_REMINDER: "SEND_PAYMENT_REMINDER",
    PROMISE_TO_PAY_FOLLOW_UP: "PROMISE_FOLLOW_UP",
    DISPUTE_RESPONSE: "RESOLVE_DISPUTE",
    REQUEST_REMITTANCE: "REQUEST_REMITTANCE",
    ASK_FOR_AP_CONTACT: "ASK_FOR_AP_CONTACT",
    CONFIRM_INVOICE_RECEIVED: "CONFIRM_INVOICE_RECEIVED",
    STATEMENT_OF_ACCOUNT: "STATEMENT_OF_ACCOUNT",
    DO_NOT_CHASE: "INTERNAL_ESCALATION",
    WAIT: "INTERNAL_ESCALATION",
    INTERNAL_REVIEW: "INTERNAL_ESCALATION",
  };
  return scenarios[item.scenario] ?? "SEND_PAYMENT_REMINDER";
}

export function draftScenarioForAction(scenario: ActionScenario): DraftScenario | null {
  const scenarios: Record<ActionScenario, DraftScenario | null> = {
    SEND_PAYMENT_REMINDER: "PAYMENT_REMINDER",
    ASK_FOR_PAYMENT_DATE: "ASK_FOR_PAYMENT_DATE",
    REQUEST_REMITTANCE: "REQUEST_REMITTANCE",
    STATEMENT_OF_ACCOUNT: "STATEMENT_OF_ACCOUNT",
    CONFIRM_INVOICE_RECEIVED: "CONFIRM_INVOICE_RECEIVED",
    ASK_FOR_AP_CONTACT: "ASK_FOR_AP_CONTACT",
    PROMISE_FOLLOW_UP: "PROMISE_TO_PAY_FOLLOW_UP",
    RESOLVE_DISPUTE: "DISPUTE_RESPONSE",
    INTERNAL_ESCALATION: null,
    THANK_YOU_AFTER_PAYMENT: null,
  };
  return scenarios[scenario];
}

export function buildDraftMessage(item: CollectionsPlanItem, invoice: Invoice): string {
  const greeting = "Hi,";
  const amount = formatCurrency(invoice.amountOutstanding);
  const dueDate = invoice.dueDate ? formatDate(invoice.dueDate) : "the due date";

  const bodies: Record<CollectionScenario, string> = {
    PAYMENT_REMINDER: `${greeting}\n\nI hope you're well. I wanted to follow up on invoice ${invoice.invoiceNumber} for ${amount}, which was due on ${dueDate}.\n\nCould you please confirm when payment will be made?\n\nThanks,`,
    PROMISE_TO_PAY_FOLLOW_UP: `${greeting}\n\nFollowing up on the promised payment for invoice ${invoice.invoiceNumber} (${amount}).\n\nCould you confirm the payment status or provide an updated timeline?\n\nThanks,`,
    DISPUTE_RESPONSE: `${greeting}\n\nThank you for raising your query about invoice ${invoice.invoiceNumber}.\n\nI'm looking into this and will get back to you within 24 hours with a resolution or update.\n\nThanks for your patience,`,
    REQUEST_REMITTANCE: `${greeting}\n\nThank you for confirming payment for invoice ${invoice.invoiceNumber}.\n\nCould you please provide the remittance advice or payment reference so I can reconcile this in our system?\n\nThanks,`,
    ASK_FOR_AP_CONTACT: `${greeting}\n\nI'm trying to reach the right person to discuss invoice ${invoice.invoiceNumber} for ${amount}.\n\nCould you please provide the contact details for your AP/Accounts Payable department?\n\nThanks,`,
    CONFIRM_INVOICE_RECEIVED: `${greeting}\n\nJust checking you received invoice ${invoice.invoiceNumber} for ${amount} sent on ${dueDate}.\n\nPlease confirm receipt and let me know if you need any further information.\n\nThanks,`,
    STATEMENT_OF_ACCOUNT: `${greeting}\n\nAs requested, please find attached a statement of account showing all outstanding invoices.\n\nTotal due: ${amount}\n\nLet me know if you need any clarification.\n\nThanks,`,
    DO_NOT_CHASE: "",
    WAIT: "",
    INTERNAL_REVIEW: "",
  };

  return bodies[item.scenario] ?? bodies.PAYMENT_REMINDER;
}

export function defaultSubject(item: CollectionsPlanItem, invoice: Invoice): string {
  if (item.scenario === "DISPUTE_RESPONSE") {
    return `Invoice ${invoice.invoiceNumber} - query to resolve`;
  }
  if (item.scenario === "REQUEST_REMITTANCE") {
    return `Payment confirmation - Invoice ${invoice.invoiceNumber}`;
  }
  if (item.scenario === "ASK_FOR_AP_CONTACT") {
    return `Accounts payable contact request - ${invoice.customerName}`;
  }
  if (item.scenario === "PROMISE_TO_PAY_FOLLOW_UP") {
    return `Following up on promised payment - Invoice ${invoice.invoiceNumber}`;
  }
  return `Payment reminder: invoice ${invoice.invoiceNumber}`;
}

export function defaultSubjectForAction(
  scenario: ActionScenario,
  item: CollectionsPlanItem,
  invoice: Invoice,
): string {
  const subjects: Partial<Record<ActionScenario, string>> = {
    REQUEST_REMITTANCE: `Payment confirmation request - Invoice ${invoice.invoiceNumber}`,
    ASK_FOR_AP_CONTACT: `Accounts payable contact request - ${invoice.customerName}`,
    RESOLVE_DISPUTE: `Invoice ${invoice.invoiceNumber} - query resolution`,
    PROMISE_FOLLOW_UP: `Following up on promised payment - Invoice ${invoice.invoiceNumber}`,
    INTERNAL_ESCALATION: `Escalation: Invoice ${invoice.invoiceNumber}`,
  };
  return subjects[scenario] ?? defaultSubject(item, invoice);
}

export function buildActionDraftMessage(
  scenario: ActionScenario,
  item: CollectionsPlanItem,
  invoice: Invoice,
  allInvoices: Invoice[],
  details: ScenarioDetails,
): string {
  const greeting = "Hi,";
  const amount = formatCurrency(invoice.amountOutstanding);
  const invNum = invoice.invoiceNumber;
  const dueDate = invoice.dueDate ? formatDate(invoice.dueDate) : "the due date";

  const templates: Record<ActionScenario, string> = {
    SEND_PAYMENT_REMINDER: `${greeting}\n\nI hope you're well. I wanted to follow up on invoice ${invNum} for ${amount}, which was due on ${dueDate}.\n\nCould you please confirm when payment will be made? If you've already sent it, please let me know.\n\nThanks,`,
    
    ASK_FOR_PAYMENT_DATE: `${greeting}\n\nI'm following up on invoice ${invNum} (${amount}). Could you please let me know when we can expect payment for this?\n\nHaving a specific date helps us manage our records correctly.\n\nThanks,`,
    
    PROMISE_FOLLOW_UP: `${greeting}\n\nFollowing up on the payment promised for ${details.promisedDate ? formatDate(details.promisedDate) : "a previous date"} regarding invoice ${invNum} (${amount}).\n\nCould you please confirm whether this has now been processed?\n\nThanks,`,
    
    REQUEST_REMITTANCE: `${greeting}\n\nThank you for confirming that payment has been made for invoice ${invNum}.\n\nCould you please provide the remittance advice or a payment reference so I can allocate this correctly in our system?\n\nThanks,`,
    
    STATEMENT_OF_ACCOUNT: `${greeting}\n\nPlease find below a summary of outstanding invoices for your account.\n\n${details.statementSummary || `Total outstanding: ${amount}`}\n\nCould you please confirm the payment status of these items?\n\nThanks,`,
    
    RESOLVE_DISPUTE: `${greeting}\n\nThank you for raising your query regarding invoice ${invNum}.\n\nI am investigating the issue (${details.disputeReason || "the query raised"}) and will get back to you as soon as possible with a resolution.\n\nThanks for your patience,`,
    
    CONFIRM_INVOICE_RECEIVED: `${greeting}\n\nJust checking to confirm that you received invoice ${invNum} for ${amount} sent on ${dueDate}.\n\nPlease let me know if you need a copy resent or if it should be directed to a different contact.\n\nThanks,`,
    
    ASK_FOR_AP_CONTACT: `${greeting}\n\nI'm trying to reach the correct person to discuss invoice ${invNum}.\n\nCould you please let me know who handles accounts payable or payment queries for your company?\n\nThanks,`,
    
    INTERNAL_ESCALATION: `INTERNAL NOTE: Invoice ${invNum} for ${amount} is ${invoice.daysOverdue} days overdue. ${details.escalationNote || "Requires internal review."}`,
    
    THANK_YOU_AFTER_PAYMENT: `${greeting}\n\nThank you for the payment received for invoice ${invNum}. We appreciate your promptness.\n\nBest regards,`,
    
    DO_NOT_CHASE: `INTERNAL NOTE: Chasing on invoice ${invNum} is currently on hold. Reason: ${details.disputeReason || "Not specified"}. Follow-up scheduled for ${details.nextResolutionDate ? formatDate(details.nextResolutionDate) : "later"}.`
  };

  return templates[scenario] || templates.SEND_PAYMENT_REMINDER;
}

export function recommendedToneFor(item: CollectionsPlanItem): DraftTone {
  if (item.scenario === "DISPUTE_RESPONSE") return "neutral";
  if (item.scenario === "REQUEST_REMITTANCE") return "neutral";
  if (item.scenario === "PROMISE_TO_PAY_FOLLOW_UP") return "firm";
  if (item.urgencyLevel === "critical") return "firm";
  if (item.urgencyLevel === "high") return "firm";
  return "friendly";
}

export function formatSafetyRiskNotes(result: UnifiedSafetyResult): string {
  return `${result.warningMessage} ${result.checks
    .map((check) => check.message)
    .join(" ")}`.trim();
}

export function buildDrawerSafetyResult(
  item: CollectionsPlanItem,
  invoice: Invoice,
  tone?: DraftTone,
): UnifiedSafetyResult {
  return buildInvoiceMessageSafetyResult({
    invoice,
    tone,
  });
}

export function actionScenarioMeta(
  scenario: ActionScenario,
  invoice: Invoice,
  allInvoices: Invoice[],
  details: ScenarioDetails,
  tone?: DraftTone,
): {
  recommendedAction: string;
  explanation: string;
  confidence: string;
  safetyStatus: string;
  safetyResult: UnifiedSafetyResult;
} {
  const actionLabels: Record<ActionScenario, string> = {
    SEND_PAYMENT_REMINDER: "Send payment reminder",
    ASK_FOR_PAYMENT_DATE: "Ask for payment date",
    REQUEST_REMITTANCE: "Request remittance advice",
    STATEMENT_OF_ACCOUNT: "Send statement of account",
    CONFIRM_INVOICE_RECEIVED: "Confirm invoice receipt",
    ASK_FOR_AP_CONTACT: "Ask for AP contact",
    PROMISE_FOLLOW_UP: "Follow up promised payment",
    RESOLVE_DISPUTE: "Resolve dispute",
    INTERNAL_ESCALATION: "Escalate internally",
    THANK_YOU_AFTER_PAYMENT: "Send thank you message",
  };

  const explanations: Record<ActionScenario, string> = {
    SEND_PAYMENT_REMINDER: `Invoice ${invoice.invoiceNumber} is ${invoice.daysOverdue} days overdue. A polite reminder is the appropriate next step.`,
    ASK_FOR_PAYMENT_DATE: `We need to establish when ${invoice.customerName} intends to pay invoice ${invoice.invoiceNumber}.`,
    REQUEST_REMITTANCE: `Customer claims payment was made. Request remittance details to reconcile.`,
    STATEMENT_OF_ACCOUNT: `Send a statement showing all outstanding invoices for ${invoice.customerName}.`,
    CONFIRM_INVOICE_RECEIVED: `Verify that invoice ${invoice.invoiceNumber} was received and is being processed.`,
    ASK_FOR_AP_CONTACT: `Identify the correct AP contact to discuss invoice ${invoice.invoiceNumber}.`,
    PROMISE_FOLLOW_UP: `Follow up on payment promised for ${details.promisedDate || "the due date"}.`,
    RESOLVE_DISPUTE: `Address the dispute regarding: ${details.disputeReason || "the customer's query"}.`,
    INTERNAL_ESCALATION: `This invoice requires internal review before further action.`,
    THANK_YOU_AFTER_PAYMENT: `Acknowledge payment received for invoice ${invoice.invoiceNumber}.`,
  };

  const safety = buildInvoiceMessageSafetyResult({
    invoice,
    tone,
  });

  return {
    recommendedAction: actionLabels[scenario],
    explanation: explanations[scenario],
    confidence: invoice.daysOverdue > 30 ? "high" : "medium",
    safetyStatus: safety.status,
    safetyResult: safety,
  };
}

export function humanLabel(action: string): string {
  return action
    .toLowerCase()
    .replace(/_/g, " ");
}

export const actionScenarioOptions: Array<{ value: ActionScenario; label: string }> = [
  { value: "SEND_PAYMENT_REMINDER", label: "Send payment reminder" },
  { value: "ASK_FOR_PAYMENT_DATE", label: "Ask for payment date" },
  { value: "REQUEST_REMITTANCE", label: "Request remittance advice" },
  { value: "STATEMENT_OF_ACCOUNT", label: "Send/request statement of account" },
  { value: "CONFIRM_INVOICE_RECEIVED", label: "Confirm invoice was received" },
  { value: "ASK_FOR_AP_CONTACT", label: "Ask for AP/accounts contact" },
  { value: "PROMISE_FOLLOW_UP", label: "Follow up promised payment" },
  { value: "RESOLVE_DISPUTE", label: "Resolve dispute" },
  { value: "INTERNAL_ESCALATION", label: "Escalate internally" },
  { value: "THANK_YOU_AFTER_PAYMENT", label: "Send thank-you after payment" },
  { value: "DO_NOT_CHASE", label: "Do not chase" },
];

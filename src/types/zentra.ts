export type CurrencyCode = "GBP";

export type RelationshipType =
  | "new customer"
  | "regular customer"
  | "high-value customer"
  | "slow payer"
  | "problematic payer"
  | "strategic account"
  | "do not chase";

export type CollectionAction =
  | "send_payment_reminder"
  | "follow_up_promise_to_pay"
  | "request_remittance_advice"
  | "respond_to_dispute"
  | "send_statement_of_account"
  | "find_ap_contact"
  | "call_customer"
  | "do_not_chase"
  | "no_action_needed";

export type CollectionScenario =
  | "PAYMENT_REMINDER"
  | "PROMISE_TO_PAY_FOLLOW_UP"
  | "REQUEST_REMITTANCE"
  | "DISPUTE_RESPONSE"
  | "STATEMENT_OF_ACCOUNT"
  | "CONFIRM_INVOICE_RECEIVED"
  | "ASK_FOR_AP_CONTACT"
  | "DO_NOT_CHASE"
  | "WAIT"
  | "INTERNAL_REVIEW";

export type ActionScenario =
  | "SEND_PAYMENT_REMINDER"
  | "ASK_FOR_PAYMENT_DATE"
  | "REQUEST_REMITTANCE"
  | "STATEMENT_OF_ACCOUNT"
  | "CONFIRM_INVOICE_RECEIVED"
  | "ASK_FOR_AP_CONTACT"
  | "PROMISE_FOLLOW_UP"
  | "RESOLVE_DISPUTE"
  | "INTERNAL_ESCALATION"
  | "THANK_YOU_AFTER_PAYMENT";

export interface ScenarioDetails {
  promisedDate: string;
  promisedAmount: string;
  promisedBy: string;
  paymentClaimDate: string;
  paymentReference: string;
  amountClaimedPaid: string;
  disputeReason: string;
  disputeOwner: string;
  nextResolutionDate: string;
  disputeNotes: string;
  includeMultipleInvoices: boolean;
  totalOutstanding: string;
  statementSummary: string;
  currentContact: string;
  requestedContactRole: string;
  internalOwner: string;
  escalationNote: string;
}

export type CollectionStatus =
  | "overdue"
  | "due_soon"
  | "promised"
  | "missed_promise"
  | "disputed"
  | "awaiting_remittance"
  | "awaiting_statement"
  | "needs_ap_contact"
  | "paid"
  | "do_not_chase";

export type SafetyStatus = "safe_to_draft" | "needs_review" | "blocked";

export type UrgencyLevel = "low" | "medium" | "high" | "critical";

export type ConfidenceLevel = "low" | "medium" | "high";

export type SuggestedMessageType =
  | "friendly_reminder"
  | "neutral_reminder"
  | "firm_reminder"
  | "promise_follow_up"
  | "remittance_request"
  | "dispute_response"
  | "statement_request"
  | "invoice_received_check"
  | "ap_contact_request"
  | "no_message";

export type CollectionsDashboardGroup =
  | "chase_now"
  | "promises_to_check"
  | "exceptions_to_resolve"
  | "wait_low_priority"
  | "do_not_chase";

export type SafetyCheckCode =
  | "missing_customer_email"
  | "missing_ap_contact"
  | "active_dispute"
  | "promise_not_due"
  | "missed_promise"
  | "recently_chased"
  | "payment_claimed"
  | "statement_needed"
  | "do_not_chase"
  | "paid_invoice"
  | "high_value"
  | "final_notice_risk"
  | "data_missing";

export type ImportSource = "demo" | "csv" | "excel";

export type ImportMappingConfidence = "high" | "medium" | "low";

export type ImportDiffType =
  | "new_invoice"
  | "paid_since_last_import"
  | "balance_changed"
  | "status_changed"
  | "promise_missed"
  | "new_dispute"
  | "customer_detail_changed";

export type ActivityEventType =
  | "imported"
  | "recommendation_created"
  | "message_drafted"
  | "message_copied"
  | "chase_marked_sent"
  | "promise_recorded"
  | "promise_missed"
  | "dispute_recorded"
  | "remittance_requested"
  | "statement_requested"
  | "paid"
  | "note_added"
  | "safety_blocked";

export interface Business {
  id: string;
  name: string;
  tradingName?: string;
  businessType: "agency" | "consultancy" | "service_business" | "bookkeeping_practice";
  registeredCountry: "UK";
  defaultCurrency: CurrencyCode;
  contactEmail: string;
  senderName: string;
  replyToEmail: string;
  paymentTermsDays: number;
  brandVoiceNotes: string;
  createdAt: string;
}

export interface BookkeeperClient {
  id: string;
  bookkeeperBusinessId: string;
  business: Business;
  portfolioLabel: string;
  primaryContactName: string;
  primaryContactEmail: string;
  importAlias?: string;
  lastImportBatchId?: string;
  notes?: string;
}

export interface Customer {
  id: string;
  businessId: string;
  name: string;
  email?: string;
  contactName?: string;
  contactRole?: string;
  apEmail?: string;
  apContactName?: string;
  relationshipType: RelationshipType;
  customerNotes?: string;
  doNotChase?: boolean;
  createdAt: string;
}

export interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface PromiseToPay {
  id: string;
  invoiceId: string;
  promisedAmount: number;
  promisedDate: string;
  recordedAt: string;
  recordedBy: string;
  status: "open" | "met" | "missed" | "cancelled";
  notes?: string;
}

export interface Dispute {
  id: string;
  invoiceId: string;
  reason: string;
  raisedAt: string;
  raisedBy?: string;
  owner?: string;
  status: "open" | "waiting_on_customer" | "waiting_on_business" | "resolved";
  resolutionNotes?: string;
}

export interface ActivityEvent {
  id: string;
  invoiceId?: string;
  customerId?: string;
  businessId: string;
  type: ActivityEventType;
  title: string;
  description: string;
  createdAt: string;
  createdBy: string;
}

export interface Invoice {
  id: string;
  businessId: string;
  bookkeeperClientId?: string;
  customerId: string;
  customerName: string;
  customerEmail?: string;
  customerContactRole?: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate?: string;
  amount: number;
  amountOutstanding: number;
  currency: CurrencyCode;
  status: CollectionStatus;
  daysOverdue: number;
  previousChaseCount: number;
  lastChasedDate?: string;
  promisedPaymentDate?: string;
  disputeReason?: string;
  paymentClaimed?: boolean;
  remittanceNeeded?: boolean;
  statementNeeded?: boolean;
  relationshipType: RelationshipType;
  customerNotes?: string;
  lineItems: InvoiceLineItem[];
  activityHistory: ActivityEvent[];
  promiseToPay?: PromiseToPay;
  dispute?: Dispute;
  sourceBatchId: string;
  importedRowNumber: number;
}

export interface ImportMapping {
  id: string;
  batchId: string;
  sourceColumn: string;
  targetField:
    | "customerName"
    | "customerEmail"
    | "invoiceNumber"
    | "invoiceDate"
    | "dueDate"
    | "amount"
    | "amountOutstanding"
    | "status"
    | "notes"
    | "contactRole"
    | "promiseDate"
    | "disputeReason";
  confidence: ImportMappingConfidence;
  reviewedByUser: boolean;
}

export interface ImportBatch {
  id: string;
  businessId: string;
  bookkeeperClientId?: string;
  source: ImportSource;
  fileName: string;
  importedAt: string;
  importedBy: string;
  rowCount: number;
  validInvoiceCount: number;
  warningCount: number;
  mappings: ImportMapping[];
  notes?: string;
}

export interface ImportDiff {
  id: string;
  currentBatchId: string;
  previousBatchId?: string;
  invoiceId?: string;
  customerId?: string;
  type: ImportDiffType;
  title: string;
  description: string;
  beforeValue?: string | number | null;
  afterValue?: string | number | null;
  severity: "info" | "attention" | "important";
}

export interface CustomerBehaviourProfile {
  customerId: string;
  businessId: string;
  customerName: string;
  totalInvoices: number;
  openInvoices: number;
  totalOutstanding: number;
  averageDaysLate: number;
  invoicesPaidOnTime: number;
  invoicesPaidLate: number;
  averageDaysToPaymentAfterFirstReminder: number | null;
  remindersUsuallyNeeded: number;
  averageChaseCount: number;
  promisesMade: number;
  promisesMissed: number;
  missedPromisesCount: number;
  disputesOpen: number;
  disputesCount: number;
  remittanceRequestsCount: number;
  statementRequestsCount: number;
  paymentsClaimedWithoutRemittance: number;
  lastPaymentDate?: string;
  lastPaymentBehaviour: string;
  riskLabel:
    | "reliable"
    | "slightly slow"
    | "regular late payer"
    | "high risk"
    | "dispute-prone"
    | "unknown";
  preferredToneSuggestion: "friendly" | "neutral" | "firm" | "final";
  paymentTermsRecommendation: string;
  recommendation:
    | "consider deposit/upfront payment"
    | "ask for direct debit"
    | "request PO before work starts"
    | "keep friendly tone"
    | "account manager should follow up"
    | "not enough history yet";
  behaviourLabel:
    | "usually pays promptly"
    | "needs light chasing"
    | "slow payer"
    | "dispute-prone"
    | "high-value risk"
    | "do not chase";
  memoryNotes: string[];
}

export interface SafetyCheckResult {
  id: string;
  invoiceId: string;
  status: SafetyStatus;
  code: SafetyCheckCode;
  title: string;
  explanation: string;
  canDraftMessage: boolean;
  requiresHumanReview: boolean;
}

export interface CollectionsPlanItem {
  id: string;
  invoiceId: string;
  customerId: string;
  businessId: string;
  customerName: string;
  invoiceNumber: string;
  amountOutstanding: number;
  recommendedAction: CollectionAction;
  scenario: CollectionScenario;
  reason: string;
  priorityScore: number;
  urgencyLevel: UrgencyLevel;
  confidenceLevel: ConfidenceLevel;
  safetyStatus: SafetyStatus;
  suggestedMessageType: SuggestedMessageType;
  nextFollowUpDate?: string;
  safetyChecks: SafetyCheckResult[];
  dashboardGroup: CollectionsDashboardGroup;
}

export interface WeeklyDigest {
  id: string;
  businessId: string;
  bookkeeperClientId?: string;
  weekStarting: string;
  generatedAt: string;
  totalOutstanding: number;
  totalCashToChase: number;
  invoicesToChase: number;
  promisesDue: number;
  missedPromises: number;
  disputesOpen: number;
  remittanceRequests: number;
  statementRequests: number;
  topActions: Array<{
    action: CollectionAction;
    count: number;
    amount: number;
  }>;
  safetyWarnings: SafetyCheckResult[];
}

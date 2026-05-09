import type {
  Invoice,
  SafetyCheckResult,
  SafetyStatus,
} from "@/types/zentra";
import type {
  DraftGenerationInput,
  DraftTone,
} from "@/lib/ai/zentra-drafts";

export type UnifiedSafetyStatus = "safe" | "review" | "blocked";

export type UnifiedSafetyCheck = {
  label: string;
  status: UnifiedSafetyStatus;
  message: string;
};

export type UnifiedSafetyResult = {
  status: UnifiedSafetyStatus;
  checks: UnifiedSafetyCheck[];
  warningMessage: string;
};

export function mapSafetyStatus(status: SafetyStatus): UnifiedSafetyStatus {
  if (status === "blocked") return "blocked";
  if (status === "needs_review") return "review";
  return "safe";
}

export function buildSafetyResultFromChecks(
  checks: SafetyCheckResult[],
  extraChecks: UnifiedSafetyCheck[] = [],
): UnifiedSafetyResult {
  const unifiedChecks = [
    ...checks.map((check) => ({
      label: check.title,
      status: mapSafetyStatus(check.status),
      message: check.explanation,
    })),
    ...extraChecks,
  ];

  return normaliseSafetyResult(unifiedChecks);
}

export function buildInvoiceMessageSafetyResult({
  invoice,
  tone,
  extraChecks = [],
}: {
  invoice: Invoice;
  tone?: DraftTone;
  extraChecks?: UnifiedSafetyCheck[];
}): UnifiedSafetyResult {
  const checks: UnifiedSafetyCheck[] = [
    {
      label: "Human approval",
      status: "review",
      message: "Zentra drafts and recommends. You are responsible for reviewing messages before sending.",
    },
  ];

  if (invoice.amountOutstanding <= 0 || invoice.status === "paid") {
    checks.push({
      label: "No outstanding balance",
      status: "blocked",
      message: "This invoice is paid or has no remaining balance.",
    });
  }

  if (invoice.status === "do_not_chase" || invoice.relationshipType === "do not chase") {
    checks.push({
      label: "Do not chase",
      status: "blocked",
      message: "This invoice or customer is marked as do not chase.",
    });
  }

  if (!invoice.customerEmail) {
    checks.push({
      label: "Missing customer email",
      status: "blocked",
      message: "Confirm the right AP or customer contact before preparing a customer message.",
    });
  }

  if (invoice.status === "disputed" || invoice.disputeReason || invoice.dispute?.status === "open") {
    checks.push({
      label: "Active dispute",
      status: "blocked",
      message: "Use a dispute response, not a normal payment reminder.",
    });
  }

  if (invoice.promisedPaymentDate && new Date(invoice.promisedPaymentDate) > new Date()) {
    checks.push({
      label: "Promise date not due",
      status: "review",
      message: "The customer has a future promised payment date. Chasing now may be premature.",
    });
  }

  if (invoice.paymentClaimed || invoice.remittanceNeeded || invoice.status === "awaiting_remittance") {
    checks.push({
      label: "Payment claimed",
      status: "review",
      message: "Request remittance advice or check receipts before another payment reminder.",
    });
  }

  if (invoice.customerNotes && /po\b|purchase order/i.test(invoice.customerNotes)) {
    checks.push({
      label: "PO/reference issue",
      status: "review",
      message: "Check whether a purchase order or reference is blocking payment.",
    });
  }

  if (tone === "final") {
    checks.push({
      label: "Final tone selected",
      status: "review",
      message: "Keep the wording cautious and professional. Do not imply legal advice or automatic escalation.",
    });
  }

  return normaliseSafetyResult([...checks, ...extraChecks]);
}

export function buildDraftInputSafetyResult(
  input: DraftGenerationInput,
): UnifiedSafetyResult {
  const checks: UnifiedSafetyCheck[] = [
    {
      label: "Human approval",
      status: "review",
      message: "Review the draft before copying or sending it.",
    },
  ];

  if (!input.customerEmail && input.scenario !== "ASK_FOR_AP_CONTACT") {
    checks.push({
      label: "Missing customer email",
      status: "blocked",
      message: "Confirm the correct AP contact before using this message.",
    });
  }

  if (input.amountOutstanding <= 0) {
    checks.push({
      label: "No outstanding balance",
      status: "blocked",
      message: "Do not draft a collection message for a zero outstanding balance.",
    });
  }

  if (input.disputeReason && input.scenario === "PAYMENT_REMINDER") {
    checks.push({
      label: "Dispute present",
      status: "blocked",
      message: "Generate a dispute response instead of a normal payment reminder.",
    });
  }

  if (input.promisedPaymentDate && new Date(input.promisedPaymentDate) > new Date()) {
    checks.push({
      label: "Future promise",
      status: "review",
      message: "The promised payment date has not passed yet.",
    });
  }

  if (input.selectedTone === "final") {
    checks.push({
      label: "Final tone selected",
      status: "review",
      message: "Final wording must remain professional and cautious. Zentra does not provide legal advice.",
    });
  }

  if (input.lateFeesEnabled) {
    checks.push({
      label: "Late fees",
      status: "review",
      message: "Mention late fees only after checking the contract and applicable rules.",
    });
  }

  return normaliseSafetyResult(checks);
}

function normaliseSafetyResult(checks: UnifiedSafetyCheck[]): UnifiedSafetyResult {
  const status = checks.some((check) => check.status === "blocked")
    ? "blocked"
    : checks.some((check) => check.status === "review")
      ? "review"
      : "safe";

  const warningMessage =
    status === "blocked"
      ? "Blocked until the safety issues are resolved."
      : status === "review"
        ? "Review before chasing."
        : "Safe to chase after human review.";

  return { status, checks, warningMessage };
}

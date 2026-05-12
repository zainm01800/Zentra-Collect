import { formatCurrency, formatDate } from "@/lib/formatters";
import {
  buildDraftInputSafetyResult,
  type UnifiedSafetyResult,
} from "@/lib/collections/safety";

export type DraftTone = "friendly" | "neutral" | "firm" | "final";

export type DraftScenario =
  | "PAYMENT_REMINDER"
  | "PROMISE_TO_PAY_FOLLOW_UP"
  | "REQUEST_REMITTANCE"
  | "DISPUTE_RESPONSE"
  | "STATEMENT_OF_ACCOUNT"
  | "CONFIRM_INVOICE_RECEIVED"
  | "ASK_FOR_AP_CONTACT"
  | "ASK_FOR_PAYMENT_DATE"
  | "INTERNAL_ESCALATION"
  | "THANK_YOU_AFTER_PAYMENT";

export type DraftGenerationInput = {
  scenario: DraftScenario;
  customerName: string;
  customerEmail?: string;
  invoiceNumber: string;
  amountOutstanding: number;
  dueDate?: string;
  daysOverdue: number;
  chaseCount: number;
  relationshipType: string;
  customerBehaviourSummary?: string;
  notes?: string;
  disputeReason?: string;
  promisedPaymentDate?: string;
  promisedAmount?: number;
  promisedBy?: string;
  paymentClaimDate?: string;
  paymentReference?: string;
  amountClaimedPaid?: number;
  disputeOwner?: string;
  nextResolutionDate?: string;
  statementSummary?: string;
  requestedContactRole?: string;
  internalOwner?: string;
  escalationNote?: string;
  recommendedAction: string;
  reason: string;
  selectedTone: DraftTone;
  lateFeesEnabled?: boolean;

  // Who the email is from. Templates and AI prompt use these to sign correctly.
  // If absent, the signoff falls back to a neutral "Thanks," (never "Zentra Flow").
  senderName?: string;
  senderBusinessName?: string;
};

export type DraftGenerationResponse = {
  subject: string;
  body: string;
  suggestedNextStep: string;
  riskNotes: string;
  confidence: "high" | "medium" | "low";
  requiresReview: true;
  source?: "gemini" | "openai" | "template";
};

export type DraftSafetyResult = {
  allowed: boolean;
  riskNotes: string[];
  confidence: "high" | "medium" | "low";
  result: UnifiedSafetyResult;
};

export function getDraftSafety(input: DraftGenerationInput): DraftSafetyResult {
  const result = buildDraftInputSafetyResult(input);
  const riskNotes = result.checks.map((check) => check.message);
  const confidence =
    result.status === "blocked"
      ? "low"
      : result.status === "review"
        ? "medium"
        : "high";

  return {
    allowed: result.status !== "blocked",
    riskNotes,
    confidence,
    result,
  };
}

export function generateTemplateDraft(
  input: DraftGenerationInput,
): DraftGenerationResponse {
  const safety = getDraftSafety(input);
  const amount = formatCurrency(input.amountOutstanding);
  const dueDate = input.dueDate ? formatDate(input.dueDate) : "the due date";
  const name = firstNameOrFallback(input.customerName);

  if (!safety.allowed) {
    return {
      subject: `Invoice ${input.invoiceNumber} - query to resolve`,
      body: [
        `Hi ${name},`,
        "",
        `Thanks for raising the query on invoice ${input.invoiceNumber}. We have noted this as disputed, so we will review the issue before sending any further payment reminders.`,
        "",
        "Could you share any details that would help us resolve this quickly?",
        "",
        buildSignoff(input),
      ].join("\n"),
      suggestedNextStep: "Resolve the dispute before sending a payment reminder.",
      riskNotes: safety.riskNotes.join(" "),
      confidence: safety.confidence,
      requiresReview: true,
      source: "template",
    };
  }

  const subject = subjectFor(input);
  const body = bodyFor(input, name, amount, dueDate);

  return {
    subject,
    body,
    suggestedNextStep: nextStepFor(input),
    riskNotes: safety.riskNotes.join(" "),
    confidence: safety.confidence,
    requiresReview: true,
    source: "template",
  };
}

export function buildDraftPrompt(input: DraftGenerationInput) {
  return `Write a concise, professional UK business collections email.

Return only valid JSON matching this exact shape:
{
  "subject": "...",
  "body": "...",
  "suggestedNextStep": "...",
  "riskNotes": "...",
  "confidence": "high|medium|low",
  "requiresReview": true
}

Context:
- Scenario: ${input.scenario}
- Tone: ${input.selectedTone}
- Sender (the person sending this email): ${input.senderName ?? "the user"}
- Sender business: ${input.senderBusinessName ?? "the user's business"}
- Customer name: ${input.customerName}
- Customer email: ${input.customerEmail ?? "missing"}
- Invoice number: ${input.invoiceNumber}
- Amount outstanding: ${formatCurrency(input.amountOutstanding)}
- Due date: ${input.dueDate ? formatDate(input.dueDate) : "missing"}
- Days overdue: ${input.daysOverdue}
- Previous chase count: ${input.chaseCount}
- Relationship type: ${input.relationshipType}
- Customer behaviour summary: ${input.customerBehaviourSummary ?? "none"}
- Notes: ${input.notes ?? "none"}
- Dispute reason: ${input.disputeReason ?? "none"}
- Promised payment date: ${input.promisedPaymentDate ?? "none"}
- Recommended action: ${input.recommendedAction}
- Zentra reason: ${input.reason}
- Late fees enabled: ${input.lateFeesEnabled === true}

Rules:
- Sign the email as the sender (and their business if provided). NEVER sign as "Zentra", "Zentra Flow", or any third party — this email comes from the sender's own inbox.
- Never claim to be a solicitor or debt collector.
- Never give legal, accounting, or tax advice.
- Avoid aggressive, threatening, or intimidating wording.
- If there is a dispute, do not write a normal payment reminder; write a dispute-resolution follow-up.
- For final tone, be professional and cautious.
- Always include riskNotes that remind the user to review before sending.
- Mention late fees only if late fees are explicitly enabled, and still warn the user to review contract/rules first.
- Use British English.
- Keep the body practical and human. Aim for 80-160 words in the body.`;
}

function subjectFor(input: DraftGenerationInput) {
  const prefixes: Record<DraftScenario, string> = {
    PAYMENT_REMINDER:
      input.selectedTone === "friendly" ? "Quick reminder" : "Payment reminder",
    PROMISE_TO_PAY_FOLLOW_UP: "Payment promise follow-up",
    REQUEST_REMITTANCE: "Remittance advice request",
    DISPUTE_RESPONSE: "Invoice query follow-up",
    STATEMENT_OF_ACCOUNT: "Statement of account request",
    CONFIRM_INVOICE_RECEIVED: "Invoice receipt check",
    ASK_FOR_AP_CONTACT: "Accounts payable contact request",
    ASK_FOR_PAYMENT_DATE: "Payment date request",
    INTERNAL_ESCALATION: "Internal escalation",
    THANK_YOU_AFTER_PAYMENT: "Thank you for payment",
  };

  return `${prefixes[input.scenario]}: invoice ${input.invoiceNumber}`;
}

function buildSignoff(input: DraftGenerationInput): string {
  // Sign as the user, not Zentra. If we have no sender info, sign neutrally
  // — never sign as "Zentra Flow" because the email goes from the user's inbox.
  const lines: string[] = ["Thanks,"];
  if (input.senderName?.trim()) lines.push(input.senderName.trim());
  if (input.senderBusinessName?.trim()) lines.push(input.senderBusinessName.trim());
  return lines.join("\n");
}

function bodyFor(
  input: DraftGenerationInput,
  name: string,
  amount: string,
  dueDate: string,
) {
  const greeting = `Hi ${name},`;
  const signoff = buildSignoff(input);

  if (input.scenario === "PROMISE_TO_PAY_FOLLOW_UP") {
    return `${greeting}\n\nI am following up on invoice ${input.invoiceNumber}. We had a payment date noted for ${input.promisedPaymentDate ? formatDate(input.promisedPaymentDate) : "earlier this week"}, but ${amount} is still showing as outstanding.\n\nCould you confirm whether payment has been made, or share an updated payment date?\n\n${signoff}`;
  }

  if (input.scenario === "REQUEST_REMITTANCE") {
    return `${greeting}\n\nThanks for the update on invoice ${input.invoiceNumber}. The balance of ${amount} is still showing as outstanding on our side.\n\nCould you send remittance advice or payment details so we can match this correctly?\n\n${signoff}`;
  }

  if (input.scenario === "DISPUTE_RESPONSE") {
    return `${greeting}\n\nThanks for raising the query on invoice ${input.invoiceNumber}. We have noted this and will review the issue before sending any further payment reminders.\n\nCould you share any details that would help us resolve the query quickly?\n\n${signoff}`;
  }

  if (input.scenario === "STATEMENT_OF_ACCOUNT") {
    return `${greeting}\n\nI am checking the open items on your account. Invoice ${input.invoiceNumber} is currently showing with ${amount} outstanding.\n\nWould it help if we sent over a statement of account, or could you confirm which items are approved for payment?\n\n${signoff}`;
  }

  if (input.scenario === "CONFIRM_INVOICE_RECEIVED") {
    return `${greeting}\n\nI wanted to confirm that invoice ${input.invoiceNumber} for ${amount} has reached the right team.\n\nCould you let me know whether it has been received and is scheduled for payment?\n\n${signoff}`;
  }

  if (input.scenario === "ASK_FOR_AP_CONTACT") {
    return `${greeting}\n\nWe are trying to confirm the best accounts payable contact for invoice ${input.invoiceNumber}.\n\nCould you point us to the right person or email address for payment queries?\n\n${signoff}`;
  }

  if (input.scenario === "ASK_FOR_PAYMENT_DATE") {
    return `${greeting}\n\nI am checking in on invoice ${input.invoiceNumber}, which is showing with ${amount} outstanding.\n\nCould you confirm the expected payment date so we can update our records?\n\n${signoff}`;
  }

  if (input.scenario === "INTERNAL_ESCALATION") {
    return `Internal note\n\nCustomer: ${input.customerName}\nInvoice: ${input.invoiceNumber}\nOutstanding: ${amount}\nReason: ${input.reason}\n\nSuggested owner: ${input.internalOwner ?? "Account manager"}\nEscalation note: ${input.escalationNote ?? "Review before the next customer follow-up."}`;
  }

  if (input.scenario === "THANK_YOU_AFTER_PAYMENT") {
    return `${greeting}\n\nThank you for arranging payment for invoice ${input.invoiceNumber}. We appreciate your help getting this sorted.\n\n${signoff}`;
  }

  const toneLine: Record<DraftTone, string> = {
    friendly:
      "I hope you are well. I am just checking in on the invoice below in case it has slipped through.",
    neutral:
      "I am writing to follow up on the invoice below, which is now overdue.",
    firm:
      "I am following up on the invoice below, which remains overdue and needs attention.",
    final:
      "I am contacting you about the invoice below, which is now significantly overdue. Please treat this as a request for an immediate update.",
  };
  const chaseLine =
    input.chaseCount > 0
      ? `\n\nWe have previously followed up ${input.chaseCount} time${input.chaseCount === 1 ? "" : "s"} on this invoice.`
      : "";
  const finalLine =
    input.selectedTone === "final"
      ? "\n\nPlease confirm whether payment has been made or whether there is a specific issue preventing payment. This message is not legal advice."
      : "\n\nCould you confirm when payment is expected, or let us know if there is anything you need from us?";
  const lateFeeLine = input.lateFeesEnabled
    ? "\n\nPlease review any contractual late-fee wording before adding it to this message."
    : "";

  return `${greeting}\n\n${toneLine[input.selectedTone]}\n\nInvoice: ${input.invoiceNumber}\nAmount outstanding: ${amount}\nDue date: ${dueDate}\nDays overdue: ${input.daysOverdue}${chaseLine}${finalLine}${lateFeeLine}\n\n${signoff}`;
}

function nextStepFor(input: DraftGenerationInput) {
  const steps: Record<DraftScenario, string> = {
    PAYMENT_REMINDER: "Review the draft, then copy it into your email client if appropriate.",
    PROMISE_TO_PAY_FOLLOW_UP: "Check whether payment arrived before sending a promise follow-up.",
    REQUEST_REMITTANCE: "Ask for remittance advice before sending another payment reminder.",
    DISPUTE_RESPONSE: "Resolve the query before resuming normal chasing.",
    STATEMENT_OF_ACCOUNT: "Review open items and attach or prepare a statement if needed.",
    CONFIRM_INVOICE_RECEIVED: "Confirm the right recipient before escalating tone.",
    ASK_FOR_AP_CONTACT: "Find the correct AP contact before sending invoice-specific reminders.",
    ASK_FOR_PAYMENT_DATE: "Review the wording, then ask for a clear payment date.",
    INTERNAL_ESCALATION: "Share the note internally before contacting the customer again.",
    THANK_YOU_AFTER_PAYMENT: "Copy the thank-you note only after confirming payment has cleared.",
  };

  return steps[input.scenario];
}

function firstNameOrFallback(name: string) {
  const first = name.trim().split(/\s+/)[0];
  return first && !/(ltd|limited|studio|agency|consulting|support)$/i.test(first)
    ? first
    : "there";
}

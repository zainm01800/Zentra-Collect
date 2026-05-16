/**
 * AI customer payment-behaviour diagnosis.
 *
 * Takes a summary of a customer's invoice history + risk signals and asks
 * an LLM to produce a short, actionable explanation of *why* this customer
 * pays the way they do, plus what to actually do about it.
 *
 * Output is conservative, plain-English, and never promises specific outcomes.
 */

// ── Input ─────────────────────────────────────────────────────────────────────

export interface CustomerDiagnosisInput {
  customerName:       string;
  openInvoiceCount:   number;
  totalOutstanding:   number;
  averageDaysOverdue: number;
  maxDaysOverdue:     number;
  totalChaseCount:    number;
  brokenPromises:     number;
  disputedInvoices:   number;
  /** Optional context — Companies House flag if known (active/dissolved/etc). */
  companiesHouseStatus?: string;
  /** Optional context — typical day-of-week they pay, if we know it. */
  typicalPaymentDay?:    string;
}

// ── Output ────────────────────────────────────────────────────────────────────

export interface CustomerDiagnosisResult {
  /** 2-3 sentence plain-English diagnosis. */
  diagnosis: string;
  /** A single concrete next action. */
  recommendation: string;
  /** "high" when the recommendation is clearly supported by the data. */
  confidence: "high" | "medium" | "low";
  /** "rules" | "ai" — useful for telemetry. */
  source: "rules" | "ai";
}

// ── Deterministic fallback (free, no AI call needed) ─────────────────────────

/**
 * Rules-based diagnosis when no AI is configured. Less expressive than the AI
 * version but always available — keeps the customer page useful for users
 * without OpenAI/Gemini keys.
 */
export function diagnoseWithRules(
  input: CustomerDiagnosisInput,
): CustomerDiagnosisResult {
  const {
    customerName,
    openInvoiceCount,
    averageDaysOverdue,
    maxDaysOverdue,
    totalChaseCount,
    brokenPromises,
    disputedInvoices,
    companiesHouseStatus,
  } = input;

  // No open invoices → nothing to diagnose
  if (openInvoiceCount === 0) {
    return {
      diagnosis: `${customerName} has no open invoices. They're up to date.`,
      recommendation: "No action needed. Re-check when new invoices are raised.",
      confidence: "high",
      source: "rules",
    };
  }

  // Companies House red flag — overrides everything
  if (
    companiesHouseStatus &&
    !["active", "unknown"].includes(companiesHouseStatus.toLowerCase())
  ) {
    return {
      diagnosis: `${customerName} is recorded as "${companiesHouseStatus}" on Companies House. Standard chasing may not recover the debt.`,
      recommendation: "Pause chasing and seek guidance on next steps for the open balance.",
      confidence: "high",
      source: "rules",
    };
  }

  // Broken promises — strongest behavioural signal
  if (brokenPromises >= 1) {
    return {
      diagnosis: `${customerName} has broken ${brokenPromises} payment promise${brokenPromises === 1 ? "" : "s"}. Verbal commitments aren't reliable here.`,
      recommendation:
        "Stop accepting promises. Use a firm reminder with a specific payment deadline (e.g. 7 days).",
      confidence: "high",
      source: "rules",
    };
  }

  // Disputed invoices — block on the resolution before any new chase
  if (disputedInvoices >= 1) {
    return {
      diagnosis: `${customerName} has ${disputedInvoices} disputed invoice${disputedInvoices === 1 ? "" : "s"} blocking payment.`,
      recommendation:
        "Resolve the dispute first. Send a clear summary of the disputed lines and ask for written confirmation of agreed amount.",
      confidence: "high",
      source: "rules",
    };
  }

  // Many chases, no payment
  if (totalChaseCount >= 5) {
    return {
      diagnosis: `${customerName} has been chased ${totalChaseCount} times without payment. Email-only follow-up isn't working.`,
      recommendation: "Switch channels — call the AP team directly, or send a pre-action notice.",
      confidence: "high",
      source: "rules",
    };
  }

  // Very long overdue
  if (maxDaysOverdue >= 90) {
    return {
      diagnosis: `${customerName} has an invoice ${maxDaysOverdue} days overdue. The cash is unlikely to come without escalation.`,
      recommendation:
        "Send a pre-action notice mentioning statutory interest. Set a 14-day deadline before considering further steps.",
      confidence: "medium",
      source: "rules",
    };
  }

  // Recurring but moderate lateness
  if (averageDaysOverdue >= 21 && openInvoiceCount >= 2) {
    return {
      diagnosis: `${customerName} typically pays ${averageDaysOverdue} days late. This looks like their normal AP cycle, not a payment problem.`,
      recommendation:
        "Send a neutral reminder near the due date — earlier nudging often pulls these in by 5–10 days.",
      confidence: "medium",
      source: "rules",
    };
  }

  // Healthy customer
  return {
    diagnosis: `${customerName} is paying broadly on schedule${maxDaysOverdue > 0 ? ` (max ${maxDaysOverdue} days late)` : ""}.`,
    recommendation: "Standard reminder cadence is fine. No special handling needed.",
    confidence: "medium",
    source: "rules",
  };
}

// ── AI prompt (used by the API route) ─────────────────────────────────────────

export function buildDiagnosisPrompt(input: CustomerDiagnosisInput): string {
  return `You are a UK collections analyst. Diagnose one customer's payment behaviour for the bookkeeper using only the data provided. Be specific, plain-English, and never recommend legal action or aggressive language.

Return ONLY valid JSON with these exact keys:
{
  "diagnosis": "2-3 sentences explaining their pattern in plain English",
  "recommendation": "ONE concrete next action the user should take",
  "confidence": "high" | "medium" | "low"
}

Rules:
- Refer to the customer by name.
- If broken promises exist, lead with that.
- If Companies House status is concerning, lead with that.
- Avoid words: legal action, lawsuit, court, debt collector.
- Suggest channel changes (email → call) when appropriate.
- Never invent figures not in the data.

Data:
Customer:                 ${input.customerName}
Open invoices:            ${input.openInvoiceCount}
Outstanding:              £${input.totalOutstanding.toLocaleString("en-GB")}
Average days overdue:     ${input.averageDaysOverdue}
Max days overdue:         ${input.maxDaysOverdue}
Total chases sent:        ${input.totalChaseCount}
Broken payment promises:  ${input.brokenPromises}
Disputed invoices:        ${input.disputedInvoices}
Companies House status:   ${input.companiesHouseStatus ?? "unknown"}
Typical payment weekday:  ${input.typicalPaymentDay ?? "unknown"}`;
}

/** Normalise an LLM JSON response to a CustomerDiagnosisResult. */
export function parseAiDiagnosisResponse(raw: string | null | undefined): CustomerDiagnosisResult | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<CustomerDiagnosisResult>;
    if (
      typeof parsed.diagnosis !== "string" ||
      typeof parsed.recommendation !== "string"
    ) {
      return null;
    }
    return {
      diagnosis: parsed.diagnosis.slice(0, 600),
      recommendation: parsed.recommendation.slice(0, 300),
      confidence: parsed.confidence === "high" || parsed.confidence === "low"
        ? parsed.confidence
        : "medium",
      source: "ai",
    };
  } catch {
    return null;
  }
}

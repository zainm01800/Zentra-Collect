import type { Invoice, ReminderOptions, ReminderTone } from "@/types/cashpilot";
import { formatCurrency, formatDate } from "@/lib/formatters";

type Reminder = {
  subject: string;
  body: string;
};

const closings: Record<ReminderTone, string> = {
  Friendly: "Thanks again, and please let me know if you need anything from us.",
  Neutral: "Please can you confirm when payment will be arranged?",
  Firm: "Please confirm the expected payment date today so we can update our records.",
  "Final notice":
    "Please confirm immediate payment or let us know today if there is a specific issue preventing payment.",
};

export function generateTemplateReminder(
  invoice: Invoice,
  tone: ReminderTone,
  options: ReminderOptions = {
    mentionPreviousReminder: true,
    askForPaymentDate: true,
    includePaymentLink: true,
    avoidLateFeeWording: true,
    keepRelationshipWarm: true,
  },
): Reminder {
  if (invoice.status === "Disputed") {
    return {
      subject: `Invoice ${invoice.invoiceNumber} - dispute follow-up`,
      body: `Hi ${invoice.customerName},\n\nI wanted to follow up on invoice ${invoice.invoiceNumber} for ${formatCurrency(invoice.amount)}. I can see this is currently marked as disputed, so rather than sending a payment reminder, could you please confirm what needs resolving from your side?\n\nOnce we understand the issue, we can help get this moving again.\n\nKind regards,\nCashPilot Demo Agency`,
    };
  }

  const intro: Record<ReminderTone, string> = {
    Friendly:
      "I hope you are well. Just a quick note about the invoice below, which looks like it may have slipped through.",
    Neutral:
      "I am writing to follow up on the invoice below, which is now overdue.",
    Firm:
      "I am following up again on the invoice below, which remains overdue and needs attention.",
    "Final notice":
      "I am contacting you about the invoice below, which is now significantly overdue.",
  };

  const context = `Invoice: ${invoice.invoiceNumber}\nAmount: ${formatCurrency(invoice.amount)}\nDue date: ${formatDate(invoice.dueDate)}\nDays overdue: ${invoice.daysOverdue}`;
  const previousReminder =
    options.mentionPreviousReminder && invoice.chaseCount > 0
      ? `\n\nWe have previously followed up ${invoice.chaseCount} time${invoice.chaseCount === 1 ? "" : "s"} on this invoice.`
      : "";
  const paymentDateAsk = options.askForPaymentDate
    ? "\n\nIf payment has already been arranged, please could you confirm the payment date?"
    : "";
  const paymentLink = options.includePaymentLink
    ? `\n\nPayment link: ${invoice.paymentLink}`
    : "";
  const relationshipLine = options.keepRelationshipWarm
    ? "\n\nWe appreciate your help getting this sorted."
    : "";

  return {
    subject: `${tone === "Friendly" ? "Quick reminder" : "Payment reminder"}: invoice ${invoice.invoiceNumber}`,
    body: `Hi ${invoice.customerName},\n\n${intro[tone]}\n\n${context}${previousReminder}${paymentDateAsk}${relationshipLine}\n\n${closings[tone]}${paymentLink}\n\nKind regards,\nCashPilot Demo Agency`,
  };
}

export function buildReminderPrompt(
  invoice: Invoice,
  tone: ReminderTone,
  options: ReminderOptions,
) {
  return `Write a concise, professional UK business payment reminder email.

Tone: ${tone}
Customer: ${invoice.customerName}
Invoice number: ${invoice.invoiceNumber}
Amount: ${formatCurrency(invoice.amount)}
Due date: ${formatDate(invoice.dueDate)}
Days overdue: ${invoice.daysOverdue}
Chase count: ${invoice.chaseCount}
Relationship type: ${invoice.relationshipType}
Previous status: ${invoice.status}
Notes: ${invoice.notes}
Payment link: ${invoice.paymentLink}
Reminder controls:
- Mention previous reminder: ${options.mentionPreviousReminder}
- Ask for payment date: ${options.askForPaymentDate}
- Include payment link: ${options.includePaymentLink}
- Avoid late-fee wording: ${options.avoidLateFeeWording}
- Keep relationship warm: ${options.keepRelationshipWarm}

Rules:
- Return JSON with "subject" and "body".
- Avoid aggressive legal threats.
- If disputed, do not demand payment; ask what needs resolving.
- For final notice, be professional and cautious.
- Use British English.
- Keep statutory interest or late fees out unless the user explicitly confirms they apply.`;
}

// Statutory interest and late fees depend on the user's contract and UK rules;
// users should check before applying them to any generated reminder.

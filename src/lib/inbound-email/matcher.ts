/**
 * Matches an inbound email sender to a known invoice/customer.
 * Used by both the IMAP poller and the webhook receiver.
 */

export type MatchResult =
  | { method: "email_exact";  invoiceId: string; customerName: string }
  | { method: "email_fuzzy";  invoiceId: string; customerName: string }
  | { method: "unmatched" };

interface MatchableInvoice {
  id: string;
  customerName: string;
  customerEmail?: string | null;
  invoiceNumber?: string;
}

/**
 * Try to match a sender email + subject against a list of invoices.
 *
 * Priority:
 *  1. Exact sender email match against invoice.customerEmail
 *  2. Invoice number found in subject line
 *  3. Unmatched
 */
export function matchSenderToInvoice(
  fromEmail: string,
  subject: string,
  invoices: MatchableInvoice[],
): MatchResult {
  const normalised = fromEmail.trim().toLowerCase();

  // 1 — exact email match
  const exactMatch = invoices.find(
    (inv) => inv.customerEmail?.trim().toLowerCase() === normalised,
  );
  if (exactMatch) {
    return {
      method: "email_exact",
      invoiceId: exactMatch.id,
      customerName: exactMatch.customerName,
    };
  }

  // 2 — invoice number in subject (e.g. "Re: INV-0042")
  const subjectUpper = subject.toUpperCase();
  const invNumberMatch = invoices.find(
    (inv) =>
      inv.invoiceNumber &&
      subjectUpper.includes(inv.invoiceNumber.toUpperCase()),
  );
  if (invNumberMatch) {
    return {
      method: "email_fuzzy",
      invoiceId: invNumberMatch.id,
      customerName: invNumberMatch.customerName,
    };
  }

  return { method: "unmatched" };
}

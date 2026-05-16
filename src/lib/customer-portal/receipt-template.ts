/**
 * Renders the "payment received" email that goes to the Zentra user
 * after Stripe confirms a customer-portal payment via webhook.
 *
 * Two recipients: the user (so they can mark the invoice paid in their
 * own system) and the end customer (so they have a thank-you receipt).
 * Same template, different intro line + subject — keeps it cheap.
 */

export interface ReceiptFields {
  businessName:    string;
  customerName:    string;
  invoiceNumber:   string;
  baseAmount:      number;
  chargedAmount:   number;
  interest?:       number;
  compensation?:   number;
  earlyPayPercent?: number;
  paidAt:          Date;
}

function fmtGBP(n: number): string {
  return new Intl.NumberFormat("en-GB", {
    style:    "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
  }).format(n);
}

function fmtDate(d: Date): string {
  return d.toLocaleString("en-GB", {
    day:    "numeric",
    month:  "long",
    year:   "numeric",
    hour:   "2-digit",
    minute: "2-digit",
  });
}

export function buildUserReceiptSubject(fields: ReceiptFields): string {
  return `Payment received · Invoice ${fields.invoiceNumber} · ${fmtGBP(fields.chargedAmount)}`;
}

export function buildCustomerReceiptSubject(fields: ReceiptFields): string {
  return `Receipt for invoice ${fields.invoiceNumber} from ${fields.businessName}`;
}

function adjustmentLine(fields: ReceiptFields): string {
  if (fields.interest && fields.interest > 0) {
    const comp = fields.compensation ?? 0;
    return `Includes statutory interest ${fmtGBP(fields.interest)} + compensation ${fmtGBP(comp)}.`;
  }
  if (fields.earlyPayPercent && fields.earlyPayPercent > 0) {
    const saved = fields.baseAmount - fields.chargedAmount;
    return `${fields.earlyPayPercent}% early-pay discount applied — customer saved ${fmtGBP(saved)}.`;
  }
  return "";
}

export function renderUserReceiptHtml(fields: ReceiptFields): string {
  const adjustment = adjustmentLine(fields);
  return `
<!doctype html>
<html><body style="font-family:system-ui,sans-serif;color:#111;max-width:560px;margin:0 auto;padding:24px;">
  <div style="border:1px solid #eee;border-radius:12px;padding:24px;">
    <div style="font-size:13px;color:#6b7280;text-transform:uppercase;letter-spacing:0.1em;">Payment received</div>
    <h1 style="margin:8px 0 16px;font-size:24px;">${fmtGBP(fields.chargedAmount)}</h1>
    <table style="width:100%;font-size:14px;border-collapse:collapse;">
      <tr><td style="padding:6px 0;color:#6b7280;">Invoice</td><td style="text-align:right;font-family:monospace;">${fields.invoiceNumber}</td></tr>
      <tr><td style="padding:6px 0;color:#6b7280;">Customer</td><td style="text-align:right;">${fields.customerName}</td></tr>
      <tr><td style="padding:6px 0;color:#6b7280;">Paid at</td><td style="text-align:right;">${fmtDate(fields.paidAt)}</td></tr>
    </table>
    ${adjustment ? `<p style="margin-top:16px;font-size:12.5px;color:#6b7280;">${adjustment}</p>` : ""}
    <p style="margin-top:20px;font-size:13px;color:#374151;">Reminder: mark this invoice as paid in your accounting system.</p>
  </div>
  <p style="font-size:11px;color:#9ca3af;margin-top:16px;text-align:center;">Sent by Zentra Collect on your behalf.</p>
</body></html>
`.trim();
}

export function renderUserReceiptText(fields: ReceiptFields): string {
  const adjustment = adjustmentLine(fields);
  return [
    `Payment received: ${fmtGBP(fields.chargedAmount)}`,
    ``,
    `Invoice:  ${fields.invoiceNumber}`,
    `Customer: ${fields.customerName}`,
    `Paid at:  ${fmtDate(fields.paidAt)}`,
    adjustment ? `\n${adjustment}` : ``,
    ``,
    `Reminder: mark this invoice as paid in your accounting system.`,
  ].filter(Boolean).join("\n");
}

export function renderCustomerReceiptHtml(fields: ReceiptFields): string {
  return `
<!doctype html>
<html><body style="font-family:system-ui,sans-serif;color:#111;max-width:560px;margin:0 auto;padding:24px;">
  <div style="border:1px solid #eee;border-radius:12px;padding:24px;">
    <div style="font-size:13px;color:#10b981;text-transform:uppercase;letter-spacing:0.1em;">Thank you</div>
    <h1 style="margin:8px 0 16px;font-size:24px;">${fmtGBP(fields.chargedAmount)} paid</h1>
    <p style="font-size:14px;color:#374151;">Hi ${fields.customerName},</p>
    <p style="font-size:14px;color:#374151;">We've received your payment to ${fields.businessName} for invoice ${fields.invoiceNumber}. This is your receipt.</p>
    <table style="width:100%;font-size:14px;border-collapse:collapse;margin-top:12px;">
      <tr><td style="padding:6px 0;color:#6b7280;">Invoice</td><td style="text-align:right;font-family:monospace;">${fields.invoiceNumber}</td></tr>
      <tr><td style="padding:6px 0;color:#6b7280;">Amount paid</td><td style="text-align:right;">${fmtGBP(fields.chargedAmount)}</td></tr>
      <tr><td style="padding:6px 0;color:#6b7280;">Paid at</td><td style="text-align:right;">${fmtDate(fields.paidAt)}</td></tr>
    </table>
  </div>
</body></html>
`.trim();
}

export function renderCustomerReceiptText(fields: ReceiptFields): string {
  return [
    `Thank you — we've received your payment.`,
    ``,
    `Paid to:  ${fields.businessName}`,
    `Invoice:  ${fields.invoiceNumber}`,
    `Amount:   ${fmtGBP(fields.chargedAmount)}`,
    `Paid at:  ${fmtDate(fields.paidAt)}`,
  ].join("\n");
}

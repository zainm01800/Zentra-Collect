"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Copy, Check, Plus, Trash2, Mail, ArrowRight } from "lucide-react";
import { createInvoiceLinkAction } from "@/actions/create-invoice-link";
import { createInvoice as storeCreateInvoice } from "@/lib/invoice-store";
import type { Invoice } from "@/types/zentra";

const DAY_MS = 24 * 60 * 60 * 1000;

interface LineItem {
  id:          string;
  description: string;
  amount:      string;
}

function newLine(): LineItem {
  return {
    id: `line-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    description: "",
    amount: "",
  };
}

function fmtGBP(n: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency", currency: "GBP",
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(n);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function defaultDueDate(): string {
  return new Date(Date.now() + 14 * DAY_MS).toISOString().slice(0, 10);
}

function autoInvoiceNumber(): string {
  const d = new Date();
  const ym = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
  const seq = String(Math.floor(Math.random() * 900) + 100); // 100-999
  return `INV-${ym}-${seq}`;
}

export function NewInvoiceForm() {
  const [customerName, setCustomerName]   = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState(autoInvoiceNumber);
  const [issueDate, setIssueDate]         = useState(todayIso);
  const [dueDate, setDueDate]             = useState(defaultDueDate);
  const [lines, setLines]                 = useState<LineItem[]>([newLine()]);
  const [notes, setNotes]                 = useState("");
  // VAT rate applied to the whole invoice. 0 = not VAT-registered (default).
  const [vatRate, setVatRate]             = useState(0);

  // Business / sender — pulled from localStorage settings if present
  const [businessName, setBusinessName]   = useState(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem("zentra.businessName") ?? "";
  });
  const [businessEmail, setBusinessEmail] = useState(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem("zentra.businessEmail") ?? "";
  });

  const [state, setState] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [shareUrl, setShareUrl]         = useState("");
  const [createdInvoice, setCreatedInvoice] = useState<Invoice | null>(null);
  const [copied, setCopied] = useState(false);

  // Net (pre-VAT) subtotal, the VAT amount, and the gross total owed.
  const netTotal = useMemo(
    () => lines.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0),
    [lines],
  );
  const vatTotal = useMemo(
    () => +(netTotal * (vatRate / 100)).toFixed(2),
    [netTotal, vatRate],
  );
  const total = useMemo(() => +(netTotal + vatTotal).toFixed(2), [netTotal, vatTotal]);

  function updateLine(id: string, field: keyof LineItem, value: string) {
    setLines((ls) => ls.map((l) => (l.id === id ? { ...l, [field]: value } : l)));
  }
  function removeLine(id: string) {
    setLines((ls) => (ls.length === 1 ? ls : ls.filter((l) => l.id !== id)));
  }

  async function submit(e: React.FormEvent | null, asDraft = false) {
    e?.preventDefault();
    if (!customerName.trim() || total <= 0) {
      setState("error");
      setErrorMessage("Customer name and at least one line item are required.");
      return;
    }
    setState("saving");
    setErrorMessage("");

    // Persist business name + email so they pre-fill next time
    try {
      window.localStorage.setItem("zentra.businessName", businessName);
      window.localStorage.setItem("zentra.businessEmail", businessEmail);
    } catch { /* quota */ }

    const id = `inv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const businessId = "local";

    const invoice: Invoice = {
      id,
      businessId,
      customerId:        `cust-${customerName.toLowerCase().replace(/\s+/g, "-")}`,
      customerName:      customerName.trim(),
      customerEmail:     customerEmail.trim() || undefined,
      invoiceNumber:     invoiceNumber.trim(),
      invoiceDate:       issueDate,
      dueDate,
      // amount is the GROSS total (net + VAT) — what the customer owes.
      amount:            total,
      amountOutstanding: total,
      currency:          "GBP",
      // Drafts are parked as not_due and excluded from the chase plan until issued.
      status:            asDraft
                           ? "not_due"
                           : new Date(dueDate).getTime() < Date.now() ? "overdue" : "due_soon",
      daysOverdue:       asDraft ? 0 : Math.max(0, Math.floor((Date.now() - new Date(dueDate).getTime()) / DAY_MS)),
      previousChaseCount: 0,
      relationshipType:  "regular customer",
      lineItems:         lines.map((l, idx) => {
        const amount    = parseFloat(l.amount) || 0;
        const lineVat   = +(amount * (vatRate / 100)).toFixed(2);
        return {
          id:          `${id}-line-${idx}`,
          description: l.description.trim() || `Line ${idx + 1}`,
          quantity:    1,
          unitPrice:   amount,
          amount,
          ...(vatRate > 0 ? { vatRate, vatAmount: lineVat } : {}),
        };
      }),
      activityHistory:   [],
      sourceBatchId:     `manual-${todayIso()}`,
      importedRowNumber: 1,
      customerNotes:     notes.trim() || undefined,
      ...(vatRate > 0 ? { vatRate, vatAmount: vatTotal } : {}),
      ...(asDraft ? { isDraft: true } : {}),
    };

    // Save via the unified store so P&L, Tax, Aged Debt update immediately
    try {
      storeCreateInvoice(invoice);
    } catch (err) {
      console.error("[new-invoice] store write failed:", err);
      setState("error");
      setErrorMessage("Couldn't save the invoice locally. Free up space and try again.");
      return;
    }

    // Drafts are not issued yet — no payment link, simpler confirmation.
    if (asDraft) {
      setCreatedInvoice(invoice);
      setShareUrl("");
      setState("done");
      return;
    }

    // Sign the portal token server-side
    const link = await createInvoiceLinkAction({
      invoiceId:     id,
      invoiceNumber: invoice.invoiceNumber,
      customerName:  invoice.customerName,
      amount:        invoice.amount,
      dueDate:       dueDate,
      businessName:  businessName.trim() || "Your business",
      businessEmail: businessEmail.trim(),
    });

    if (!link.ok) {
      // Invoice still saved locally — just no share link
      setCreatedInvoice(invoice);
      setShareUrl("");
      setState("done");
      setErrorMessage(link.error);
      return;
    }

    setCreatedInvoice(invoice);
    setShareUrl(link.url);
    setState("done");
  }

  function copyShare() {
    if (!shareUrl || typeof navigator === "undefined") return;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function emailShare() {
    if (!createdInvoice || !shareUrl) return;
    const subject = `Invoice ${createdInvoice.invoiceNumber} from ${businessName || "us"}`;
    const body =
      `Hi ${createdInvoice.customerName},\n\n` +
      `Please find invoice ${createdInvoice.invoiceNumber} for ${fmtGBP(createdInvoice.amount)}, due ${new Date(dueDate).toLocaleDateString("en-GB")}.\n\n` +
      `You can pay online securely here:\n${shareUrl}\n\n` +
      `Thanks,\n${businessName || "Your business"}`;
    const href = `mailto:${encodeURIComponent(createdInvoice.customerEmail ?? "")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = href;
  }

  // ── Success view ────────────────────────────────────────────────────────
  if (state === "done" && createdInvoice) {
    return (
      <div className="max-w-2xl space-y-5">
        <div
          className="rounded-2xl p-6"
          style={{ background: "var(--zn-safe-soft)", border: "1px solid var(--zn-safe)" }}
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em]"
             style={{ color: "var(--zn-safe)" }}>
            {createdInvoice.isDraft ? "Draft saved" : "Invoice created"}
          </p>
          <h2 className="mt-1 text-[20px] font-semibold" style={{ color: "var(--zn-ink)" }}>
            {createdInvoice.invoiceNumber} · {fmtGBP(createdInvoice.amount)}
          </h2>
          <p className="mt-1 text-[13px]" style={{ color: "var(--zn-ink-2)" }}>
            {createdInvoice.isDraft
              ? "Saved as a draft — it won't be chased. Finalise it from the Invoices hub when you're ready to send."
              : "Saved to your chase plan. Send the customer the link below to pay."}
          </p>
        </div>

        {createdInvoice.isDraft ? (
          <div className="flex gap-3 flex-wrap">
            <Link
              href="/invoices"
              className="inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-[13px] font-semibold"
              style={{ background: "var(--zn-ink)", color: "var(--zn-bg)" }}
            >
              Go to Invoices <ArrowRight className="size-3.5" />
            </Link>
            <button
              type="button"
              onClick={() => {
                setState("idle");
                setShareUrl("");
                setCreatedInvoice(null);
                setCustomerName("");
                setCustomerEmail("");
                setInvoiceNumber(autoInvoiceNumber());
                setIssueDate(todayIso());
                setDueDate(defaultDueDate());
                setLines([newLine()]);
                setNotes("");
                setVatRate(0);
              }}
              className="text-[13px] font-medium underline"
              style={{ color: "var(--zn-ink-2)" }}
            >
              Create another
            </button>
          </div>
        ) : shareUrl ? (
          <div
            className="rounded-2xl p-5"
            style={{ background: "var(--zn-surface)", border: "1px solid var(--zn-line-soft)" }}
          >
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] mb-2"
               style={{ color: "var(--zn-ink-3)" }}>
              Customer payment link
            </p>
            <p className="text-[12.5px] font-mono break-all mb-4 p-3 rounded-lg"
               style={{ background: "var(--zn-bg-2)", color: "var(--zn-ink-2)" }}>
              {shareUrl}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={copyShare}
                className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-medium border"
                style={{ borderColor: "var(--zn-line)", color: "var(--zn-ink-2)" }}
              >
                {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                {copied ? "Copied" : "Copy link"}
              </button>
              {createdInvoice.customerEmail && (
                <button
                  type="button"
                  onClick={emailShare}
                  className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-semibold"
                  style={{ background: "var(--zn-ink)", color: "var(--zn-bg)" }}
                >
                  <Mail className="size-3.5" />
                  Email to {createdInvoice.customerName}
                </button>
              )}
              <Link
                href={shareUrl + "/invoice"}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-medium border"
                style={{ borderColor: "var(--zn-line)", color: "var(--zn-ink-2)" }}
              >
                Preview PDF
              </Link>
            </div>
          </div>
        ) : (
          <div
            className="rounded-2xl p-5 text-[13px]"
            style={{ background: "var(--zn-warn-soft)", color: "var(--zn-warn)" }}
          >
            {errorMessage || "Couldn't generate a share link. The invoice is saved — you can chase manually."}
          </div>
        )}

        <div className="flex gap-3 flex-wrap">
          <Link
            href="/chase-today"
            className="inline-flex items-center gap-1.5 text-[13px] font-medium underline"
            style={{ color: "var(--zn-ink-2)" }}
          >
            View in chase plan <ArrowRight className="size-3.5" />
          </Link>
          <button
            type="button"
            onClick={() => {
              setState("idle");
              setShareUrl("");
              setCreatedInvoice(null);
              setCustomerName("");
              setCustomerEmail("");
              setInvoiceNumber(autoInvoiceNumber());
              setIssueDate(todayIso());
              setDueDate(defaultDueDate());
              setLines([newLine()]);
              setNotes("");
              setVatRate(0);
            }}
            className="text-[13px] font-medium underline"
            style={{ color: "var(--zn-ink-2)" }}
          >
            Create another
          </button>
        </div>
      </div>
    );
  }

  // ── Form view ───────────────────────────────────────────────────────────
  return (
    <form onSubmit={submit} className="max-w-3xl space-y-5">
      {/* Business details */}
      <Section title="Your business">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Your business name">
            <Input value={businessName} onChange={setBusinessName} placeholder="Your Business Ltd" />
          </Field>
          <Field label="Reply-to email">
            <Input value={businessEmail} onChange={setBusinessEmail} type="email" placeholder="billing@yourbusiness.co.uk" />
          </Field>
        </div>
      </Section>

      {/* Customer */}
      <Section title="Customer">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Customer name *">
            <Input value={customerName} onChange={setCustomerName} required />
          </Field>
          <Field label="Customer email">
            <Input value={customerEmail} onChange={setCustomerEmail} type="email" />
          </Field>
        </div>
      </Section>

      {/* Invoice meta */}
      <Section title="Invoice">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Invoice number">
            <Input value={invoiceNumber} onChange={setInvoiceNumber} />
          </Field>
          <Field label="Issue date">
            <Input value={issueDate} onChange={setIssueDate} type="date" />
          </Field>
          <Field label="Due date">
            <Input value={dueDate} onChange={setDueDate} type="date" />
          </Field>
        </div>
      </Section>

      {/* Line items */}
      <Section title="Line items">
        <div className="space-y-2">
          {lines.map((line, idx) => (
            <div key={line.id} className="grid grid-cols-[1fr_140px_40px] gap-2 items-start">
              <Input
                value={line.description}
                onChange={(v) => updateLine(line.id, "description", v)}
                placeholder={`Line ${idx + 1} description`}
              />
              <Input
                value={line.amount}
                onChange={(v) => updateLine(line.id, "amount", v)}
                type="number"
                step="0.01"
                placeholder="0.00"
              />
              <button
                type="button"
                onClick={() => removeLine(line.id)}
                disabled={lines.length === 1}
                className="p-2 rounded hover:bg-black/5 disabled:opacity-30"
                aria-label="Remove line"
              >
                <Trash2 className="size-3.5" style={{ color: "var(--zn-ink-3)" }} />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setLines((ls) => [...ls, newLine()])}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-medium border"
            style={{ borderColor: "var(--zn-line)", color: "var(--zn-ink-2)" }}
          >
            <Plus className="size-3.5" />
            Add line
          </button>
        </div>

        {/* VAT rate selector — off by default for non-registered traders */}
        <div className="mt-4 flex items-center justify-between gap-3 pt-3 border-t"
             style={{ borderColor: "var(--zn-line-soft)" }}>
          <label className="text-[12px] font-medium" style={{ color: "var(--zn-ink-2)" }}>
            VAT
          </label>
          <select
            value={vatRate}
            onChange={(e) => setVatRate(Number(e.target.value))}
            className="rounded-lg px-2.5 py-1.5 text-[13px] border"
            style={{ borderColor: "var(--zn-line)", background: "var(--zn-surface)", color: "var(--zn-ink)" }}
          >
            <option value={0}>No VAT (not registered)</option>
            <option value={20}>Standard 20%</option>
            <option value={5}>Reduced 5%</option>
          </select>
        </div>

        {/* Totals breakdown — shows net + VAT only when a positive rate is set */}
        <div className="mt-3">
          {vatRate > 0 && (
            <>
              <div className="flex items-baseline justify-between py-0.5">
                <span className="text-[12.5px]" style={{ color: "var(--zn-ink-3)" }}>Subtotal</span>
                <span className="text-[13px] tabular-nums" style={{ color: "var(--zn-ink-2)" }}>{fmtGBP(netTotal)}</span>
              </div>
              <div className="flex items-baseline justify-between py-0.5">
                <span className="text-[12.5px]" style={{ color: "var(--zn-ink-3)" }}>VAT ({vatRate}%)</span>
                <span className="text-[13px] tabular-nums" style={{ color: "var(--zn-ink-2)" }}>{fmtGBP(vatTotal)}</span>
              </div>
            </>
          )}
          <div className="flex items-baseline justify-between pt-2 mt-1 border-t"
               style={{ borderColor: "var(--zn-line-soft)" }}>
            <span className="text-[13px] font-semibold" style={{ color: "var(--zn-ink-2)" }}>
              {vatRate > 0 ? "Total (incl. VAT)" : "Total"}
            </span>
            <span className="text-[22px] font-semibold tabular-nums" style={{ color: "var(--zn-ink)" }}>
              {fmtGBP(total)}
            </span>
          </div>
        </div>
      </Section>

      {/* Notes */}
      <Section title="Notes (optional)">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Payment terms, PO number, project reference…"
          className="w-full rounded-lg px-3 py-2 text-[14px] border"
          style={{ borderColor: "var(--zn-line)", background: "var(--zn-surface)", color: "var(--zn-ink)" }}
        />
      </Section>

      {state === "error" && (
        <p className="text-[13px] rounded-lg px-4 py-3"
           style={{ background: "var(--zn-risk-soft)", color: "var(--zn-risk)" }}>
          {errorMessage}
        </p>
      )}

      <div className="flex items-center justify-end gap-3">
        <Link
          href="/chase-today"
          className="text-[13px] font-medium"
          style={{ color: "var(--zn-ink-3)" }}
        >
          Cancel
        </Link>
        <button
          type="button"
          onClick={() => submit(null, true)}
          disabled={state === "saving"}
          className="inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-[13.5px] font-medium border disabled:opacity-50"
          style={{ borderColor: "var(--zn-line)", color: "var(--zn-ink-2)" }}
        >
          {state === "saving" ? "Saving…" : "Save as draft"}
        </button>
        <button
          type="submit"
          disabled={state === "saving"}
          className="inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-[13.5px] font-semibold disabled:opacity-50"
          style={{ background: "var(--zn-ink)", color: "var(--zn-bg)" }}
        >
          {state === "saving" ? "Creating…" : "Create invoice"}
        </button>
      </div>
    </form>
  );
}

// ── Atoms ─────────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section
      className="rounded-xl p-5"
      style={{ background: "var(--zn-surface)", border: "1px solid var(--zn-line-soft)" }}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] mb-3"
         style={{ color: "var(--zn-ink-3)" }}>
        {title}
      </p>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] font-medium block mb-1.5" style={{ color: "var(--zn-ink-3)" }}>
        {label}
      </span>
      {children}
    </label>
  );
}

function Input({
  value, onChange, type = "text", step, placeholder, required,
}: {
  value: string;
  onChange: (v: string) => void;
  type?: string;
  step?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <input
      type={type}
      step={step}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      required={required}
      className="w-full rounded-lg px-3 py-2 text-[14px] border"
      style={{ borderColor: "var(--zn-line)", background: "var(--zn-surface)", color: "var(--zn-ink)" }}
    />
  );
}

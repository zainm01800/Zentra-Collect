"use client";

import { useEffect, useState, useTransition } from "react";
import { FileText, Plus, Trash2 } from "lucide-react";
import { SectionCsvImport } from "@/components/section-csv-import";
import type { ImportResult } from "@/components/section-csv-import";
import {
  createQuote,
  deleteQuote,
  markConverted,
  quoteGrossTotal,
  quoteNetTotal,
  quoteVatTotal,
  readQuotes,
  setQuoteStatus,
  type Quote,
  type QuoteStatus,
} from "@/lib/quotes";
import { addInvoice } from "@/actions/invoices";

function fmtGBP(n: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency", currency: "GBP",
    maximumFractionDigits: 2,
  }).format(n);
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function fmtDateInput(d: Date) {
  return d.toISOString().slice(0, 10);
}

const STATUS_COPY: Record<QuoteStatus, { label: string; bg: string; fg: string }> = {
  draft:     { label: "Draft",     bg: "var(--zn-surface-2)",  fg: "var(--zn-ink-3)" },
  sent:      { label: "Sent",      bg: "var(--zn-warn-soft)",  fg: "var(--zn-warn)"  },
  accepted:  { label: "Accepted",  bg: "var(--zn-safe-soft)",  fg: "var(--zn-safe)"  },
  declined:  { label: "Declined",  bg: "var(--zn-risk-soft)",  fg: "var(--zn-risk)"  },
  converted: { label: "Converted", bg: "var(--zn-accent-soft, rgba(201,122,57,0.10))", fg: "var(--zn-accent)" },
};

export function QuotesClient() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [mounted, setMounted] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [convertError, setConvertError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState({
    customerName:  "",
    customerEmail: "",
    issueDate:     fmtDateInput(new Date()),
    expiresOn:     fmtDateInput(new Date(Date.now() + 30 * 86_400_000)),
    amountNet:     "",
    vatRate:       "0",
    description:   "",
    notes:         "",
  });

  useEffect(() => {
    setQuotes(readQuotes());
    setMounted(true);
    function refresh() { setQuotes(readQuotes()); }
    window.addEventListener("zentra:quotes-change", refresh);
    return () => window.removeEventListener("zentra:quotes-change", refresh);
  }, []);

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const net = parseFloat(form.amountNet.replace(/[^0-9.]/g, ""));
    if (!form.customerName.trim() || !Number.isFinite(net) || net <= 0) return;
    createQuote({
      customerName:  form.customerName,
      customerEmail: form.customerEmail || undefined,
      issueDate:     form.issueDate,
      expiresOn:     form.expiresOn || undefined,
      amountNet:     net,
      vatRate:       parseInt(form.vatRate, 10) || 0,
      description:   form.description || "Quote",
      notes:         form.notes || undefined,
    });
    setForm({
      customerName:  "",
      customerEmail: "",
      issueDate:     fmtDateInput(new Date()),
      expiresOn:     fmtDateInput(new Date(Date.now() + 30 * 86_400_000)),
      amountNet:     "",
      vatRate:       "0",
      description:   "",
      notes:         "",
    });
    setShowAdd(false);
  }

  function handleCsvImport(result: ImportResult) {
    const today = new Date().toISOString().slice(0, 10);
    const thirtyOut = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);

    function parseIso(raw: string): string {
      if (!raw) return today;
      const dm = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (dm) return `${dm[3]}-${dm[2].padStart(2, "0")}-${dm[1].padStart(2, "0")}`;
      if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
      return today;
    }

    for (const row of result.rows) {
      const customerName = (row.customerName ?? "").trim();
      if (!customerName) continue;

      const rawAmt = (row.amountNet ?? row.amount ?? "").replace(/[£$€,\s]/g, "");
      const net = parseFloat(rawAmt);
      if (!Number.isFinite(net) || net <= 0) continue;

      createQuote({
        customerName,
        customerEmail: (row.customerEmail ?? "").trim() || undefined,
        issueDate:     parseIso(row.issueDate ?? row.date ?? ""),
        expiresOn:     parseIso(row.expiresOn ?? "") || thirtyOut,
        amountNet:     net,
        vatRate:       0,
        description:   (row.description ?? row.notes ?? "Imported quote").trim(),
        notes:         (row.notes ?? "").trim() || undefined,
      });
    }
    setQuotes(readQuotes());
  }

  function handleConvert(q: Quote) {
    setConvertError(null);
    startTransition(async () => {
      // Convert: create an invoice from the quote's line items + meta.
      // Today addInvoice takes a single net amount + vatRate; we collapse
      // multi-line quotes by summing the net total and using the first
      // line's VAT rate (V1 — multi-line invoicing in a later pass).
      const net = quoteNetTotal(q);
      const vatRate = q.lineItems[0]?.vatRate ?? 0;
      const description = q.lineItems
        .map((li) => li.description)
        .filter(Boolean)
        .join("; ");
      const result = await addInvoice({
        customerName:  q.customerName,
        invoiceNumber: q.quoteNumber.replace(/^QTE/, "INV"),
        invoiceDate:   fmtDateInput(new Date()),
        dueDate:       fmtDateInput(new Date(Date.now() + 30 * 86_400_000)),
        amount:        net,
        vatRate,
        notes:         description || q.notes,
      });
      if (result.success && result.invoiceId) {
        markConverted(q.id, result.invoiceId);
        setQuotes(readQuotes());
      } else {
        const msg =
          result.reason === "unauthenticated"
            ? "Sign in first."
            : result.reason === "unconfigured"
              ? "Demo mode — invoicing needs Supabase."
              : "Couldn't convert. Try again.";
        setConvertError(msg);
      }
    });
  }

  function setStatusAndRefresh(id: string, status: QuoteStatus) {
    setQuoteStatus(id, status);
    setQuotes(readQuotes());
  }

  function handleDelete(id: string) {
    deleteQuote(id);
    setQuotes(readQuotes());
  }

  if (!mounted) return null;

  return (
    <div className="flex flex-col gap-5">
      {!showAdd ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="zn-pill self-start"
            style={{ height: 36, padding: "0 16px", fontSize: 13 }}
          >
            <Plus className="size-3.5" /> New quote
          </button>
          <SectionCsvImport
            title="Quotes"
            fields={[
              { key: "customerName",  label: "Customer",    synonyms: ["customer name", "customer", "client", "name", "company", "business"],       required: true  },
              { key: "amountNet",     label: "Amount (net)", synonyms: ["amount", "net", "net amount", "price", "value", "total", "gross", "cost"], required: true  },
              { key: "issueDate",     label: "Issue date",  synonyms: ["issue date", "date", "quote date", "issued", "created"]                                    },
              { key: "expiresOn",     label: "Expires on",  synonyms: ["expires", "expiry", "expiry date", "valid until", "valid to", "due"]                       },
              { key: "customerEmail", label: "Email",       synonyms: ["email", "customer email", "contact email", "billing email", "e-mail"]                      },
              { key: "description",   label: "Description", synonyms: ["description", "details", "service", "notes", "note", "work", "job"]                        },
            ]}
            onImport={handleCsvImport}
            example="Customer name, Amount (net), Issue date, Expires on"
          />
        </div>
      ) : (
        <form
          onSubmit={handleAdd}
          className="rounded-2xl p-5 grid gap-3 sm:grid-cols-2"
          style={{ background: "var(--zn-surface)", border: "1px solid var(--zn-line-soft)" }}
        >
          <Field label="Customer name">
            <input
              type="text"
              required
              value={form.customerName}
              onChange={(e) => setForm({ ...form, customerName: e.target.value })}
              placeholder="Acme Studio Ltd"
              className="zn-input"
            />
          </Field>
          <Field label="Customer email (optional)">
            <input
              type="email"
              value={form.customerEmail}
              onChange={(e) => setForm({ ...form, customerEmail: e.target.value })}
              placeholder="ap@acme.example"
              className="zn-input"
            />
          </Field>
          <Field label="Issue date">
            <input
              type="date"
              required
              value={form.issueDate}
              onChange={(e) => setForm({ ...form, issueDate: e.target.value })}
              className="zn-input"
            />
          </Field>
          <Field label="Expires on">
            <input
              type="date"
              value={form.expiresOn}
              onChange={(e) => setForm({ ...form, expiresOn: e.target.value })}
              className="zn-input"
            />
          </Field>
          <Field label="Description">
            <input
              type="text"
              required
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Website redesign — discovery phase"
              className="zn-input"
            />
          </Field>
          <Field label="Notes (optional)">
            <input
              type="text"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Includes 1 round of revisions"
              className="zn-input"
            />
          </Field>
          <Field label="Amount (net)">
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px]" style={{ color: "var(--zn-ink-3)" }}>£</span>
              <input
                type="text"
                inputMode="decimal"
                required
                value={form.amountNet}
                onChange={(e) => setForm({ ...form, amountNet: e.target.value })}
                placeholder="1200"
                className="zn-input pl-7"
              />
            </div>
          </Field>
          <Field label="VAT">
            <select
              value={form.vatRate}
              onChange={(e) => setForm({ ...form, vatRate: e.target.value })}
              className="zn-input"
            >
              <option value="0">No VAT</option>
              <option value="5">5% (reduced)</option>
              <option value="20">20% (standard)</option>
            </select>
          </Field>
          <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="zn-pill zn-pill-ghost"
              style={{ height: 34, padding: "0 14px", fontSize: 13 }}
            >
              Cancel
            </button>
            <button type="submit" className="zn-pill" style={{ height: 34, padding: "0 14px", fontSize: 13 }}>
              Save draft
            </button>
          </div>
        </form>
      )}

      {convertError && (
        <p className="text-[12px]" style={{ color: "var(--zn-risk)" }}>{convertError}</p>
      )}

      {quotes.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center gap-3 rounded-2xl p-10 text-center"
          style={{ border: "1px solid var(--zn-line-soft)", background: "var(--zn-surface)" }}
        >
          <FileText className="size-6" style={{ color: "var(--zn-ink-3)" }} />
          <p className="text-[14px] font-semibold" style={{ color: "var(--zn-ink)" }}>
            No quotes yet.
          </p>
          <p className="text-[12.5px] max-w-sm" style={{ color: "var(--zn-ink-3)" }}>
            Draft a quote, share it, and one click converts it into an invoice once the customer says yes.
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {quotes.map((q) => {
            const status = STATUS_COPY[q.status];
            return (
              <div
                key={q.id}
                className="rounded-2xl p-5"
                style={{ background: "var(--zn-surface)", border: "1px solid var(--zn-line-soft)" }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap mb-1">
                      <p className="text-[14px] font-semibold" style={{ color: "var(--zn-ink)" }}>
                        {q.quoteNumber}
                      </p>
                      <span
                        className="text-[10.5px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full"
                        style={{ background: status.bg, color: status.fg }}
                      >
                        {status.label}
                      </span>
                    </div>
                    <p className="text-[13px]" style={{ color: "var(--zn-ink-2)" }}>
                      {q.customerName}{q.customerEmail ? ` · ${q.customerEmail}` : ""}
                    </p>
                    <p className="text-[11.5px] mt-0.5" style={{ color: "var(--zn-ink-3)" }}>
                      Issued {fmtDate(q.issueDate)}{q.expiresOn ? ` · expires ${fmtDate(q.expiresOn)}` : ""}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[16px] font-semibold tabular-nums" style={{ color: "var(--zn-ink)" }}>
                      {fmtGBP(quoteGrossTotal(q))}
                    </p>
                    <p className="text-[11px]" style={{ color: "var(--zn-ink-3)" }}>
                      Net {fmtGBP(quoteNetTotal(q))} · VAT {fmtGBP(quoteVatTotal(q))}
                    </p>
                  </div>
                </div>

                {q.lineItems.length > 0 && (
                  <p className="mt-3 text-[12.5px]" style={{ color: "var(--zn-ink-2)" }}>
                    {q.lineItems.map((li) => li.description).join(" · ")}
                  </p>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  {q.status === "draft" && (
                    <button
                      type="button"
                      onClick={() => setStatusAndRefresh(q.id, "sent")}
                      className="zn-pill" style={{ height: 30, padding: "0 12px", fontSize: 12 }}
                    >
                      Mark sent
                    </button>
                  )}
                  {(q.status === "draft" || q.status === "sent") && (
                    <>
                      <button
                        type="button"
                        onClick={() => setStatusAndRefresh(q.id, "accepted")}
                        className="zn-pill zn-pill-ghost"
                        style={{ height: 30, padding: "0 12px", fontSize: 12 }}
                      >
                        Mark accepted
                      </button>
                      <button
                        type="button"
                        onClick={() => setStatusAndRefresh(q.id, "declined")}
                        className="zn-pill zn-pill-ghost"
                        style={{ height: 30, padding: "0 12px", fontSize: 12 }}
                      >
                        Mark declined
                      </button>
                    </>
                  )}
                  {q.status === "accepted" && (
                    <button
                      type="button"
                      onClick={() => handleConvert(q)}
                      disabled={isPending}
                      className="zn-pill"
                      style={{ height: 30, padding: "0 12px", fontSize: 12 }}
                    >
                      {isPending ? "Converting…" : "Convert to invoice →"}
                    </button>
                  )}
                  {q.status === "converted" && q.convertedToInvoiceId && (
                    <a
                      href={`/invoices?tab=open`}
                      className="zn-pill zn-pill-ghost"
                      style={{ height: 30, padding: "0 12px", fontSize: 12 }}
                    >
                      View invoice
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDelete(q.id)}
                    className="ml-auto inline-flex items-center gap-1 text-[11.5px]"
                    style={{ color: "var(--zn-ink-3)" }}
                    aria-label={`Delete quote ${q.quoteNumber}`}
                  >
                    <Trash2 className="size-3" /> Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <style jsx>{`
        :global(.zn-input) {
          width: 100%;
          border-radius: 10px;
          border: 1px solid var(--zn-line);
          background: var(--zn-surface);
          color: var(--zn-ink);
          padding: 0.5rem 0.75rem;
          font-size: 13px;
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10.5px] font-semibold uppercase tracking-[0.1em]" style={{ color: "var(--zn-ink-3)" }}>
        {label}
      </span>
      {children}
    </label>
  );
}

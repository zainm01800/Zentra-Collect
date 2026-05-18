"use client";

import { useEffect, useMemo, useState } from "react";
import { FileMinus, Plus, Trash2 } from "lucide-react";
import {
  createCreditNote,
  deleteCreditNote,
  readCreditNotes,
  totalCreditedNet,
  totalCreditedVat,
  type CreditNote,
} from "@/lib/credit-notes";
import { currentUkTaxYear, ukTaxYearRange } from "@/lib/tax/uk-self-employed";

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

export function CreditNotesClient() {
  const [notes, setNotes] = useState<CreditNote[]>([]);
  const [mounted, setMounted] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    customerName:  "",
    invoiceNumber: "",
    issueDate:     fmtDateInput(new Date()),
    amountNet:     "",
    vatRate:       "0",
    reason:        "",
  });

  useEffect(() => {
    setNotes(readCreditNotes());
    setMounted(true);
    function refresh() { setNotes(readCreditNotes()); }
    window.addEventListener("zentra:credit-notes-change", refresh);
    return () => window.removeEventListener("zentra:credit-notes-change", refresh);
  }, []);

  // Tax-year stats
  const taxYearStats = useMemo(() => {
    const { startIso, endIso } = ukTaxYearRange(currentUkTaxYear());
    const range = { from: new Date(startIso), to: new Date(new Date(endIso).getTime() + 86_399_000) };
    return {
      net: totalCreditedNet(range),
      vat: totalCreditedVat(range),
    };
  }, [notes]);

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const net = parseFloat(form.amountNet.replace(/[^0-9.]/g, ""));
    if (!form.customerName.trim() || !form.reason.trim() || !Number.isFinite(net) || net <= 0) return;
    createCreditNote({
      customerName:  form.customerName,
      invoiceNumber: form.invoiceNumber || undefined,
      issueDate:     form.issueDate,
      reason:        form.reason,
      amountNet:     net,
      vatRate:       parseInt(form.vatRate, 10) || 0,
    });
    setForm({
      customerName:  "",
      invoiceNumber: "",
      issueDate:     fmtDateInput(new Date()),
      amountNet:     "",
      vatRate:       "0",
      reason:        "",
    });
    setShowAdd(false);
  }

  if (!mounted) return null;

  return (
    <div className="flex flex-col gap-5">
      {/* Tax year stats */}
      {(taxYearStats.net > 0 || taxYearStats.vat > 0) && (
        <div
          className="grid gap-3 sm:grid-cols-2 rounded-2xl p-5"
          style={{ background: "var(--zn-surface)", border: "1px solid var(--zn-line-soft)" }}
        >
          <Stat
            label={`Credited net in ${currentUkTaxYear()}`}
            value={fmtGBP(taxYearStats.net)}
            hint="Reduces your taxable income"
          />
          <Stat
            label={`Credited VAT in ${currentUkTaxYear()}`}
            value={fmtGBP(taxYearStats.vat)}
            hint="Reduces output VAT owed to HMRC"
          />
        </div>
      )}

      {!showAdd ? (
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="zn-pill self-start"
          style={{ height: 36, padding: "0 16px", fontSize: 13 }}
        >
          <Plus className="size-3.5" /> Issue credit note
        </button>
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
              className="cn-input"
            />
          </Field>
          <Field label="Original invoice number (optional)">
            <input
              type="text"
              value={form.invoiceNumber}
              onChange={(e) => setForm({ ...form, invoiceNumber: e.target.value })}
              placeholder="INV-007"
              className="cn-input"
            />
          </Field>
          <Field label="Issue date">
            <input
              type="date"
              required
              value={form.issueDate}
              onChange={(e) => setForm({ ...form, issueDate: e.target.value })}
              className="cn-input"
            />
          </Field>
          <Field label="Amount (net) to credit">
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px]" style={{ color: "var(--zn-ink-3)" }}>£</span>
              <input
                type="text"
                inputMode="decimal"
                required
                value={form.amountNet}
                onChange={(e) => setForm({ ...form, amountNet: e.target.value })}
                placeholder="100"
                className="cn-input pl-7"
              />
            </div>
          </Field>
          <Field label="VAT">
            <select
              value={form.vatRate}
              onChange={(e) => setForm({ ...form, vatRate: e.target.value })}
              className="cn-input"
            >
              <option value="0">No VAT</option>
              <option value="5">5% (reduced)</option>
              <option value="20">20% (standard)</option>
            </select>
          </Field>
          <Field label="Reason">
            <input
              type="text"
              required
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              placeholder="Cancelled order, partial refund, over-billed…"
              className="cn-input"
            />
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
              Issue credit note
            </button>
          </div>
        </form>
      )}

      {notes.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center gap-3 rounded-2xl p-10 text-center"
          style={{ border: "1px solid var(--zn-line-soft)", background: "var(--zn-surface)" }}
        >
          <FileMinus className="size-6" style={{ color: "var(--zn-ink-3)" }} />
          <p className="text-[14px] font-semibold" style={{ color: "var(--zn-ink)" }}>
            No credit notes yet.
          </p>
          <p className="text-[12.5px] max-w-sm" style={{ color: "var(--zn-ink-3)" }}>
            Issue one when you refund a customer, cancel an invoice, or
            correct an over-invoice. Your tax estimate and VAT figures
            update automatically.
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {notes.map((cn) => (
            <div
              key={cn.id}
              className="rounded-2xl p-5 flex flex-wrap items-start justify-between gap-3"
              style={{ background: "var(--zn-surface)", border: "1px solid var(--zn-line-soft)" }}
            >
              <div className="min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap mb-1">
                  <p className="text-[14px] font-semibold" style={{ color: "var(--zn-ink)" }}>
                    {cn.creditNoteNumber}
                  </p>
                  {cn.invoiceNumber && (
                    <span className="text-[11.5px]" style={{ color: "var(--zn-ink-3)" }}>
                      against {cn.invoiceNumber}
                    </span>
                  )}
                </div>
                <p className="text-[13px]" style={{ color: "var(--zn-ink-2)" }}>
                  {cn.customerName}
                </p>
                <p className="text-[11.5px] mt-0.5" style={{ color: "var(--zn-ink-3)" }}>
                  {fmtDate(cn.issueDate)} · {cn.reason}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[16px] font-semibold tabular-nums" style={{ color: "var(--zn-risk)" }}>
                  −{fmtGBP(cn.amountGross)}
                </p>
                <p className="text-[11px]" style={{ color: "var(--zn-ink-3)" }}>
                  Net {fmtGBP(cn.amountNet)} · VAT {fmtGBP(cn.vatAmount)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => deleteCreditNote(cn.id)}
                className="ml-auto inline-flex items-center gap-1 text-[11.5px]"
                style={{ color: "var(--zn-ink-3)" }}
                aria-label={`Delete credit note ${cn.creditNoteNumber}`}
              >
                <Trash2 className="size-3" /> Delete
              </button>
            </div>
          ))}
        </div>
      )}

      <style jsx>{`
        :global(.cn-input) {
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

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em]" style={{ color: "var(--zn-ink-3)" }}>
        {label}
      </p>
      <p className="mt-1 text-[22px] font-semibold tabular-nums leading-tight" style={{ color: "var(--zn-risk)" }}>
        −{value}
      </p>
      {hint && (
        <p className="mt-0.5 text-[11.5px]" style={{ color: "var(--zn-ink-3)" }}>{hint}</p>
      )}
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

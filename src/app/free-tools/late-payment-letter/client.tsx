"use client";

import { useMemo, useState } from "react";
import { Copy, Check } from "lucide-react";
import { calculateStatutoryInterest } from "@/lib/statutory-interest";

const DAY_MS = 24 * 60 * 60 * 1000;

function fmtGBP(n: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency", currency: "GBP",
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(n);
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export function LatePaymentLetterClient() {
  const [yourName, setYourName] = useState("Your name");
  const [yourBusiness, setYourBusiness] = useState("Your Business Ltd");
  const [customerName, setCustomerName] = useState("Customer name");
  const [customerBusiness, setCustomerBusiness] = useState("Customer Business Ltd");
  const [invoiceNumber, setInvoiceNumber] = useState("INV-001");
  const [amount, setAmount] = useState("3500");
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date(Date.now() - 35 * DAY_MS);
    return d.toISOString().slice(0, 10);
  });
  const [copied, setCopied] = useState(false);

  const calc = useMemo(() => {
    const amountNum = parseFloat(amount) || 0;
    if (amountNum <= 0) return null;
    const due = new Date(dueDate);
    if (Number.isNaN(due.getTime())) return null;
    const daysOverdue = Math.max(0, Math.floor((Date.now() - due.getTime()) / DAY_MS));
    return { ...calculateStatutoryInterest(amountNum, daysOverdue), daysOverdue, amountNum };
  }, [amount, dueDate]);

  const letter = useMemo(() => {
    if (!calc || calc.daysOverdue === 0) return "";
    const today = new Date().toLocaleDateString("en-GB", {
      day: "numeric", month: "long", year: "numeric",
    });
    return [
      today,
      "",
      customerName,
      customerBusiness,
      "",
      `Dear ${customerName},`,
      "",
      `Re: Overdue invoice ${invoiceNumber} — ${fmtGBP(calc.amountNum)}`,
      "",
      `Our records show that invoice ${invoiceNumber}, dated ${fmtDate(dueDate)}, in the sum of ${fmtGBP(calc.amountNum)}, remains unpaid. As of today it is ${calc.daysOverdue} days overdue.`,
      "",
      `Under the Late Payment of Commercial Debts (Interest) Act 1998, we are entitled to claim ${fmtGBP(calc.interest)} in statutory interest (calculated at ${calc.annualRate}% per annum — Bank of England base rate plus 8%) together with ${fmtGBP(calc.compensation)} in fixed compensation. The total now payable is ${fmtGBP(calc.totalRecoverable)}.`,
      "",
      `Please arrange settlement of the full sum within 7 days of the date of this letter. If we do not receive payment by then we reserve the right to take further action to recover the debt, including formal proceedings, without further notice.`,
      "",
      `If you believe payment has already been made, or if you wish to discuss this matter, please contact us at the earliest opportunity.`,
      "",
      `Yours faithfully,`,
      "",
      yourName,
      yourBusiness,
    ].join("\n");
  }, [calc, customerName, customerBusiness, invoiceNumber, dueDate, yourName, yourBusiness]);

  function copyLetter() {
    if (!letter || typeof navigator === "undefined") return;
    navigator.clipboard.writeText(letter);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl p-5 grid gap-4 sm:grid-cols-2"
           style={{ background: "var(--zn-surface)", border: "1px solid var(--zn-line-soft)" }}>
        <Field label="Your name">
          <Input value={yourName} onChange={setYourName} />
        </Field>
        <Field label="Your business">
          <Input value={yourBusiness} onChange={setYourBusiness} />
        </Field>
        <Field label="Customer name">
          <Input value={customerName} onChange={setCustomerName} />
        </Field>
        <Field label="Customer business">
          <Input value={customerBusiness} onChange={setCustomerBusiness} />
        </Field>
        <Field label="Invoice number">
          <Input value={invoiceNumber} onChange={setInvoiceNumber} />
        </Field>
        <Field label="Invoice amount (£)">
          <Input value={amount} onChange={setAmount} type="number" step="0.01" />
        </Field>
        <Field label="Due date">
          <Input value={dueDate} onChange={setDueDate} type="date" />
        </Field>
      </div>

      {calc && calc.daysOverdue === 0 && (
        <p className="text-[13px] rounded-lg px-4 py-3"
           style={{ background: "var(--zn-warn-soft)", color: "var(--zn-warn)" }}>
          This invoice isn&rsquo;t overdue yet — a late-payment letter only applies after the due date.
        </p>
      )}

      {calc && calc.daysOverdue > 0 && letter && (
        <div className="rounded-xl p-5"
             style={{ background: "var(--zn-surface-2)", border: "1px solid var(--zn-line-soft)" }}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em]"
               style={{ color: "var(--zn-ink-3)" }}>
              Letter preview
            </p>
            <button
              type="button"
              onClick={copyLetter}
              className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12.5px] font-medium border"
              style={{ borderColor: "var(--zn-line)", color: "var(--zn-ink-2)" }}
            >
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <pre className="text-[13px] leading-6 font-mono whitespace-pre-wrap"
               style={{ color: "var(--zn-ink-2)", fontFamily: "var(--font-geist-mono), monospace" }}>
            {letter}
          </pre>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5"
            style={{ color: "var(--zn-ink-3)" }}>
        {label}
      </span>
      {children}
    </label>
  );
}

function Input({
  value, onChange, type = "text", step,
}: {
  value: string;
  onChange: (v: string) => void;
  type?: string;
  step?: string;
}) {
  return (
    <input
      type={type}
      step={step}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg px-3 py-2 text-[14px] border bg-white"
      style={{ borderColor: "var(--zn-line)" }}
    />
  );
}

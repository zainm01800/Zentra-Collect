"use client";

import { useMemo, useState } from "react";
import { Copy, Check } from "lucide-react";
import {
  calculateStatutoryInterest,
  isInterestMaterial,
} from "@/lib/statutory-interest";

const DAY_MS = 24 * 60 * 60 * 1000;

type Tone = "friendly" | "neutral" | "firm" | "final";

const TONE_OPTIONS: { value: Tone; label: string; subject: string }[] = [
  { value: "friendly", label: "Friendly",     subject: "Quick reminder" },
  { value: "neutral",  label: "Neutral",      subject: "Payment reminder" },
  { value: "firm",     label: "Firm",         subject: "Action needed" },
  { value: "final",    label: "Final notice", subject: "Final notice" },
];

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

export function ChaseEmailClient() {
  const [customerName, setCustomerName] = useState("Customer name");
  const [yourName, setYourName] = useState("Your name");
  const [yourBusiness, setYourBusiness] = useState("Your Business Ltd");
  const [invoiceNumber, setInvoiceNumber] = useState("INV-001");
  const [amount, setAmount] = useState("1450");
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date(Date.now() - 18 * DAY_MS);
    return d.toISOString().slice(0, 10);
  });
  const [tone, setTone] = useState<Tone>("neutral");
  const [includeInterest, setIncludeInterest] = useState(false);
  const [copied, setCopied] = useState(false);

  const calc = useMemo(() => {
    const amountNum = parseFloat(amount) || 0;
    if (amountNum <= 0) return null;
    const due = new Date(dueDate);
    if (Number.isNaN(due.getTime())) return null;
    const daysOverdue = Math.max(0, Math.floor((Date.now() - due.getTime()) / DAY_MS));
    return { ...calculateStatutoryInterest(amountNum, daysOverdue), daysOverdue, amountNum };
  }, [amount, dueDate]);

  const interestEligible = calc ? isInterestMaterial(calc.amountNum, calc.daysOverdue) : false;

  const draft = useMemo(() => {
    if (!calc) return "";
    const opener: Record<Tone, string> = {
      friendly: `Hi ${customerName},\n\nHope you're well. Just a quick note — invoice ${invoiceNumber} for ${fmtGBP(calc.amountNum)} was due on ${fmtDate(dueDate)}.`,
      neutral:  `Hi ${customerName},\n\nThis is a reminder that invoice ${invoiceNumber} for ${fmtGBP(calc.amountNum)} is now ${calc.daysOverdue} days overdue.`,
      firm:     `Hi ${customerName},\n\nInvoice ${invoiceNumber} for ${fmtGBP(calc.amountNum)} is now ${calc.daysOverdue} days overdue and remains unpaid despite previous reminders.`,
      final:    `Hi ${customerName},\n\nInvoice ${invoiceNumber} for ${fmtGBP(calc.amountNum)} is now significantly overdue (${calc.daysOverdue} days). This is our final reminder before further action.`,
    };
    const ask: Record<Tone, string> = {
      friendly: `Could you let me know when payment is expected, or whether there's anything you need from us to process it?`,
      neutral:  `Please could you confirm when payment will be made, or let me know if there's anything blocking it?`,
      firm:     `Please confirm the expected payment date today so we can update our records.`,
      final:    `Please confirm immediate payment, or let us know today if there is a specific issue we need to resolve.`,
    };
    const close: Record<Tone, string> = {
      friendly: `Thanks,\n${yourName}\n${yourBusiness}`,
      neutral:  `Thanks,\n${yourName}\n${yourBusiness}`,
      firm:     `Regards,\n${yourName}\n${yourBusiness}`,
      final:    `Regards,\n${yourName}\n${yourBusiness}`,
    };

    const interestBlock = includeInterest && interestEligible && calc.daysOverdue > 0
      ? `\n\nUnder the Late Payment of Commercial Debts (Interest) Act 1998, ${fmtGBP(calc.interest)} in statutory interest has now accrued, plus ${fmtGBP(calc.compensation)} in fixed compensation. We are entitled to claim the full ${fmtGBP(calc.totalRecoverable)} but for now please settle the original invoice amount of ${fmtGBP(calc.amountNum)}.`
      : "";

    return `${opener[tone]}${interestBlock}\n\n${ask[tone]}\n\n${close[tone]}`;
  }, [calc, tone, customerName, invoiceNumber, dueDate, yourName, yourBusiness, includeInterest, interestEligible]);

  const subject = `${TONE_OPTIONS.find((t) => t.value === tone)!.subject}: invoice ${invoiceNumber}`;

  function copyDraft() {
    if (!draft || typeof navigator === "undefined") return;
    navigator.clipboard.writeText(`Subject: ${subject}\n\n${draft}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl p-5 grid gap-4 sm:grid-cols-2"
           style={{ background: "var(--zn-surface)", border: "1px solid var(--zn-line-soft)" }}>
        <Field label="Customer name"><Input value={customerName} onChange={setCustomerName} /></Field>
        <Field label="Invoice number"><Input value={invoiceNumber} onChange={setInvoiceNumber} /></Field>
        <Field label="Invoice amount (£)"><Input type="number" step="0.01" value={amount} onChange={setAmount} /></Field>
        <Field label="Due date"><Input type="date" value={dueDate} onChange={setDueDate} /></Field>
        <Field label="Your name"><Input value={yourName} onChange={setYourName} /></Field>
        <Field label="Your business"><Input value={yourBusiness} onChange={setYourBusiness} /></Field>
        <Field label="Tone">
          <select
            value={tone}
            onChange={(e) => setTone(e.target.value as Tone)}
            className="w-full rounded-lg px-3 py-2 text-[14px] border bg-white"
            style={{ borderColor: "var(--zn-line)" }}
          >
            {TONE_OPTIONS.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Include statutory interest?">
          <label className="flex items-center gap-2 text-[13px] py-2"
                 style={{ color: "var(--zn-ink-2)" }}>
            <input
              type="checkbox"
              checked={includeInterest}
              disabled={!interestEligible}
              onChange={(e) => setIncludeInterest(e.target.checked)}
            />
            {interestEligible
              ? `Yes — ${fmtGBP((calc?.interest ?? 0) + (calc?.compensation ?? 0))} accrued`
              : "Not material yet (needs ≥£5 accrued)"}
          </label>
        </Field>
      </div>

      {draft && (
        <div className="rounded-xl p-5"
             style={{ background: "var(--zn-surface-2)", border: "1px solid var(--zn-line-soft)" }}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em]"
               style={{ color: "var(--zn-ink-3)" }}>
              Draft email
            </p>
            <button
              type="button"
              onClick={copyDraft}
              className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12.5px] font-medium border"
              style={{ borderColor: "var(--zn-line)", color: "var(--zn-ink-2)" }}
            >
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <p className="text-[12.5px] font-mono mb-3" style={{ color: "var(--zn-ink-3)" }}>
            <strong style={{ color: "var(--zn-ink-2)" }}>Subject:</strong> {subject}
          </p>
          <pre className="text-[13px] leading-6 whitespace-pre-wrap"
               style={{ color: "var(--zn-ink-2)", fontFamily: "var(--font-geist-mono), monospace" }}>
            {draft}
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

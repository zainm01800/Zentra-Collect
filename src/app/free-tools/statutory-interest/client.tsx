"use client";

import { useMemo, useState } from "react";
import { Copy, Check } from "lucide-react";
import {
  calculateStatutoryInterest,
  STATUTORY_INTEREST_RATE,
} from "@/lib/statutory-interest";

const DAY_MS = 24 * 60 * 60 * 1000;

function fmtGBP(n: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency", currency: "GBP",
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(n);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function StatutoryInterestCalculatorClient() {
  const [amount, setAmount] = useState("3500");
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date(Date.now() - 30 * DAY_MS);
    return d.toISOString().slice(0, 10);
  });
  const [copied, setCopied] = useState(false);

  const result = useMemo(() => {
    const amountNum = parseFloat(amount) || 0;
    if (amountNum <= 0) return null;
    const due = new Date(dueDate);
    if (Number.isNaN(due.getTime())) return null;
    const daysOverdue = Math.max(0, Math.floor((Date.now() - due.getTime()) / DAY_MS));
    return {
      ...calculateStatutoryInterest(amountNum, daysOverdue),
      daysOverdue,
      amountNum,
    };
  }, [amount, dueDate]);

  const wording = result
    ? `Under the Late Payment of Commercial Debts (Interest) Act 1998, we are entitled to claim ${fmtGBP(result.interest)} in statutory interest (${result.daysOverdue} days at ${result.annualRate}% per annum) plus ${fmtGBP(result.compensation)} in fixed compensation, bringing the total payable to ${fmtGBP(result.totalRecoverable)}.`
    : "";

  function copyWording() {
    if (!wording || typeof navigator === "undefined") return;
    navigator.clipboard.writeText(wording);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl p-5 space-y-4"
           style={{ background: "var(--zn-surface)", border: "1px solid var(--zn-line-soft)" }}>
        <Field label="Invoice amount (£)">
          <input
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded-lg px-3 py-2.5 text-[15px] border tabular-nums"
            style={{ borderColor: "var(--zn-line)" }}
          />
        </Field>
        <Field label="Due date">
          <input
            type="date"
            value={dueDate}
            max={todayIso()}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full rounded-lg px-3 py-2.5 text-[15px] border"
            style={{ borderColor: "var(--zn-line)" }}
          />
        </Field>
      </div>

      {result && result.daysOverdue > 0 && (
        <div className="rounded-xl p-5 space-y-3"
             style={{ background: "var(--zn-surface)", border: "1px solid var(--zn-line-soft)" }}>
          <Row label="Invoice amount" value={fmtGBP(result.amountNum)} />
          <Row
            label={`Statutory interest (${result.daysOverdue}d × ${STATUTORY_INTEREST_RATE}%)`}
            value={fmtGBP(result.interest)}
          />
          <Row label="Fixed compensation" value={fmtGBP(result.compensation)} />
          <div className="border-t pt-3 flex items-baseline justify-between"
               style={{ borderColor: "var(--zn-line-soft)" }}>
            <span className="text-[14.5px] font-semibold" style={{ color: "var(--zn-ink)" }}>
              Total recoverable
            </span>
            <span className="text-[22px] font-semibold tabular-nums" style={{ color: "var(--zn-ink)" }}>
              {fmtGBP(result.totalRecoverable)}
            </span>
          </div>
        </div>
      )}

      {result && result.daysOverdue === 0 && (
        <p className="text-[13px] rounded-lg px-4 py-3"
           style={{ background: "var(--zn-warn-soft)", color: "var(--zn-warn)" }}>
          This invoice isn&rsquo;t overdue yet — statutory interest only starts accruing the day after the due date.
        </p>
      )}

      {result && result.daysOverdue > 0 && (
        <div className="rounded-xl p-5"
             style={{ background: "var(--zn-surface-2)", border: "1px solid var(--zn-line-soft)" }}>
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] mb-2"
             style={{ color: "var(--zn-ink-3)" }}>
            Copy-paste wording for your chase
          </p>
          <p className="text-[13px] leading-6 font-mono whitespace-pre-wrap"
             style={{ color: "var(--zn-ink-2)" }}>
            {wording}
          </p>
          <button
            type="button"
            onClick={copyWording}
            className="mt-4 inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12.5px] font-medium border"
            style={{ borderColor: "var(--zn-line)", color: "var(--zn-ink-2)" }}
          >
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            {copied ? "Copied" : "Copy wording"}
          </button>
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between text-[13.5px]">
      <span style={{ color: "var(--zn-ink-3)" }}>{label}</span>
      <span className="tabular-nums" style={{ color: "var(--zn-ink)" }}>{value}</span>
    </div>
  );
}

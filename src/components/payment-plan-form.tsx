"use client";

/**
 * PaymentPlanForm
 *
 * Customer-facing instalment proposal form. Used on:
 *   - /demo/portal (demo mode — no backend, useState only)
 *   - /pay/[token] (live portal — POSTs to /api/portal/payment-plan-proposal)
 *
 * The form shows an expand/collapse panel triggered by the parent button.
 * Props control whether it submits to the backend or demo-only.
 */

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";

interface PaymentPlanFormProps {
  totalAmount: number;
  businessName: string;
  invoiceNumber: string;
  /** Token from the signed URL — null for demo mode */
  token?: string;
  /** Called when the panel should close (e.g. after submit) */
  onClose?: () => void;
}

const INSTALMENT_OPTIONS = [2, 3, 4, 6] as const;

function fmtGBP(n: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export function PaymentPlanForm({
  totalAmount,
  businessName,
  invoiceNumber,
  token,
  onClose,
}: PaymentPlanFormProps) {
  const [instalments, setInstalments] = useState<2 | 3 | 4 | 6>(3);
  const [firstDate, setFirstDate]     = useState("");
  const [submitted, setSubmitted]     = useState(false);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);

  const instalmentAmount = Math.ceil((totalAmount / instalments) * 100) / 100;
  const todayIso = new Date().toISOString().slice(0, 10);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!firstDate) { setError("Please pick a first payment date."); return; }
    setError(null);
    setLoading(true);

    if (!token) {
      // Demo mode — no backend call
      await new Promise((r) => setTimeout(r, 600));
      setSubmitted(true);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/portal/payment-plan-proposal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, instalments, firstDate, instalmentAmount, totalAmount }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? "Something went wrong. Please try again.");
      } else {
        setSubmitted(true);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-800 px-5 py-5 text-center">
        <CheckCircle2 className="size-6 text-emerald-600 mx-auto mb-2" />
        <p className="text-[14px] font-semibold text-emerald-800 dark:text-emerald-300">
          Proposal sent to {businessName}
        </p>
        <p className="text-[12.5px] text-emerald-700 dark:text-emerald-400 mt-1.5 leading-5">
          {instalments} payments of {fmtGBP(instalmentAmount)} starting{" "}
          {firstDate ? new Date(firstDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : ""}.
          They&apos;ll be in touch within 2 business days.
        </p>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="mt-3 text-[12px] text-emerald-600 underline underline-offset-2"
          >
            Close
          </button>
        )}
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-5 space-y-4"
    >
      <div>
        <p className="text-[13px] font-semibold mb-1">Request a payment plan</p>
        <p className="text-[12px] text-neutral-500 dark:text-neutral-400">
          Propose an instalment schedule for invoice {invoiceNumber} ({fmtGBP(totalAmount)}).
          {businessName} will review and confirm.
        </p>
      </div>

      {/* Instalment count */}
      <div>
        <label className="text-[11.5px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-[0.06em] block mb-2">
          Number of instalments
        </label>
        <div className="flex gap-2">
          {INSTALMENT_OPTIONS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setInstalments(n)}
              className={[
                "flex-1 rounded-lg py-2 text-[13px] font-semibold border transition-colors",
                instalments === n
                  ? "bg-neutral-900 text-white border-neutral-900 dark:bg-neutral-100 dark:text-neutral-900"
                  : "border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700",
              ].join(" ")}
            >
              {n}×
            </button>
          ))}
        </div>
      </div>

      {/* Auto-calculated amount */}
      <div className="rounded-lg bg-neutral-50 dark:bg-neutral-700/50 px-4 py-3 flex items-center justify-between">
        <span className="text-[12.5px] text-neutral-500 dark:text-neutral-400">Each payment</span>
        <span className="text-[16px] font-semibold tabular-nums">{fmtGBP(instalmentAmount)}</span>
      </div>

      {/* First payment date */}
      <div>
        <label className="text-[11.5px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-[0.06em] block mb-2">
          First payment date
        </label>
        <input
          type="date"
          min={todayIso}
          value={firstDate}
          onChange={(e) => setFirstDate(e.target.value)}
          required
          className="w-full rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-[13px] px-3 py-2.5 outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-neutral-100 text-neutral-900 dark:text-neutral-100"
        />
      </div>

      {error && (
        <p className="text-[12px] text-red-600 dark:text-red-400">{error}</p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-full bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 py-3 text-[14px] font-semibold hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors disabled:opacity-50"
      >
        {loading ? "Submitting…" : "Submit proposal"}
      </button>
    </form>
  );
}

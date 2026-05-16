"use client";

/**
 * Customer AI diagnosis card — sits on the customer detail page next to
 * the risk profile. Generates an AI-written 2-3 sentence explanation of
 * the customer's payment behaviour plus a concrete next action.
 *
 * Falls back to deterministic rules when no AI key is configured.
 */

import { useState } from "react";
import { Loader2, Sparkles, Lightbulb, RefreshCw } from "lucide-react";
import type { CustomerDiagnosisInput, CustomerDiagnosisResult } from "@/lib/ai/customer-diagnosis";

interface CustomerAiDiagnosisProps {
  input: CustomerDiagnosisInput;
}

export function CustomerAiDiagnosis({ input }: CustomerAiDiagnosisProps) {
  const [diagnosis, setDiagnosis] = useState<CustomerDiagnosisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/zentra/customer-diagnosis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Request failed (${response.status})`);
      }
      const data = (await response.json()) as CustomerDiagnosisResult;
      setDiagnosis(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Diagnosis failed.");
    } finally {
      setLoading(false);
    }
  }

  // Don't render at all for customers with zero open invoices (nothing to diagnose)
  if (input.openInvoiceCount === 0 && !diagnosis) return null;

  return (
    <div className="zn-card p-5 lg:p-6">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="size-3.5" style={{ color: "var(--zn-ink-3)" }} />
        <span
          className="text-[10.5px] font-semibold uppercase tracking-[0.12em]"
          style={{ color: "var(--zn-ink-3)" }}
        >
          AI diagnosis
        </span>
      </div>

      {!diagnosis && (
        <div className="flex flex-col gap-3">
          <p className="text-[13px] leading-5" style={{ color: "var(--zn-ink-2)" }}>
            Generate a 2-sentence diagnosis of this customer&apos;s payment behaviour, plus a concrete next action.
          </p>
          <button
            type="button"
            onClick={generate}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-semibold w-fit disabled:opacity-60"
            style={{ background: "var(--zn-ink)", color: "var(--zn-bg)" }}
          >
            {loading ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
            {loading ? "Diagnosing…" : "Generate diagnosis"}
          </button>
        </div>
      )}

      {error && (
        <p className="text-[12px] mt-2" style={{ color: "var(--zn-risk)" }}>
          {error}
        </p>
      )}

      {diagnosis && (
        <>
          <div className="space-y-3">
            <p className="text-[14px] leading-6" style={{ color: "var(--zn-ink)" }}>
              {diagnosis.diagnosis}
            </p>
            <div
              className="flex items-start gap-2 rounded-lg px-3 py-2.5"
              style={{ background: "var(--zn-bg-2)", border: "1px solid var(--zn-line-soft)" }}
            >
              <Lightbulb className="size-3.5 shrink-0 mt-0.5" style={{ color: "var(--zn-accent)" }} />
              <p className="text-[12.5px] leading-5" style={{ color: "var(--zn-ink-2)" }}>
                {diagnosis.recommendation}
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between mt-3">
            <span className="text-[10.5px]" style={{ color: "var(--zn-ink-3)" }}>
              {diagnosis.source === "ai" ? "AI-generated" : "Rules-based"} · {diagnosis.confidence} confidence
            </span>
            <button
              type="button"
              onClick={generate}
              disabled={loading}
              className="inline-flex items-center gap-1 text-[11.5px] font-medium hover:underline"
              style={{ color: "var(--zn-ink-3)" }}
            >
              <RefreshCw className="size-3" />
              Regenerate
            </button>
          </div>
        </>
      )}
    </div>
  );
}

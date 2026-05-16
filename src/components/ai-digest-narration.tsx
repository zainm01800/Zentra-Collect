"use client";

/**
 * AI Weekly Digest Narration card.
 *
 * Sits at the top of /digest and offers an AI-narrated version of the
 * deterministic brief. One click → friendly Sunday-evening summary with
 * a top-3 focus list, ready to email to yourself.
 *
 * Falls back to a deterministic template when no AI keys are configured.
 */

import { useState } from "react";
import { Sparkles, Loader2, RefreshCw, Mail, CheckCircle2 } from "lucide-react";
import type { WeeklyDigestBrief } from "@/lib/collections/weekly-digest";
import type { NarratedDigest } from "@/lib/ai/weekly-digest-narration";

interface AiDigestNarrationProps {
  brief: WeeklyDigestBrief;
  recipientName?: string;
}

export function AiDigestNarration({ brief, recipientName }: AiDigestNarrationProps) {
  const [narrated, setNarrated] = useState<NarratedDigest | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  const [sending, setSending] = useState(false);

  async function generate() {
    setLoading(true);
    setError(null);
    setEmailSent(false);
    try {
      const response = await fetch("/api/digest/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief, recipientName }),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Request failed (${response.status})`);
      }
      const data = (await response.json()) as NarratedDigest;
      setNarrated(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed.");
    } finally {
      setLoading(false);
    }
  }

  async function emailToMe() {
    if (!narrated) return;
    setSending(true);
    setError(null);
    try {
      const response = await fetch("/api/digest/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ narrated, brief, recipientName }),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Send failed (${response.status})`);
      }
      setEmailSent(true);
      setTimeout(() => setEmailSent(false), 6000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send email.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      className="zn-card p-5 lg:p-6"
      style={{ background: "var(--zn-surface)", border: "1px solid var(--zn-line-soft)" }}
    >
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="size-3.5" style={{ color: "var(--zn-ink-3)" }} />
        <span
          className="text-[10.5px] font-semibold uppercase tracking-[0.12em]"
          style={{ color: "var(--zn-ink-3)" }}
        >
          AI Sunday brief
        </span>
      </div>

      {!narrated && (
        <div className="flex flex-col gap-3">
          <h3 className="text-[16px] font-semibold" style={{ color: "var(--zn-ink)" }}>
            Generate a Sunday-evening summary
          </h3>
          <p className="text-[13px] leading-5" style={{ color: "var(--zn-ink-2)" }}>
            A friendly weekly brief written in plain English — covers what
            happened, what to focus on, and your top 3 customers to chase first.
            Set it up once, get it every Sunday by email. No competitor offers this.
          </p>
          <button
            type="button"
            onClick={generate}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-semibold w-fit disabled:opacity-60"
            style={{ background: "var(--zn-ink)", color: "var(--zn-bg)" }}
          >
            {loading ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
            {loading ? "Writing your brief…" : "Generate this week's brief"}
          </button>
        </div>
      )}

      {error && (
        <p className="text-[12px] mt-2" style={{ color: "var(--zn-risk)" }}>
          {error}
        </p>
      )}

      {narrated && (
        <>
          <div className="space-y-4">
            <h3 className="text-[18px] font-semibold leading-tight" style={{ color: "var(--zn-ink)" }}>
              {narrated.greeting}
            </h3>

            <div>
              <div
                className="text-[10.5px] font-semibold uppercase tracking-[0.08em] mb-1.5"
                style={{ color: "var(--zn-ink-3)" }}
              >
                Last week
              </div>
              <p className="text-[14px] leading-6" style={{ color: "var(--zn-ink)" }}>
                {narrated.recap}
              </p>
            </div>

            <div>
              <div
                className="text-[10.5px] font-semibold uppercase tracking-[0.08em] mb-1.5"
                style={{ color: "var(--zn-ink-3)" }}
              >
                This week&apos;s focus
              </div>
              <p className="text-[14px] leading-6" style={{ color: "var(--zn-ink)" }}>
                {narrated.focus}
              </p>
            </div>

            {narrated.topActions.length > 0 && (
              <div>
                <div
                  className="text-[10.5px] font-semibold uppercase tracking-[0.08em] mb-2"
                  style={{ color: "var(--zn-ink-3)" }}
                >
                  Top 3 to chase first
                </div>
                <ol className="space-y-2 list-decimal list-inside">
                  {narrated.topActions.map((a, idx) => (
                    <li key={idx} className="text-[13.5px]" style={{ color: "var(--zn-ink)" }}>
                      <strong>{a.customer}</strong>
                      {a.amount && (
                        <span style={{ color: "var(--zn-ink-3)" }}> · {a.amount}</span>
                      )}
                      <div className="ml-5 text-[12.5px] mt-0.5" style={{ color: "var(--zn-ink-2)" }}>
                        {a.reason}
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            <p className="text-[13px] italic" style={{ color: "var(--zn-ink-2)" }}>
              {narrated.signoff}
            </p>
          </div>

          <div className="flex items-center justify-between mt-5 pt-4" style={{ borderTop: "1px solid var(--zn-line-soft)" }}>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={emailToMe}
                disabled={sending || emailSent}
                className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-semibold disabled:opacity-60"
                style={{ background: "var(--zn-ink)", color: "var(--zn-bg)" }}
              >
                {emailSent ? (
                  <>
                    <CheckCircle2 className="size-3.5" /> Sent
                  </>
                ) : sending ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" /> Sending…
                  </>
                ) : (
                  <>
                    <Mail className="size-3.5" /> Email this to me
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={generate}
                disabled={loading}
                className="inline-flex items-center gap-1 text-[12.5px] font-medium"
                style={{ color: "var(--zn-ink-3)" }}
              >
                <RefreshCw className="size-3" />
                Regenerate
              </button>
            </div>
            <span className="text-[10.5px]" style={{ color: "var(--zn-ink-3)" }}>
              {narrated.source === "ai" ? "AI-narrated" : "Template-narrated"}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

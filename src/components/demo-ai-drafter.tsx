"use client";

/**
 * Demo AI message drafter — visually mimics the real AI draft flow
 * (loading spinner, typed-out output) but never calls any LLM API.
 * Outputs are hand-written demo samples keyed by tone, so visitors
 * can see exactly what the real product would produce without us
 * burning API credits on anonymous demo visitors.
 *
 * The "Demo AI · no API call" banner is non-removable so there's no
 * ambiguity about whether this is the real thing.
 */

import { useEffect, useState } from "react";
import { Bot, Copy, Loader2, Sparkles, X } from "lucide-react";

type Tone = "polite" | "firm" | "final";

interface Props {
  open:           boolean;
  onClose:        () => void;
  customerName:   string;
  invoiceNumber:  string;
  amount:         string;          // formatted GBP, e.g. "£3,420.00"
  daysOverdue:    number;
}

// Hand-written demo drafts. Mirrors the tone hierarchy used by the
// real AI drafter so the UX is identical.
const DEMO_DRAFTS: Record<Tone, (ctx: Props) => string> = {
  polite: ({ customerName, invoiceNumber, amount, daysOverdue }) =>
`Hi ${customerName.split(" ")[0]},

Just a friendly nudge — invoice ${invoiceNumber} for ${amount} is now ${daysOverdue} days past due. It's likely it just slipped through.

If there's a hold-up on your side or anything I can help with to get it cleared, please let me know. Otherwise a quick BACS transfer when you get a moment would be much appreciated.

Thanks for sorting it out.

Best,
[Your name]`,

  firm: ({ customerName, invoiceNumber, amount, daysOverdue }) =>
`Hi ${customerName.split(" ")[0]},

Following up on invoice ${invoiceNumber} for ${amount}, which is now ${daysOverdue} days overdue. I haven't had a response to my earlier reminder.

Could you confirm a payment date by the end of this week? If there's a query holding payment up, I'd rather know now so we can get it resolved.

Thanks,
[Your name]`,

  final: ({ customerName, invoiceNumber, amount, daysOverdue }) =>
`Hi ${customerName.split(" ")[0]},

I haven't yet received payment for invoice ${invoiceNumber} (${amount}), which is now ${daysOverdue} days overdue and well past my standard terms.

I'd like to settle this before it escalates further. Please could you arrange payment by the end of next week, or come back to me with a firm date if there's a specific issue.

Thanks,
[Your name]`,
};

export function DemoAiDrafter(props: Props) {
  const { open, onClose, customerName, invoiceNumber } = props;
  const [tone, setTone] = useState<Tone>("polite");
  const [phase, setPhase] = useState<"idle" | "thinking" | "ready">("idle");
  const [text, setText] = useState("");
  const [copied, setCopied] = useState(false);

  // Simulate the latency a real LLM call would have — purely cosmetic.
  useEffect(() => {
    if (!open) return;
    setPhase("thinking");
    setText("");
    const t = setTimeout(() => {
      setText(DEMO_DRAFTS[tone](props));
      setPhase("ready");
    }, 900);
    return () => clearTimeout(t);
  // We deliberately re-run when tone changes so the "regenerate" feel works.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tone]);

  function copy() {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)" }}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative w-full max-w-[640px] rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: "var(--zn-bg)" }}
      >
        <button type="button" onClick={onClose} aria-label="Close"
          className="absolute top-4 right-4 size-8 rounded-full inline-flex items-center justify-center hover:bg-black/5 z-10"
          style={{ color: "var(--zn-ink-3)" }}>
          <X className="size-4" />
        </button>

        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b" style={{ borderColor: "var(--zn-line-soft)" }}>
          <div className="flex items-center gap-2 mb-1.5">
            <Sparkles className="size-4" style={{ color: "var(--zn-accent)" }} />
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em]"
               style={{ color: "var(--zn-ink-3)" }}>
              AI message drafter
            </p>
          </div>
          <h2 className="text-[18px] font-semibold leading-tight"
              style={{ color: "var(--zn-ink)" }}>
            Draft a reminder for {customerName}
          </h2>
          <p className="text-[12px] mt-1" style={{ color: "var(--zn-ink-3)" }}>
            Invoice {invoiceNumber}
          </p>
        </div>

        {/* Demo banner — non-removable, makes the demo nature explicit */}
        <div className="px-6 py-2 flex items-center gap-2 text-[11.5px] font-medium"
             style={{ background: "var(--zn-warn-soft)", color: "var(--zn-warn)" }}>
          <Bot className="size-3.5" />
          Demo AI · no API call · sample output hand-written for the demo
        </div>

        {/* Tone selector */}
        <div className="px-6 pt-4 pb-3 flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider"
                style={{ color: "var(--zn-ink-3)" }}>Tone</span>
          {(["polite", "firm", "final"] as Tone[]).map((t) => (
            <button key={t} type="button" onClick={() => setTone(t)}
              className="rounded-full px-3 py-1 text-[11.5px] font-semibold capitalize transition-colors"
              style={{
                background: tone === t ? "var(--zn-ink)" : "transparent",
                color:      tone === t ? "var(--zn-bg)"  : "var(--zn-ink-2)",
                border:     `1px solid ${tone === t ? "var(--zn-ink)" : "var(--zn-line)"}`,
              }}>
              {t}
            </button>
          ))}
        </div>

        {/* Output */}
        <div className="px-6 pb-4">
          <div className="rounded-xl p-4 min-h-[200px] whitespace-pre-wrap text-[13px] leading-[1.55] tabular-nums-off"
               aria-live="polite"
               aria-busy={phase === "thinking"}
               style={{ background: "var(--zn-surface)", color: "var(--zn-ink-2)", border: "1px solid var(--zn-line-soft)" }}>
            {phase === "thinking" ? (
              <p className="flex items-center gap-2" style={{ color: "var(--zn-ink-3)" }}>
                <Loader2 className="size-3.5 animate-spin" />
                Drafting…
              </p>
            ) : text}
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="text-[11px]" style={{ color: "var(--zn-ink-3)" }}>
            In the real product, you can edit before sending and the message is queued for human approval.
          </p>
          <button type="button" onClick={copy}
            disabled={phase !== "ready"}
            className="zn-pill zn-pill-ghost text-[12px]"
            style={{ height: 34, padding: "0 14px" }}>
            <Copy className="size-3.5" />
            {copied ? "Copied" : "Copy draft"}
          </button>
        </div>
      </div>
    </div>
  );
}

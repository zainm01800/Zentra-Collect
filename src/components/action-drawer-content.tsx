"use client";

import {
  AlertTriangle,
  Copy,
  ExternalLink,
  Loader2,
  MailPlus,
  ShieldCheck,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LockedFeatureCard,
} from "@/components/billing-gates";
import { formatCurrency, formatDate } from "@/lib/formatters";
import type {
  ActionScenario,
  CollectionsPlanItem,
  Customer,
  CustomerBehaviourProfile,
  Invoice,
  ScenarioDetails,
} from "@/types/zentra";
import type { DraftGenerationResponse, DraftTone } from "@/lib/ai/zentra-drafts";
import type { ReplyClassificationResult } from "@/lib/ai/reply-classifier";
import type {
  UnifiedSafetyCheck,
  UnifiedSafetyResult,
} from "@/lib/collections/safety";
import { cn } from "@/lib/utils";
import { recommendTone } from "@/lib/collections/tone-learning";
import { listTemplates, renderTemplate, type EmailTemplate } from "@/lib/email/template-library";
import { useEffect, useState } from "react";

export function ActionDrawerContent({
  item,
  invoice,
  customer,
  behaviourProfile,
  canViewCustomerBehaviour,
  subject,
  draft,
  actionScenario,
  scenarioDetails,
  allInvoices,
  tone,
  riskNotes,
  nextStep,
  draftConfidence,
  draftSource,
  replyText,
  replyClassification,
  isClassifyingReply,
  replyPromiseDate,
  replyPromiseAmount,
  replyDisputeReason,
  isGenerating,
  copied,
  onActionScenarioChange,
  onScenarioDetailsChange,
  onToneChange,
  onSubjectChange,
  onDraftChange,
  onReplyTextChange,
  onClassifyReply,
  onApplyReplyClassification,
  onReplyPromiseDateChange,
  onReplyPromiseAmountChange,
  onReplyDisputeReasonChange,
  onGenerate,
  onCopy,
  onMarkSent,
  onMarkPromised,
  onMarkDisputed,
  onMarkPaid,
  onSnooze,
  onDoNotChase,
  onClose,
  actionMeta,
  actionScenarioOptions,
}: {
  item: CollectionsPlanItem;
  invoice: Invoice;
  customer: Customer | null;
  behaviourProfile: CustomerBehaviourProfile | null;
  canViewCustomerBehaviour: boolean;
  subject: string;
  draft: string;
  actionScenario: ActionScenario;
  scenarioDetails: ScenarioDetails;
  allInvoices: Invoice[];
  tone: DraftTone;
  riskNotes: string;
  nextStep: string;
  draftConfidence: DraftGenerationResponse["confidence"];
  draftSource: DraftGenerationResponse["source"];
  replyText: string;
  replyClassification: ReplyClassificationResult | null;
  isClassifyingReply: boolean;
  replyPromiseDate: string;
  replyPromiseAmount: string;
  replyDisputeReason: string;
  isGenerating: boolean;
  copied: boolean;
  onActionScenarioChange: (scenario: ActionScenario) => void;
  onScenarioDetailsChange: (patch: Partial<ScenarioDetails>) => void;
  onToneChange: (tone: DraftTone) => void;
  onSubjectChange: (subject: string) => void;
  onDraftChange: (draft: string) => void;
  onReplyTextChange: (reply: string) => void;
  onClassifyReply: () => void;
  onApplyReplyClassification: () => void;
  onReplyPromiseDateChange: (value: string) => void;
  onReplyPromiseAmountChange: (value: string) => void;
  onReplyDisputeReasonChange: (value: string) => void;
  onGenerate: () => void;
  onCopy: () => void;
  onMarkSent: () => void;
  onMarkPromised: () => void;
  onMarkDisputed: () => void;
  onMarkPaid: () => void;
  onSnooze: () => void;
  onDoNotChase: () => void;
  onClose?: () => void;
  actionMeta: {
    recommendedAction: string;
    explanation: string;
    confidence: string;
    safetyStatus: string;
    safetyResult: UnifiedSafetyResult;
  } | null;
  actionScenarioOptions: Array<{ value: ActionScenario; label: string }>;
}) {
  return (
    <div className="flex flex-col h-full bg-[#fbf8f1] dark:bg-[#211d17]">
      <div className="flex items-center justify-between p-5 border-b border-black/10 dark:border-white/10 sticky top-0 z-10 bg-[#fbf8f1] dark:bg-[#211d17]/90 backdrop-blur">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-neutral-950 dark:text-[#f0e8d5]">
            {invoice.customerName}
          </h2>
          <p className="text-sm text-neutral-500 dark:text-[#8a7d69]">
            Invoice {invoice.invoiceNumber} · {formatCurrency(invoice.amountOutstanding)} outstanding
          </p>
        </div>
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
            <X className="size-5" />
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto space-y-5 p-5">
        {/* Preview-as-customer — opens the sample portal so the user
            sees exactly what the recipient of this chase will see */}
        <a
          href="/demo/portal"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between gap-3 rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-[#28231c] px-4 py-2.5 text-[12.5px] font-medium hover:bg-white/90 dark:hover:bg-[#322c24]"
        >
          <span className="flex items-center gap-2 text-neutral-700 dark:text-[#d8ccb5]">
            <ExternalLink className="size-3.5" />
            See what your customer sees
          </span>
          <span className="text-[11px] text-neutral-400">Opens preview</span>
        </a>

        <section className="grid grid-cols-1 gap-3 rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-[#28231c] p-4 sm:grid-cols-2">
          <InfoLine label="Due date" value={formatDate(invoice.dueDate ?? null)} />
          <InfoLine
            label="Days overdue"
            value={invoice.daysOverdue ? `${invoice.daysOverdue}` : "0"}
          />
          <InfoLine
            label="Contact email"
            value={customer?.apEmail ?? invoice.customerEmail ?? "Missing"}
          />
          <InfoLine label="Relationship" value={invoice.relationshipType} />
        </section>

        {canViewCustomerBehaviour ? (
          <CustomerBehaviourCard profile={behaviourProfile} />
        ) : (
          <LockedFeatureCard
            title="Customer behaviour summaries are locked."
            description="Upgrade to use previous imports for payment behaviour notes, suggested tone, and customer memory."
            feature="customerBehaviourNotes"
          />
        )}

        <section className="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-[#28231c] p-4">
          <p className="text-xs font-bold uppercase tracking-widest text-neutral-400">
            Recommendation
          </p>
          {item.stopChasingInsight ? (
            <>
              <h3 className="mt-3 text-lg font-bold text-emerald-700 dark:text-emerald-400">
                Don&rsquo;t chase this week
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-neutral-600 dark:text-[#8a7d69]">
                {item.stopChasingInsight.message}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
                  Stop chasing · {item.stopChasingInsight.confidence}% confidence
                </span>
              </div>
            </>
          ) : (
            <>
              <h3 className="mt-3 text-lg font-bold text-neutral-950 dark:text-[#f0e8d5]">
                {actionMeta?.recommendedAction ?? humanAction(item.recommendedAction)}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-neutral-600 dark:text-[#8a7d69]">
                {actionMeta?.explanation ?? item.reason}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <StatusBadge value={item.urgencyLevel} />
                <StatusBadge
                  value={actionMeta?.confidence ?? item.confidenceLevel}
                  prefix="confidence"
                />
                <SafetyBadge value={actionMeta?.safetyStatus ?? item.safetyStatus} />
              </div>
            </>
          )}
        </section>

        <section className="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-[#28231c] p-4">
          <div className="space-y-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-neutral-400">
                What do you need to do?
              </p>
              <p className="mt-1 text-sm text-neutral-500 dark:text-[#8a7d69]">
                Choose the job first. Zentra adjusts everything else.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Action Scenario</label>
                <Select
                  value={actionScenario}
                  onValueChange={(value) => onActionScenarioChange(value as ActionScenario)}
                >
                  <SelectTrigger className="w-full rounded-xl bg-white dark:bg-[#211d17] border-black/10 dark:border-white/10 shadow-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {actionScenarioOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Message Tone</label>
                <Select
                  value={tone}
                  onValueChange={(value) => onToneChange(value as DraftTone)}
                >
                  <SelectTrigger className="w-full rounded-xl bg-white dark:bg-[#211d17] border-black/10 dark:border-white/10 shadow-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="friendly">Friendly</SelectItem>
                    <SelectItem value="neutral">Neutral</SelectItem>
                    <SelectItem value="firm">Firm</SelectItem>
                    <SelectItem value="final">Final</SelectItem>
                  </SelectContent>
                </Select>
                <ToneLearningHint customerId={item.customerId} />
              </div>
            </div>
          </div>
        </section>

        <ScenarioFields
          scenario={actionScenario}
          details={scenarioDetails}
          invoice={invoice}
          allInvoices={allInvoices}
          onChange={onScenarioDetailsChange}
        />

        <section className="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-[#28231c] p-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-neutral-400">
                Draft message
              </p>
            </div>
            <div className="flex items-center gap-2">
              <TemplatePickerInline
                invoice={invoice}
                onApply={(t) => {
                  const r = renderTemplate(t, {
                    customerName:  invoice.customerName,
                    invoiceNumber: invoice.invoiceNumber,
                    amount:        formatCurrency(invoice.amount),
                    dueDate:       invoice.dueDate ? formatDate(invoice.dueDate) : "",
                    daysOverdue:   invoice.daysOverdue,
                    businessName:  "your business",
                  });
                  onSubjectChange(r.subject);
                  onDraftChange(r.body);
                }}
              />
              <Badge
                variant="outline"
                className="rounded-full border-black/10 dark:border-white/10 bg-neutral-100 dark:bg-[#28231c] font-semibold"
              >
                {draftSource ?? "template"} · {draftConfidence}
              </Badge>
            </div>
          </div>
          <div className="mt-4 space-y-2" id="draft-section">
            <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">
              Subject
            </label>
            <Input
              value={subject}
              onChange={(event) => onSubjectChange(event.target.value)}
              className="rounded-xl border-black/10 dark:border-white/10 bg-white dark:bg-[#211d17]"
            />
          </div>
          <Textarea
            className="mt-4 min-h-64 resize-none rounded-xl border-black/10 dark:border-white/10 bg-white dark:bg-[#211d17] leading-relaxed"
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
          />
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-relaxed text-amber-900">
            <p className="font-bold">Human review required</p>
            <p className="mt-1">{riskNotes}</p>
            <p className="mt-2 font-medium">{nextStep}</p>
          </div>
        </section>

        <section className="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-[#28231c] p-4">
          <p className="text-xs font-bold uppercase tracking-widest text-neutral-400">
            Safety checks
          </p>
          <div className="mt-4 space-y-3">
            {actionMeta?.safetyResult.checks.length ? (
              actionMeta.safetyResult.checks.map((check: UnifiedSafetyCheck) => (
                <div
                  key={`${check.label}-${check.message}`}
                  className="rounded-xl border border-black/10 dark:border-white/10 bg-neutral-50 dark:bg-[#211d17] p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-bold text-neutral-900">
                      {check.label}
                    </p>
                    <SafetyBadge value={check.status} />
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-neutral-500 dark:text-[#8a7d69]">
                    {check.message}
                  </p>
                </div>
              ))
            ) : (
              <div className="flex items-center gap-2 rounded-xl border border-black/10 dark:border-white/10 bg-emerald-50/50 p-3 text-sm text-emerald-700">
                <ShieldCheck className="size-4" />
                No blocking safety issues found.
              </div>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-[#28231c] p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-neutral-400">
                Classify customer reply
              </p>
              <p className="mt-1 text-sm text-neutral-500 dark:text-[#8a7d69]">
                Paste a reply to automate next steps.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-full border-black/10 dark:border-white/10 bg-white dark:bg-[#211d17] h-8"
                onClick={onClassifyReply}
                disabled={!replyText.trim() || isClassifyingReply}
              >
                {isClassifyingReply ? "Classifying..." : "Classify"}
              </Button>
            </div>
          </div>
          <Textarea
            className="mt-4 min-h-28 resize-none rounded-xl border-black/10 dark:border-white/10 bg-white dark:bg-[#211d17] leading-relaxed"
            value={replyText}
            onChange={(event) => onReplyTextChange(event.target.value)}
            placeholder="Paste the customer reply here..."
          />
          {replyClassification ? (
            <div className="mt-4 rounded-xl border border-black/10 dark:border-white/10 bg-neutral-50 dark:bg-[#211d17] p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-bold text-neutral-900">
                    {humanLabel(replyClassification.classification)}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-neutral-600 dark:text-[#8a7d69]">
                    {replyClassification.reason}
                  </p>
                </div>
                <Badge variant="outline" className="w-fit rounded-full border-black/10 dark:border-white/10 bg-white dark:bg-[#211d17]">
                  {replyClassification.source} · {replyClassification.confidence}
                </Badge>
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <InfoLine
                  label="Suggested status"
                  value={replyClassification.suggestedStatusUpdate}
                />
                <InfoLine
                  label="Next action"
                  value={replyClassification.suggestedNextAction}
                />
              </div>
              <Button
                type="button"
                className="mt-4 rounded-full bg-neutral-950 text-white hover:bg-neutral-800"
                onClick={onApplyReplyClassification}
              >
                Apply update
              </Button>
            </div>
          ) : null}
        </section>

        <section className="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-[#28231c] p-4 pb-6">
          <p className="text-xs font-bold uppercase tracking-widest text-neutral-400">
            Activity history
          </p>
          <div className="mt-4 space-y-4">
            {invoice.activityHistory.map((event) => (
              <div key={event.id} className="flex gap-4">
                <span className="mt-1.5 size-2 shrink-0 rounded-full bg-neutral-950" />
                <div>
                  <p className="text-sm font-bold text-neutral-950 dark:text-[#f0e8d5]">
                    {event.title}
                  </p>
                  <p className="text-xs leading-relaxed text-neutral-500 dark:text-[#8a7d69]">
                    {event.description}
                  </p>
                  <p className="mt-1 text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                    {formatDate(event.createdAt)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="sticky bottom-0 grid gap-2 border-t border-black/10 dark:border-white/10 bg-[#fbf8f1] dark:bg-[#211d17]/95 p-5 backdrop-blur z-10">
        <div className="grid grid-cols-2 gap-2">
          <Button
            className="rounded-full bg-neutral-950 text-white hover:bg-neutral-800 h-11"
            onClick={onGenerate}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <MailPlus className="size-4" />
            )}
            Generate draft
          </Button>
          <Button
            variant="outline"
            className="rounded-full border-black/10 dark:border-white/10 bg-white dark:bg-[#211d17] h-11 font-semibold"
            onClick={onCopy}
          >
            <Copy className="size-4" />
            {copied ? "Copied" : "Copy message"}
          </Button>
        </div>
        <div className="w-full">
          <StatusChangeSelect
            onMarkSent={onMarkSent}
            onMarkPromised={onMarkPromised}
            onMarkDisputed={onMarkDisputed}
            onMarkPaid={onMarkPaid}
            onSnooze={onSnooze}
            onDoNotChase={onDoNotChase}
          />
        </div>
      </div>
    </div>
  );
}

// ── Status change + confirmation toast ───────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  sent:         "Marked as sent",
  promised:     "Marked as promised",
  disputed:     "Marked as disputed",
  paid:         "Marked as paid",
  snooze:       "Snoozed",
  do_not_chase: "Excluded from chasing",
};

function StatusChangeSelect({
  onMarkSent, onMarkPromised, onMarkDisputed, onMarkPaid, onSnooze, onDoNotChase,
}: {
  onMarkSent:     () => void;
  onMarkPromised: () => void;
  onMarkDisputed: () => void;
  onMarkPaid:     () => void;
  onSnooze:       () => void;
  onDoNotChase:   () => void;
}) {
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  function fire(val: string) {
    if (val === "sent")          onMarkSent();
    else if (val === "promised") onMarkPromised();
    else if (val === "disputed") onMarkDisputed();
    else if (val === "paid")     onMarkPaid();
    else if (val === "snooze")   onSnooze();
    else if (val === "do_not_chase") onDoNotChase();
    setToast(STATUS_LABELS[val] ?? "Status updated");
  }

  return (
    <>
      <Select value="" onValueChange={fire}>
        <SelectTrigger className="w-full rounded-full border-black/30 bg-white dark:bg-[#211d17] font-bold h-11 text-neutral-950 dark:text-[#f0e8d5]">
          <SelectValue placeholder="Change status →" />
        </SelectTrigger>
        <SelectContent className="rounded-2xl border-black/10 dark:border-white/10">
          <SelectItem value="sent">Mark as sent</SelectItem>
          <SelectItem value="promised">Mark promised</SelectItem>
          <SelectItem value="disputed">Mark disputed</SelectItem>
          <SelectItem value="paid">Mark paid</SelectItem>
          <SelectItem value="snooze">Snooze</SelectItem>
          <SelectItem value="do_not_chase">Do not chase</SelectItem>
        </SelectContent>
      </Select>
      {toast && (
        <div
          role="status"
          className="fixed bottom-6 right-6 z-[100] rounded-xl px-4 py-3 shadow-lg flex items-center gap-3 text-[13px]"
          style={{ background: "var(--zn-ink)", color: "var(--zn-bg)" }}
        >
          <span>{toast}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="text-[11px] font-semibold opacity-80 hover:opacity-100"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}
    </>
  );
}

// Helpers for ActionDrawerContent (Internal to this file or exported if needed)

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-white/60 dark:bg-[#28231c] px-3 py-2.5">
      <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">
        {label}
      </p>
      <p className="mt-1 text-sm font-bold leading-tight text-neutral-950 dark:text-[#f0e8d5] break-words" title={value}>
        {value}
      </p>
    </div>
  );
}

function StatusBadge({
  value,
  prefix,
}: {
  value: string;
  prefix?: string;
}) {
  const label = `${prefix ? `${prefix}: ` : ""}${humanLabel(value)}`;
  const tone =
    value === "critical" || value === "high"
      ? "border-red-200 bg-red-50 text-red-700"
      : value === "medium"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-black/10 dark:border-white/10 bg-neutral-100 dark:bg-[#28231c] text-neutral-700 dark:text-[#d8ccb5]";

  return (
    <Badge variant="outline" className={cn("rounded-full font-bold h-6", tone)}>
      {label}
    </Badge>
  );
}

function SafetyBadge({ value }: { value: string }) {
  const tone =
    value === "blocked"
      ? "border-red-200 bg-red-50 text-red-700"
      : value === "needs_review" || value === "review"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-emerald-200 bg-emerald-50 text-emerald-700";

  return (
    <Badge variant="outline" className={cn("rounded-full font-bold h-6", tone)}>
      {humanLabel(value)}
    </Badge>
  );
}

function TemplatePickerInline({
  invoice,
  onApply,
}: {
  invoice: Invoice;
  onApply: (t: EmailTemplate) => void;
}) {
  const [open, setOpen] = useState(false);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  useEffect(() => { setTemplates(listTemplates()); }, []);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-full border border-black/10 dark:border-white/10 bg-white dark:bg-[#211d17] px-3 py-1 text-[11.5px] font-medium hover:bg-neutral-50 dark:hover:bg-[#28231c]"
      >
        Use template ▾
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-64 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#211d17] shadow-lg z-10 max-h-72 overflow-y-auto">
          {templates.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => { onApply(t); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-[12.5px] hover:bg-neutral-50 dark:hover:bg-[#28231c] border-b border-black/5 last:border-b-0"
            >
              <div className="font-medium">{t.name}</div>
              <div className="text-[10.5px] text-neutral-500">{t.tone}{t.builtIn ? " · starter" : ""}</div>
            </button>
          ))}
          <a
            href="/settings/templates"
            className="block px-3 py-2 text-[11px] underline text-neutral-500 hover:text-neutral-700"
          >
            Manage templates →
          </a>
        </div>
      )}
      {/* Reference invoice — kept here so eslint doesn't strip the prop */}
      <span className="sr-only">{invoice.id}</span>
    </div>
  );
}

function ToneLearningHint({ customerId }: { customerId: string }) {
  const [state, setState] = useState<
    | { kind: "confident"; text: string }
    | { kind: "learning" }
    | null
  >(null);
  useEffect(() => {
    const rec = recommendTone(customerId);
    if (rec && rec.confident) {
      setState({ kind: "confident", text: rec.rationale });
    } else {
      setState({ kind: "learning" });
    }
  }, [customerId]);
  if (!state) return null;
  if (state.kind === "confident") {
    return (
      <p className="mt-1 text-[11px] leading-4 text-emerald-700 dark:text-emerald-400">
        💡 {state.text}
      </p>
    );
  }
  return (
    <p className="mt-1 text-[11px] leading-4 text-neutral-500">
      Zentra tracks which tone works for each customer. Mark paid / promised / sent below to teach it.
    </p>
  );
}

function humanLabel(value: string) {
  return value
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function humanAction(action: string) {
  const labels: Record<string, string> = {
    send_payment_reminder: "Send payment reminder",
    follow_up_promise_to_pay: "Follow up promise to pay",
    request_remittance_advice: "Request remittance advice",
    respond_to_dispute: "Respond to dispute",
    send_statement_of_account: "Send statement of account",
    find_ap_contact: "Find AP contact",
    call_customer: "Call customer",
    do_not_chase: "Do not chase",
    no_action_needed: "No action needed",
  };

  return labels[action] ?? humanLabel(action);
}

function CustomerBehaviourCard({ profile }: { profile: CustomerBehaviourProfile | null }) {
  if (!profile) return null;
  return (
    <section className="rounded-2xl border border-black/10 dark:border-white/10 bg-neutral-950 p-4 text-white shadow-xl">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">
          Customer Behaviour
        </p>
        <Badge variant="outline" className="rounded-full border-white/20 bg-white/10 text-white font-bold h-6 capitalize">
          {profile.behaviourLabel}
        </Badge>
      </div>
      <div className="mt-4 space-y-3">
        {profile.memoryNotes.map((note, i) => (
          <p key={i} className="text-sm leading-relaxed text-neutral-300">
            <span className="text-emerald-400 mr-2">✦</span>
            {note}
          </p>
        ))}
      </div>
    </section>
  );
}

function ScenarioFieldCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-[#28231c] p-4">
      <p className="text-xs font-bold uppercase tracking-widest text-neutral-400">
        {title}
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {children}
      </div>
    </section>
  );
}

function FieldInput({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div className="space-y-2">
      <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">{label}</label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-xl border-black/10 dark:border-white/10 bg-white dark:bg-[#211d17] shadow-sm"
      />
    </div>
  );
}

function ScenarioFields({
  scenario,
  details,
  invoice,
  allInvoices,
  onChange,
}: {
  scenario: ActionScenario;
  details: ScenarioDetails;
  invoice: Invoice;
  allInvoices: Invoice[];
  onChange: (patch: Partial<ScenarioDetails>) => void;
}) {
  const customerInvoices = allInvoices.filter(
    (item) => item.customerId === invoice.customerId && item.amountOutstanding > 0,
  );

  if (scenario === "PROMISE_FOLLOW_UP") {
    return (
      <ScenarioFieldCard title="Promise details">
        <FieldInput label="Promised date" type="date" value={details.promisedDate} onChange={(value) => onChange({ promisedDate: value })} />
        <FieldInput label="Promised amount" value={details.promisedAmount} onChange={(value) => onChange({ promisedAmount: value })} />
        <FieldInput label="Contact who promised" value={details.promisedBy} onChange={(value) => onChange({ promisedBy: value })} />
      </ScenarioFieldCard>
    );
  }

  if (scenario === "REQUEST_REMITTANCE") {
    return (
      <ScenarioFieldCard title="Payment claim">
        <FieldInput label="Payment claim date" type="date" value={details.paymentClaimDate} onChange={(value) => onChange({ paymentClaimDate: value })} />
        <FieldInput label="Payment reference" value={details.paymentReference} onChange={(value) => onChange({ paymentReference: value })} />
        <FieldInput label="Amount claimed paid" value={details.amountClaimedPaid} onChange={(value) => onChange({ amountClaimedPaid: value })} />
      </ScenarioFieldCard>
    );
  }

  if (scenario === "RESOLVE_DISPUTE") {
    return (
      <ScenarioFieldCard title="Dispute details">
        <FieldInput label="Dispute reason" value={details.disputeReason} onChange={(value) => onChange({ disputeReason: value })} />
        <FieldInput label="Owner / responsible person" value={details.disputeOwner} onChange={(value) => onChange({ disputeOwner: value })} />
        <FieldInput label="Next resolution date" type="date" value={details.nextResolutionDate} onChange={(value) => onChange({ nextResolutionDate: value })} />
        <div className="sm:col-span-2 space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">
            Notes
          </label>
          <Textarea
            value={details.disputeNotes}
            onChange={(event) => onChange({ disputeNotes: event.target.value })}
            className="min-h-20 rounded-xl border-black/10 dark:border-white/10 bg-white dark:bg-[#211d17]"
          />
        </div>
      </ScenarioFieldCard>
    );
  }

  if (scenario === "STATEMENT_OF_ACCOUNT") {
    return (
      <ScenarioFieldCard title="Statement summary">
        <InfoLine label="Open invoices" value={`${customerInvoices.length}`} />
        <div className="sm:col-span-2 space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">
            Statement summary
          </label>
          <Textarea
            value={details.statementSummary}
            onChange={(event) => onChange({ statementSummary: event.target.value })}
            className="min-h-20 rounded-xl border-black/10 dark:border-white/10 bg-white dark:bg-[#211d17]"
          />
        </div>
      </ScenarioFieldCard>
    );
  }

  if (scenario === "ASK_FOR_AP_CONTACT") {
    return (
      <ScenarioFieldCard title="Contact details">
        <FieldInput label="Current contact" value={details.currentContact} onChange={(v) => onChange({ currentContact: v })} />
        <FieldInput label="Requested role" value={details.requestedContactRole} onChange={(v) => onChange({ requestedContactRole: v })} />
      </ScenarioFieldCard>
    );
  }

  if (scenario === "INTERNAL_ESCALATION") {
    return (
      <ScenarioFieldCard title="Escalation details">
        <FieldInput label="Internal owner" value={details.internalOwner} onChange={(v) => onChange({ internalOwner: v })} />
        <div className="sm:col-span-2 space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">
            Escalation note
          </label>
          <Textarea
            value={details.escalationNote}
            onChange={(event) => onChange({ escalationNote: event.target.value })}
            className="min-h-20 rounded-xl border-black/10 dark:border-white/10 bg-white dark:bg-[#211d17]"
          />
        </div>
      </ScenarioFieldCard>
    );
  }

  return null;
}

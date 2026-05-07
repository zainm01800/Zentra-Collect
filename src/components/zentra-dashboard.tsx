"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CalendarCheck,
  CheckCircle2,
  Clipboard,
  Copy,
  FileText,
  Loader2,
  MailPlus,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import type {
  DraftGenerationResponse,
  DraftScenario,
  DraftTone,
} from "@/lib/ai/zentra-drafts";
import type { ReplyClassificationResult } from "@/lib/ai/reply-classifier";
import {
  groupActionsByCategory,
  rankCollectionActions,
} from "@/lib/collections/decision-engine";
import { buildCustomerBehaviourProfile } from "@/lib/collections/customer-behaviour";
import {
  demoCustomerBehaviourProfiles,
  demoCustomers,
  demoInvoices,
} from "@/lib/demo-data/zentra-demo-data";
import { formatCurrency, formatDate } from "@/lib/formatters";
import {
  importedInvoicesStorageKey,
  importDiffStorageKey,
  importSummaryStorageKey,
  type ImportDiffOutput,
  type ImportSummary,
} from "@/lib/import/zentra-import";
import { ActivityTimeline } from "@/components/activity-timeline";
import { SafetyPanel } from "@/components/safety-panel";
import type {
  ActivityEvent,
  CollectionScenario,
  CollectionStatus,
  CollectionsDashboardGroup,
  CollectionsPlanItem,
  Customer,
  CustomerBehaviourProfile,
  Invoice,
} from "@/types/zentra";

const referenceDate = "2026-05-07";

const visibleGroups: Array<{
  id: CollectionsDashboardGroup;
  title: string;
  description: string;
}> = [
  {
    id: "chase_now",
    title: "Chase now",
    description: "Safe, useful actions that can move cash today.",
  },
  {
    id: "promises_to_check",
    title: "Promises to check",
    description: "Payment dates that need a careful follow-up.",
  },
  {
    id: "exceptions_to_resolve",
    title: "Exceptions to resolve",
    description: "Disputes, remittance gaps, missing contacts, and data issues.",
  },
  {
    id: "wait_low_priority",
    title: "Wait / low priority",
    description: "Recent chases, future promises, or low-value items.",
  },
];

type ActionScenario =
  | "SEND_PAYMENT_REMINDER"
  | "ASK_FOR_PAYMENT_DATE"
  | "REQUEST_REMITTANCE"
  | "STATEMENT_OF_ACCOUNT"
  | "CONFIRM_INVOICE_RECEIVED"
  | "ASK_FOR_AP_CONTACT"
  | "PROMISE_FOLLOW_UP"
  | "RESOLVE_DISPUTE"
  | "INTERNAL_ESCALATION"
  | "THANK_YOU_AFTER_PAYMENT";

type ScenarioDetails = {
  promisedDate: string;
  promisedAmount: string;
  promisedBy: string;
  paymentClaimDate: string;
  paymentReference: string;
  amountClaimedPaid: string;
  disputeReason: string;
  disputeOwner: string;
  nextResolutionDate: string;
  disputeNotes: string;
  includeMultipleInvoices: boolean;
  totalOutstanding: string;
  statementSummary: string;
  currentContact: string;
  requestedContactRole: string;
  internalOwner: string;
  escalationNote: string;
};

const actionScenarioOptions: Array<{ value: ActionScenario; label: string }> = [
  { value: "SEND_PAYMENT_REMINDER", label: "Send payment reminder" },
  { value: "ASK_FOR_PAYMENT_DATE", label: "Ask for payment date" },
  { value: "REQUEST_REMITTANCE", label: "Request remittance advice" },
  { value: "STATEMENT_OF_ACCOUNT", label: "Send/request statement of account" },
  { value: "CONFIRM_INVOICE_RECEIVED", label: "Confirm invoice was received" },
  { value: "ASK_FOR_AP_CONTACT", label: "Ask for AP/accounts contact" },
  { value: "PROMISE_FOLLOW_UP", label: "Follow up promised payment" },
  { value: "RESOLVE_DISPUTE", label: "Resolve dispute" },
  { value: "INTERNAL_ESCALATION", label: "Escalate internally" },
  { value: "THANK_YOU_AFTER_PAYMENT", label: "Send thank-you after payment" },
];

function readImportedInvoices() {
  if (typeof window === "undefined") return demoInvoices;

  const storedInvoices = window.localStorage.getItem(importedInvoicesStorageKey);
  if (!storedInvoices) return demoInvoices;

  try {
    const parsedInvoices = JSON.parse(storedInvoices) as Invoice[];
    return Array.isArray(parsedInvoices) && parsedInvoices.length
      ? parsedInvoices
      : demoInvoices;
  } catch {
    window.localStorage.removeItem(importedInvoicesStorageKey);
    return demoInvoices;
  }
}

function readImportSummary() {
  if (typeof window === "undefined") return null;

  const storedSummary = window.localStorage.getItem(importSummaryStorageKey);
  if (!storedSummary) return null;

  try {
    return JSON.parse(storedSummary) as ImportSummary;
  } catch {
    window.localStorage.removeItem(importSummaryStorageKey);
    return null;
  }
}

function readImportDiff() {
  if (typeof window === "undefined") return null;

  const storedDiff = window.localStorage.getItem(importDiffStorageKey);
  if (!storedDiff) return null;

  try {
    return JSON.parse(storedDiff) as ImportDiffOutput;
  } catch {
    window.localStorage.removeItem(importDiffStorageKey);
    return null;
  }
}

export function ZentraDashboard({
  initialInvoices,
}: { initialInvoices?: Invoice[] } = {}) {
  const isBookkeeperMode = Boolean(initialInvoices);
  const [invoices, setInvoices] = useState<Invoice[]>(
    () => initialInvoices ?? readImportedInvoices(),
  );
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [subject, setSubject] = useState("");
  const [draft, setDraft] = useState("");
  const [actionScenario, setActionScenario] =
    useState<ActionScenario>("SEND_PAYMENT_REMINDER");
  const [scenarioDetails, setScenarioDetails] =
    useState<ScenarioDetails>(emptyScenarioDetails());
  const [selectedTone, setSelectedTone] = useState<DraftTone>("friendly");
  const [draftRiskNotes, setDraftRiskNotes] = useState(
    "Human review is required before sending.",
  );
  const [draftNextStep, setDraftNextStep] = useState(
    "Review before copying into your email client.",
  );
  const [draftConfidence, setDraftConfidence] =
    useState<DraftGenerationResponse["confidence"]>("medium");
  const [draftSource, setDraftSource] =
    useState<DraftGenerationResponse["source"]>("template");
  const [replyText, setReplyText] = useState("");
  const [replyClassification, setReplyClassification] =
    useState<ReplyClassificationResult | null>(null);
  const [isClassifyingReply, setIsClassifyingReply] = useState(false);
  const [replyPromiseDate, setReplyPromiseDate] = useState("");
  const [replyPromiseAmount, setReplyPromiseAmount] = useState("");
  const [replyDisputeReason, setReplyDisputeReason] = useState("");
  const [importSummary] = useState<ImportSummary | null>(
    isBookkeeperMode ? null : readImportSummary,
  );
  const [importDiff] = useState<ImportDiffOutput | null>(
    isBookkeeperMode ? null : readImportDiff,
  );
  const [loadState, setLoadState] = useState<"ready" | "loading" | "error">(
    "ready",
  );

  const customers = useMemo(
    () => (importSummary ? inferCustomersFromInvoices(invoices) : demoCustomers),
    [importSummary, invoices],
  );
  const behaviourProfiles = useMemo(
    () =>
      importSummary
        ? inferProfilesFromInvoices(invoices)
        : demoCustomerBehaviourProfiles,
    [importSummary, invoices],
  );

  const plan = useMemo(
    () =>
      rankCollectionActions({
        invoices,
        customers,
        customerBehaviourProfiles: behaviourProfiles,
        referenceDate,
      }),
    [behaviourProfiles, customers, invoices],
  );
  const groups = useMemo(() => groupActionsByCategory(plan), [plan]);
  const selectedPlan = plan.find((item) => item.id === selectedPlanId) ?? null;
  const selectedInvoice = selectedPlan
    ? invoices.find((invoice) => invoice.id === selectedPlan.invoiceId) ?? null
    : null;
  const selectedCustomer = selectedInvoice
    ? customers.find((customer) => customer.id === selectedInvoice.customerId) ??
      null
    : null;

  const summary = useMemo(() => buildSummary(invoices, plan), [invoices, plan]);

  function openReview(item: CollectionsPlanItem) {
    const invoice = invoices.find((current) => current.id === item.invoiceId);
    const nextActionScenario = actionScenarioForPlan(item);
    const nextDetails = invoice
      ? scenarioDetailsForInvoice(invoice, invoices)
      : emptyScenarioDetails();
    setSelectedPlanId(item.id);
    setActionScenario(nextActionScenario);
    setScenarioDetails(nextDetails);
    const initialDraft = invoice ? buildDraftMessage(item, invoice) : "";
    setSubject(invoice ? defaultSubject(item, invoice) : "");
    setDraft(initialDraft);
    setSelectedTone(recommendedToneFor(item));
    setDraftRiskNotes(
      item.safetyChecks.length
        ? item.safetyChecks.map((check) => check.explanation).join(" ")
        : "Human review is required before sending.",
    );
    setDraftNextStep("Review before copying into your email client.");
    setDraftConfidence(item.confidenceLevel);
    setDraftSource("template");
    setReplyText("");
    setReplyClassification(null);
    setReplyPromiseDate(nextDetails.promisedDate);
    setReplyPromiseAmount(nextDetails.promisedAmount);
    setReplyDisputeReason(nextDetails.disputeReason);
    setCopied(false);

    if (invoice) {
      addActivityEvent(
        invoice.id,
        invoice.businessId,
        "recommendation_created",
        `Recommendation reviewed: ${humanAction(item.recommendedAction)}`,
        `Zentra ranked this action with ${item.urgencyLevel} urgency. ${item.reason}`,
      );
    }
  }

  function updateInvoiceStatus(status: CollectionStatus, title: string) {
    if (!selectedInvoice) return;

    setInvoices((current) =>
      current.map((invoice) =>
        invoice.id === selectedInvoice.id
          ? {
              ...invoice,
              status,
              amountOutstanding:
                status === "paid" ? 0 : invoice.amountOutstanding,
              promisedPaymentDate:
                status === "promised" ? "2026-05-12" : invoice.promisedPaymentDate,
              activityHistory: [
                {
                  id: `${invoice.id}-${status}-${Date.now()}`,
                  invoiceId: invoice.id,
                  customerId: invoice.customerId,
                  businessId: invoice.businessId,
                  type:
                    status === "paid"
                      ? "paid"
                      : status === "promised"
                        ? "promise_recorded"
                        : status === "disputed"
                          ? "dispute_recorded"
                          : status === "do_not_chase"
                            ? "safety_blocked"
                            : "note_added",
                  title,
                  description: `${title} in demo mode. No outbound message was sent.`,
                  createdAt: new Date().toISOString(),
                  createdBy: "Alex Chen",
                } satisfies ActivityEvent,
                ...invoice.activityHistory,
              ],
            }
          : invoice,
      ),
    );
  }

  function addActivityEvent(
    invoiceId: string,
    businessId: string,
    type: ActivityEvent["type"],
    title: string,
    description: string,
  ) {
    setInvoices((current) =>
      current.map((invoice) =>
        invoice.id === invoiceId
          ? {
              ...invoice,
              activityHistory: [
                {
                  id: `${invoiceId}-${type}-${Date.now()}`,
                  invoiceId,
                  businessId,
                  type,
                  title,
                  description,
                  createdAt: new Date().toISOString(),
                  createdBy: "Alex Chen",
                } satisfies ActivityEvent,
                ...invoice.activityHistory,
              ],
            }
          : invoice,
      ),
    );
  }

  function applyReplyClassification() {
    if (!selectedInvoice || !replyClassification) return;

    const statusByClassification: Partial<
      Record<ReplyClassificationResult["classification"], CollectionStatus>
    > = {
      promise_to_pay: "promised",
      dispute: "disputed",
      already_paid_claim: "awaiting_remittance",
      needs_statement: "awaiting_statement",
      needs_remittance: "awaiting_remittance",
      wrong_contact: "needs_ap_contact",
      asks_for_PO: "overdue",
      partial_payment: "overdue",
      refusal_or_delay: "overdue",
      needs_invoice_copy: "overdue",
    };
    const nextStatus =
      statusByClassification[replyClassification.classification] ?? "overdue";

    setInvoices((current) =>
      current.map((invoice) =>
        invoice.id === selectedInvoice.id
          ? {
              ...invoice,
              status: nextStatus,
              promisedPaymentDate:
                replyClassification.classification === "promise_to_pay"
                  ? replyPromiseDate || replyClassification.extractedPromiseDate
                  : invoice.promisedPaymentDate,
              disputeReason:
                replyClassification.classification === "dispute"
                  ? replyDisputeReason ||
                    replyClassification.extractedDisputeReason ||
                    invoice.disputeReason
                  : invoice.disputeReason,
              remittanceNeeded:
                replyClassification.classification === "already_paid_claim" ||
                replyClassification.classification === "needs_remittance"
                  ? true
                  : invoice.remittanceNeeded,
              statementNeeded:
                replyClassification.classification === "needs_statement"
                  ? true
                  : invoice.statementNeeded,
              activityHistory: [
                {
                  id: `${invoice.id}-reply-classified-${Date.now()}`,
                  invoiceId: invoice.id,
                  customerId: invoice.customerId,
                  businessId: invoice.businessId,
                  type: "note_added",
                  title: `Reply classified as ${humanLabel(replyClassification.classification)}`,
                  description: `${replyClassification.reason} Suggested next action: ${replyClassification.suggestedNextAction}`,
                  createdAt: new Date().toISOString(),
                  createdBy: "Alex Chen",
                } satisfies ActivityEvent,
                ...invoice.activityHistory,
              ],
            }
          : invoice,
      ),
    );

    if (replyClassification.classification === "promise_to_pay") {
      setActionScenario("PROMISE_FOLLOW_UP");
      setScenarioDetails((current) => ({
        ...current,
        promisedDate: replyPromiseDate,
        promisedAmount: replyPromiseAmount,
      }));
    }
    if (replyClassification.classification === "dispute") {
      setActionScenario("RESOLVE_DISPUTE");
      setScenarioDetails((current) => ({
        ...current,
        disputeReason: replyDisputeReason,
      }));
    }
    if (replyClassification.classification === "already_paid_claim") {
      setActionScenario("REQUEST_REMITTANCE");
    }
  }

  async function classifyReply() {
    if (!selectedInvoice || !replyText.trim()) return;
    setIsClassifyingReply(true);

    try {
      const response = await fetch("/api/zentra/classify-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          replyText,
          customerName: selectedInvoice.customerName,
          invoiceNumber: selectedInvoice.invoiceNumber,
          amountOutstanding: selectedInvoice.amountOutstanding,
        }),
      });

      if (!response.ok) throw new Error("Reply classification failed.");
      const result = (await response.json()) as ReplyClassificationResult;
      setReplyClassification(result);
      setReplyPromiseDate(result.extractedPromiseDate ?? "");
      setReplyPromiseAmount(
        result.extractedPromiseAmount
          ? String(result.extractedPromiseAmount)
          : String(selectedInvoice.amountOutstanding),
      );
      setReplyDisputeReason(result.extractedDisputeReason ?? "");
    } catch {
      setReplyClassification({
        classification: "unclear",
        confidence: "low",
        reason: "Zentra could not classify this reply automatically.",
        suggestedStatusUpdate: "Manual review",
        suggestedNextAction: "Read the reply and choose the next action manually.",
        requiresManualReview: true,
        source: "manual_review",
      });
    } finally {
      setIsClassifyingReply(false);
    }
  }

  async function copyMessage() {
    if (!draft && !subject) return;
    if (!selectedInvoice) return;
    await navigator.clipboard.writeText(
      [`Subject: ${subject}`, "", draft].join("\n"),
    );
    setCopied(true);
    addActivityEvent(
      selectedInvoice.id,
      selectedInvoice.businessId,
      "message_copied",
      "Draft copied for review",
      "A draft message was copied to clipboard. No outbound message was sent in demo mode.",
    );
  }

  async function generateDraft() {
    if (!selectedPlan || !selectedInvoice) return;
    setIsGenerating(true);
    const actionMeta = actionScenarioMeta(
      actionScenario,
      selectedInvoice,
      invoices,
      scenarioDetails,
    );
    const scenario = draftScenarioForAction(actionScenario);

    if (!scenario) {
      const fallback = buildActionDraftMessage(
        actionScenario,
        selectedPlan,
        selectedInvoice,
        invoices,
        scenarioDetails,
      );
      setSubject(defaultSubjectForAction(actionScenario, selectedPlan, selectedInvoice));
      setDraft(fallback);
      setDraftRiskNotes(actionMeta.safetyChecks.join(" "));
      setDraftConfidence("low");
      setIsGenerating(false);
      return;
    }

    try {
      const profile = behaviourProfiles.find(
        (item) => item.customerId === selectedInvoice.customerId,
      );
      const response = await fetch("/api/zentra/generate-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenario,
          customerName: selectedInvoice.customerName,
          customerEmail: selectedInvoice.customerEmail,
          invoiceNumber: selectedInvoice.invoiceNumber,
          amountOutstanding: selectedInvoice.amountOutstanding,
          dueDate: selectedInvoice.dueDate,
          daysOverdue: selectedInvoice.daysOverdue,
          chaseCount: selectedInvoice.previousChaseCount,
          relationshipType: selectedInvoice.relationshipType,
          customerBehaviourSummary:
            profile?.memoryNotes.join(" ") ?? profile?.behaviourLabel,
          notes: selectedInvoice.customerNotes,
          disputeReason: selectedInvoice.disputeReason,
          promisedPaymentDate: selectedInvoice.promisedPaymentDate,
          promisedAmount: Number(scenarioDetails.promisedAmount) || undefined,
          promisedBy: scenarioDetails.promisedBy || undefined,
          paymentClaimDate: scenarioDetails.paymentClaimDate || undefined,
          paymentReference: scenarioDetails.paymentReference || undefined,
          amountClaimedPaid:
            Number(scenarioDetails.amountClaimedPaid) || undefined,
          disputeOwner: scenarioDetails.disputeOwner || undefined,
          nextResolutionDate: scenarioDetails.nextResolutionDate || undefined,
          statementSummary: scenarioDetails.statementSummary || undefined,
          requestedContactRole: scenarioDetails.requestedContactRole || undefined,
          internalOwner: scenarioDetails.internalOwner || undefined,
          escalationNote: scenarioDetails.escalationNote || undefined,
          recommendedAction: actionMeta.recommendedAction,
          reason: actionMeta.explanation,
          selectedTone,
          lateFeesEnabled: false,
        }),
      });

      if (!response.ok) throw new Error("Draft generation failed.");
      const generated = (await response.json()) as DraftGenerationResponse;
      setSubject(generated.subject);
      setDraft(generated.body);
      setDraftNextStep(generated.suggestedNextStep);
      setDraftRiskNotes(generated.riskNotes);
      setDraftConfidence(generated.confidence);
      setDraftSource(generated.source ?? "template");
      if (selectedInvoice) {
        addActivityEvent(
          selectedInvoice.id,
          selectedInvoice.businessId,
          "message_drafted",
          "Draft generated",
          `${generated.source ?? "template"} draft created for ${actionScenario.toLowerCase().replace(/_/g, " ")}. Confidence: ${generated.confidence}.`,
        );
      }
    } catch {
      const fallback = buildActionDraftMessage(
        actionScenario,
        selectedPlan,
        selectedInvoice,
        invoices,
        scenarioDetails,
      );
      setSubject(defaultSubjectForAction(actionScenario, selectedPlan, selectedInvoice));
      setDraft(fallback);
      setDraftRiskNotes(
        "AI draft generation failed, so Zentra used a safe template fallback. Human review is still required.",
      );
      setDraftConfidence("medium");
      setDraftSource("template");
    } finally {
      setIsGenerating(false);
    }
  }

  if (loadState === "loading") {
    return <DashboardLoadingState />;
  }

  if (loadState === "error") {
    return (
      <DashboardErrorState onRetry={() => setLoadState("ready")} />
    );
  }

  if (!invoices.length) {
    return <DashboardEmptyState />;
  }

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-5 border-b border-black/10 pb-7 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
            Zentra Collect
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-normal text-neutral-950 sm:text-5xl">
            Today&apos;s collections plan
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-neutral-600">
            Know who to chase, what to do, and why.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="rounded-full border-black/10 bg-white/60"
            onClick={() => setLoadState("loading")}
          >
            Preview loading
          </Button>
          <Button
            type="button"
            variant="outline"
            className="rounded-full border-black/10 bg-white/60"
            onClick={() => setLoadState("error")}
          >
            Preview error
          </Button>
          <Button asChild className="rounded-full bg-neutral-950 px-4 text-white hover:bg-neutral-800">
            <Link href="/import">Import invoices</Link>
          </Button>
        </div>
      </section>

      {importSummary ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-900 sm:flex-row sm:items-center sm:justify-between">
          <span>
            We found {formatCurrency(importSummary.cashNeedingAttention)} needing
            attention, {importSummary.actionsRecommended} actions recommended,{" "}
            {importSummary.exceptions} exceptions.
          </span>
          <Button asChild variant="outline" className="rounded-full border-emerald-300 bg-white/70">
            <Link href="/import/summary">View import summary</Link>
          </Button>
        </div>
      ) : null}

      {importDiff ? <ImportDiffDashboard diff={importDiff} /> : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {summary.map((item) => (
          <Card
            key={item.label}
            className="rounded-2xl border border-black/5 bg-white/70 shadow-none ring-black/10"
          >
            <CardHeader className="gap-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardDescription className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">
                    {item.label}
                  </CardDescription>
                  <CardTitle className="mt-3 text-2xl font-semibold text-neutral-950">
                    {item.value}
                  </CardTitle>
                </div>
                <span className="rounded-full border border-black/10 bg-[#f7f2ea] p-2 text-neutral-700">
                  <item.icon className="size-4" />
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-neutral-500">{item.detail}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-neutral-950">
                Ranked plan
              </h2>
              <p className="text-sm text-neutral-600">
                Rules decide the order. Drafting only happens after review.
              </p>
            </div>
            <Badge
              variant="outline"
              className="h-7 rounded-full border-black/10 bg-white/70 px-3 text-neutral-700"
            >
              {plan.filter((item) => item.dashboardGroup !== "do_not_chase")
                .length}{" "}
              active recommendations
            </Badge>
          </div>

          {visibleGroups.map((group) => (
            <PlanGroup
              key={group.id}
              title={group.title}
              description={group.description}
              items={groups[group.id]}
              invoices={invoices}
              onReview={openReview}
            />
          ))}
        </div>

        <aside className="hidden xl:block">
          <div className="sticky top-24 rounded-2xl border border-black/10 bg-white/65 p-5">
            <p className="text-sm font-medium text-neutral-950">
              Action + reason + message
            </p>
            <p className="mt-2 text-sm leading-6 text-neutral-600">
              Zentra ranks the work, explains the recommendation, and prepares a
              safe draft. The user still reviews and sends outside the MVP.
            </p>
            <div className="mt-5 space-y-3 text-sm text-neutral-700">
              <InfoLine label="Blocked items" value="Need human review first" />
              <InfoLine label="Safe drafts" value="Copy-only, no auto-send" />
              <InfoLine label="Demo mode" value={`${invoices.length} invoices`} />
            </div>
          </div>
        </aside>
      </section>

      <ActionDrawer
        item={selectedPlan}
        invoice={selectedInvoice}
        customer={selectedCustomer}
        behaviourProfile={
          selectedInvoice
            ? behaviourProfiles.find(
                (profile) => profile.customerId === selectedInvoice.customerId,
              ) ?? null
            : null
        }
        subject={subject}
        draft={draft}
        actionScenario={actionScenario}
        scenarioDetails={scenarioDetails}
        allInvoices={invoices}
        tone={selectedTone}
        riskNotes={draftRiskNotes}
        nextStep={draftNextStep}
        draftConfidence={draftConfidence}
        draftSource={draftSource}
        replyText={replyText}
        replyClassification={replyClassification}
        isClassifyingReply={isClassifyingReply}
        replyPromiseDate={replyPromiseDate}
        replyPromiseAmount={replyPromiseAmount}
        replyDisputeReason={replyDisputeReason}
        isGenerating={isGenerating}
        copied={copied}
        onOpenChange={(open) => {
          if (!open) setSelectedPlanId(null);
        }}
        onActionScenarioChange={(nextScenario) => {
          if (!selectedPlan || !selectedInvoice) return;
          setActionScenario(nextScenario);
          const nextMeta = actionScenarioMeta(
            nextScenario,
            selectedInvoice,
            invoices,
            scenarioDetails,
          );
          setSubject(defaultSubjectForAction(nextScenario, selectedPlan, selectedInvoice));
          setDraft(
            buildActionDraftMessage(
              nextScenario,
              selectedPlan,
              selectedInvoice,
              invoices,
              scenarioDetails,
            ),
          );
          setDraftRiskNotes(nextMeta.safetyChecks.join(" "));
          setDraftNextStep(nextMeta.nextStep);
          setDraftConfidence(nextMeta.confidence);
        }}
        onScenarioDetailsChange={(patch) =>
          setScenarioDetails((current) => ({ ...current, ...patch }))
        }
        onToneChange={setSelectedTone}
        onSubjectChange={setSubject}
        onDraftChange={setDraft}
        onReplyTextChange={setReplyText}
        onClassifyReply={classifyReply}
        onApplyReplyClassification={applyReplyClassification}
        onReplyPromiseDateChange={setReplyPromiseDate}
        onReplyPromiseAmountChange={setReplyPromiseAmount}
        onReplyDisputeReasonChange={setReplyDisputeReason}
        onGenerate={generateDraft}
        onCopy={copyMessage}
        onMarkSent={() => updateInvoiceStatus("overdue", "Marked as sent")}
        onMarkPromised={() =>
          updateInvoiceStatus("promised", "Promise to pay recorded")
        }
        onMarkDisputed={() =>
          updateInvoiceStatus("disputed", "Dispute recorded")
        }
        onMarkPaid={() => updateInvoiceStatus("paid", "Marked paid")}
        onSnooze={() => updateInvoiceStatus("overdue", "Snoozed for later")}
        onDoNotChase={() =>
          updateInvoiceStatus("do_not_chase", "Marked do not chase")
        }
      />
    </div>
  );
}

function ImportDiffDashboard({ diff }: { diff: ImportDiffOutput }) {
  return (
    <section className="rounded-2xl border border-black/10 bg-white/70 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">
            What changed since last import
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-neutral-950">
            Import movement summary
          </h2>
        </div>
        <Button asChild variant="outline" className="rounded-full border-black/10 bg-[#fbf8f1]">
          <Link href="/import/summary">View import summary</Link>
        </Button>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <DiffCard label="Paid since last import" value={formatCurrency(diff.totalPaidAmount)} detail={`${diff.paidSinceLastImport.length} invoices`} />
        <DiffCard label="Newly overdue" value={String(diff.newlyOverdue.length)} detail={formatCurrency(diff.totalNewlyOverdueAmount)} />
        <DiffCard label="Still overdue" value={String(diff.stillOverdue.length)} detail={formatCurrency(diff.totalStillOutstanding)} />
        <DiffCard label="Missed promises" value={String(diff.promisesMissed.length)} detail="Needs follow-up" />
        <DiffCard label="Unresolved disputes" value={String(diff.disputesStillOpen.length)} detail="Do not chase normally" />
      </div>
      {diff.topChanges.length ? (
        <div className="mt-5 space-y-2">
          {diff.topChanges.map((change) => (
            <div
              key={change.id}
              className="rounded-xl border border-black/10 bg-[#fbf8f1] p-3 text-sm leading-6 text-neutral-700"
            >
              <span className="font-medium text-neutral-950">
                {change.customerName} · {change.invoiceNumber}
              </span>{" "}
              {change.message}
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function DiffCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-xl border border-black/10 bg-[#fbf8f1] p-4">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-neutral-500">
        {label}
      </p>
      <p className="mt-3 text-2xl font-semibold text-neutral-950">{value}</p>
      <p className="mt-1 text-sm text-neutral-500">{detail}</p>
    </div>
  );
}

function inferCustomersFromInvoices(invoices: Invoice[]): Customer[] {
  const seen = new Map<string, Customer>();

  for (const invoice of invoices) {
    if (!seen.has(invoice.customerId)) {
      seen.set(invoice.customerId, {
        id: invoice.customerId,
        businessId: invoice.businessId,
        name: invoice.customerName,
        email: invoice.customerEmail,
        relationshipType: invoice.relationshipType,
        customerNotes: invoice.customerNotes,
        createdAt: new Date().toISOString(),
      });
    }
  }

  return Array.from(seen.values());
}

function inferProfilesFromInvoices(invoices: Invoice[]): CustomerBehaviourProfile[] {
  const customers = inferCustomersFromInvoices(invoices);
  return customers.map((customer) =>
    buildCustomerBehaviourProfile(customer, invoices),
  );
}

function PlanGroup({
  title,
  description,
  items,
  invoices,
  onReview,
}: {
  title: string;
  description: string;
  items: CollectionsPlanItem[];
  invoices: Invoice[];
  onReview: (item: CollectionsPlanItem) => void;
}) {
  return (
    <Card className="rounded-2xl border border-black/10 bg-white/70 py-0 shadow-none ring-0">
      <CardHeader className="border-b border-black/10 p-4 sm:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-lg font-semibold text-neutral-950">
              {title}
              <span className="ml-2 rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">
                {items.length}
              </span>
            </CardTitle>
            <CardDescription className="mt-1 text-neutral-600">
              {description}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {items.length ? (
          <div className="divide-y divide-black/10">
            {items.map((item) => {
              const invoice = invoices.find(
                (current) => current.id === item.invoiceId,
              );

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onReview(item)}
                  className="grid w-full gap-3 px-4 py-4 text-left transition hover:bg-[#f7f2ea]/70 sm:px-5 lg:grid-cols-[minmax(190px,1.1fr)_120px_120px_minmax(220px,1.2fr)_180px]"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-neutral-950">
                      {item.customerName}
                    </p>
                    <p className="mt-1 text-xs text-neutral-500">
                      {item.invoiceNumber || "Customer balance"}
                    </p>
                  </div>
                  <Metric
                    label="Outstanding"
                    value={formatCurrency(item.amountOutstanding)}
                  />
                  <Metric
                    label="Due"
                    value={invoice?.dueDate ? formatDate(invoice.dueDate) : "Missing"}
                    detail={
                      invoice?.daysOverdue
                        ? `${invoice.daysOverdue} days overdue`
                        : "Not overdue"
                    }
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-neutral-950">
                      {humanAction(item.recommendedAction)}
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-neutral-600">
                      {item.reason}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                    <StatusBadge value={item.urgencyLevel} />
                    <StatusBadge value={item.confidenceLevel} prefix="confidence" />
                    <SafetyBadge value={item.safetyStatus} />
                    <span className="w-full text-xs font-medium text-neutral-950 lg:text-right">
                      Review action
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="p-5 text-sm text-neutral-600">
            Nothing in this group right now.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ActionDrawer({
  item,
  invoice,
  customer,
  behaviourProfile,
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
  onOpenChange,
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
}: {
  item: CollectionsPlanItem | null;
  invoice: Invoice | null;
  customer: Customer | null;
  behaviourProfile: CustomerBehaviourProfile | null;
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
  onOpenChange: (open: boolean) => void;
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
}) {
  const open = Boolean(item && invoice);
  const actionMeta =
    item && invoice
      ? actionScenarioMeta(actionScenario, invoice, allInvoices, scenarioDetails)
      : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className="w-full overflow-y-auto border-black/10 bg-[#fbf8f1] p-0 sm:max-w-xl"
        side="right"
      >
        {item && invoice ? (
          <>
            <SheetHeader className="border-b border-black/10 p-5">
              <SheetTitle className="text-2xl font-semibold text-neutral-950">
                {invoice.customerName}
              </SheetTitle>
              <SheetDescription className="text-neutral-600">
                Invoice {invoice.invoiceNumber} ·{" "}
                {formatCurrency(invoice.amountOutstanding)} outstanding
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-5 p-5">
              <section className="grid gap-3 rounded-2xl border border-black/10 bg-white/70 p-4 sm:grid-cols-2">
                <InfoLine label="Due date" value={formatDate(invoice.dueDate ?? null)} />
                <InfoLine
                  label="Days overdue"
                  value={invoice.daysOverdue ? `${invoice.daysOverdue}` : "0"}
                />
                <InfoLine
                  label="Contact"
                  value={customer?.apEmail ?? invoice.customerEmail ?? "Missing"}
                />
                <InfoLine label="Relationship" value={invoice.relationshipType} />
              </section>

              <CustomerBehaviourCard profile={behaviourProfile} />

              <section className="rounded-2xl border border-black/10 bg-white/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">
                  Recommendation
                </p>
                <h3 className="mt-3 text-lg font-semibold text-neutral-950">
                  {actionMeta?.recommendedAction ?? humanAction(item.recommendedAction)}
                </h3>
                <p className="mt-2 text-sm leading-6 text-neutral-600">
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
              </section>

              <section className="rounded-2xl border border-black/10 bg-white/70 p-4">
                <div className="flex flex-col gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">
                      What do you need to do?
                    </p>
                    <p className="mt-1 text-sm text-neutral-600">
                      Choose the job first. Zentra adjusts the reason, safety
                      checks, fields, and draft.
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Select
                      value={actionScenario}
                      onValueChange={(value) => {
                        const next = value as ActionScenario;
                        onActionScenarioChange(next);
                      }}
                    >
                      <SelectTrigger className="w-full rounded-full bg-white">
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
                    <Select
                      value={tone}
                      onValueChange={(value) => onToneChange(value as DraftTone)}
                    >
                      <SelectTrigger className="w-full rounded-full bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="friendly">Friendly</SelectItem>
                        <SelectItem value="neutral">Neutral</SelectItem>
                        <SelectItem value="firm">Firm</SelectItem>
                        <SelectItem value="final">Final</SelectItem>
                      </SelectContent>
                    </Select>
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

              <section className="rounded-2xl border border-black/10 bg-white/70 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">
                      Draft message
                    </p>
                    <p className="mt-1 text-sm text-neutral-600">
                      Copy-only in MVP. Review before sending.
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className="rounded-full border-black/10 bg-[#f7f2ea]"
                  >
                    {draftSource ?? "template"} · {draftConfidence}
                  </Badge>
                </div>
                <div className="mt-4 space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">
                    Subject
                  </label>
                  <Input
                    value={subject}
                    onChange={(event) => onSubjectChange(event.target.value)}
                    className="rounded-2xl border-black/10 bg-[#fbf8f1]"
                  />
                </div>
                <Textarea
                  className="mt-4 min-h-64 resize-none rounded-2xl border-black/10 bg-[#fbf8f1] leading-6"
                  value={draft}
                  onChange={(event) => onDraftChange(event.target.value)}
                />
                <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
                  <p className="font-semibold">Human review required</p>
                  <p className="mt-1">{riskNotes}</p>
                  <p className="mt-2">{nextStep}</p>
                </div>
              </section>

              <SafetyPanel checks={item.safetyChecks} selectedTone={tone} />

              <section className="rounded-2xl border border-black/10 bg-white/70 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">
                      Classify customer reply
                    </p>
                    <p className="mt-1 text-sm text-neutral-600">
                      Paste a reply to turn it into an AR state and next action.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-full border-black/10 bg-[#fbf8f1]"
                    onClick={onClassifyReply}
                    disabled={!replyText.trim() || isClassifyingReply}
                  >
                    {isClassifyingReply ? "Classifying..." : "Classify"}
                  </Button>
                </div>
                <Textarea
                  className="mt-4 min-h-28 resize-none rounded-2xl border-black/10 bg-[#fbf8f1] leading-6"
                  value={replyText}
                  onChange={(event) => onReplyTextChange(event.target.value)}
                  placeholder="Paste the customer reply here..."
                />
                {replyClassification ? (
                  <div className="mt-4 rounded-2xl border border-black/10 bg-[#fbf8f1] p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-neutral-950">
                          {humanLabel(replyClassification.classification)}
                        </p>
                        <p className="mt-1 text-sm leading-6 text-neutral-600">
                          {replyClassification.reason}
                        </p>
                      </div>
                      <Badge variant="outline" className="w-fit rounded-full border-black/10 bg-white/70">
                        {replyClassification.source} · {replyClassification.confidence}
                      </Badge>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <InfoLine
                        label="Suggested status"
                        value={replyClassification.suggestedStatusUpdate}
                      />
                      <InfoLine
                        label="Next action"
                        value={replyClassification.suggestedNextAction}
                      />
                    </div>
                    {replyClassification.classification === "promise_to_pay" ? (
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <FieldInput
                          label="Promised payment date"
                          type="date"
                          value={replyPromiseDate}
                          onChange={onReplyPromiseDateChange}
                        />
                        <FieldInput
                          label="Promised amount"
                          value={replyPromiseAmount}
                          onChange={onReplyPromiseAmountChange}
                        />
                      </div>
                    ) : null}
                    {replyClassification.classification === "dispute" ? (
                      <div className="mt-4">
                        <label className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">
                          Dispute reason
                        </label>
                        <Textarea
                          value={replyDisputeReason}
                          onChange={(event) =>
                            onReplyDisputeReasonChange(event.target.value)
                          }
                          className="mt-2 min-h-20 rounded-2xl border-black/10 bg-white/70"
                        />
                      </div>
                    ) : null}
                    {replyClassification.classification === "already_paid_claim" ? (
                      <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
                        Customer claims payment was made. Zentra recommends
                        requesting remittance advice before sending another
                        reminder.
                      </p>
                    ) : null}
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

              <section className="rounded-2xl border border-black/10 bg-white/70 p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">
                  Activity history
                </p>
                <ActivityTimeline items={invoice.activityHistory} />
              </section>
            </div>

            <div className="sticky bottom-0 grid gap-2 border-t border-black/10 bg-[#fbf8f1]/95 p-4 backdrop-blur sm:grid-cols-2">
              <Button
                className="rounded-full bg-neutral-950 text-white hover:bg-neutral-800"
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
                className="rounded-full border-black/10 bg-white/70"
                onClick={onCopy}
              >
                <Copy className="size-4" />
                {copied ? "Copied" : "Copy message"}
              </Button>
              <Button variant="outline" className="rounded-full bg-white/70" onClick={onMarkSent}>
                Mark as sent
              </Button>
              <Button variant="outline" className="rounded-full bg-white/70" onClick={onMarkPromised}>
                Mark promised
              </Button>
              <Button variant="outline" className="rounded-full bg-white/70" onClick={onMarkDisputed}>
                Mark disputed
              </Button>
              <Button variant="outline" className="rounded-full bg-white/70" onClick={onMarkPaid}>
                Mark paid
              </Button>
              <Button variant="outline" className="rounded-full bg-white/70" onClick={onSnooze}>
                Snooze
              </Button>
              <Button variant="outline" className="rounded-full bg-white/70" onClick={onDoNotChase}>
                Do not chase
              </Button>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
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
        <div className="sm:col-span-2">
          <label className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">
            Notes
          </label>
          <Textarea
            value={details.disputeNotes}
            onChange={(event) => onChange({ disputeNotes: event.target.value })}
            className="mt-2 min-h-20 rounded-2xl border-black/10 bg-[#fbf8f1]"
          />
        </div>
      </ScenarioFieldCard>
    );
  }

  if (scenario === "STATEMENT_OF_ACCOUNT") {
    return (
      <ScenarioFieldCard title="Statement summary">
        <InfoLine label="Open invoices" value={`${customerInvoices.length}`} />
        <InfoLine label="Total outstanding" value={formatCurrency(customerInvoices.reduce((sum, item) => sum + item.amountOutstanding, 0))} />
        <div className="sm:col-span-2">
          <label className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">
            Statement summary
          </label>
          <Textarea
            value={details.statementSummary}
            onChange={(event) => onChange({ statementSummary: event.target.value })}
            className="mt-2 min-h-20 rounded-2xl border-black/10 bg-[#fbf8f1]"
          />
        </div>
      </ScenarioFieldCard>
    );
  }

  if (scenario === "ASK_FOR_AP_CONTACT") {
    return (
      <ScenarioFieldCard title="Contact details">
        <FieldInput label="Current contact" value={details.currentContact} onChange={(value) => onChange({ currentContact: value })} />
        <FieldInput label="Requested contact role" value={details.requestedContactRole} onChange={(value) => onChange({ requestedContactRole: value })} />
      </ScenarioFieldCard>
    );
  }

  if (scenario === "INTERNAL_ESCALATION") {
    return (
      <ScenarioFieldCard title="Internal escalation">
        <FieldInput label="Account manager / owner" value={details.internalOwner} onChange={(value) => onChange({ internalOwner: value })} />
        <div>
          <label className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">
            Escalation note
          </label>
          <Textarea
            value={details.escalationNote}
            onChange={(event) => onChange({ escalationNote: event.target.value })}
            className="mt-2 min-h-20 rounded-2xl border-black/10 bg-[#fbf8f1]"
          />
        </div>
      </ScenarioFieldCard>
    );
  }

  return null;
}

function CustomerBehaviourCard({
  profile,
}: {
  profile: CustomerBehaviourProfile | null;
}) {
  if (!profile || profile.totalInvoices < 2 || profile.riskLabel === "unknown") {
    return (
      <section className="rounded-2xl border border-black/10 bg-white/70 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">
          Customer behaviour
        </p>
        <h3 className="mt-3 text-lg font-semibold text-neutral-950">
          Not enough history yet.
        </h3>
        <p className="mt-2 text-sm leading-6 text-neutral-600">
          Based on previous imported data, Zentra needs more invoice history
          before suggesting a customer pattern.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-black/10 bg-white/70 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">
            Customer behaviour
          </p>
          <h3 className="mt-3 text-lg font-semibold text-neutral-950">
            Based on previous imported data, this customer looks{" "}
            {profile.riskLabel}.
          </h3>
        </div>
        <Badge variant="outline" className="w-fit rounded-full border-black/10 bg-[#f7f2ea]">
          {profile.riskLabel}
        </Badge>
      </div>
      <p className="mt-2 text-sm leading-6 text-neutral-600">
        {profile.memoryNotes[0]}
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <InfoLine label="Average days late" value={`${profile.averageDaysLate}`} />
        <InfoLine
          label="Paid on time / late"
          value={`${profile.invoicesPaidOnTime} / ${profile.invoicesPaidLate}`}
        />
        <InfoLine
          label="Reminder pattern"
          value={`${profile.remindersUsuallyNeeded} usually needed`}
        />
        <InfoLine
          label="After first reminder"
          value={
            profile.averageDaysToPaymentAfterFirstReminder === null
              ? "No paid history"
              : `${profile.averageDaysToPaymentAfterFirstReminder} days`
          }
        />
        <InfoLine
          label="Promises missed"
          value={`${profile.missedPromisesCount}`}
        />
        <InfoLine label="Disputes" value={`${profile.disputesCount}`} />
        <InfoLine
          label="Remittance requests"
          value={`${profile.remittanceRequestsCount}`}
        />
        <InfoLine
          label="Statement requests"
          value={`${profile.statementRequestsCount}`}
        />
      </div>
      <div className="mt-4 rounded-xl border border-black/10 bg-[#fbf8f1] p-3 text-sm leading-6 text-neutral-700">
        <p>
          <span className="font-medium text-neutral-950">Payment behaviour:</span>{" "}
          {profile.lastPaymentBehaviour}
        </p>
        <p className="mt-2">
          <span className="font-medium text-neutral-950">Suggested tone:</span>{" "}
          {humanLabel(profile.preferredToneSuggestion)}
        </p>
        <p className="mt-2">
          <span className="font-medium text-neutral-950">Recommendation:</span>{" "}
          {profile.recommendation}.
        </p>
        <p className="mt-2">
          <span className="font-medium text-neutral-950">Terms note:</span>{" "}
          {profile.paymentTermsRecommendation}
        </p>
      </div>
    </section>
  );
}

function ScenarioFieldCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-black/10 bg-white/70 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">
        {title}
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function FieldInput({
  label,
  value,
  type = "text",
  onChange,
}: {
  label: string;
  value: string;
  type?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">
        {label}
      </label>
      <Input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 rounded-2xl border-black/10 bg-[#fbf8f1]"
      />
    </div>
  );
}

function DashboardLoadingState() {
  return (
    <div className="space-y-6">
      <div className="h-32 animate-pulse rounded-3xl bg-white/70" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className="h-36 animate-pulse rounded-2xl bg-white/70"
          />
        ))}
      </div>
      <div className="h-96 animate-pulse rounded-2xl bg-white/70" />
    </div>
  );
}

function DashboardErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="max-w-md rounded-3xl border border-black/10 bg-white/75 p-8 text-center">
        <AlertTriangle className="mx-auto size-8 text-neutral-950" />
        <h1 className="mt-4 text-2xl font-semibold text-neutral-950">
          Collections plan could not load
        </h1>
        <p className="mt-3 text-sm leading-6 text-neutral-600">
          The import data or ranking rules failed to load. No messages have been
          generated or sent.
        </p>
        <Button
          onClick={onRetry}
          className="mt-5 rounded-full bg-neutral-950 px-5 text-white"
        >
          Try again
        </Button>
      </div>
    </div>
  );
}

function DashboardEmptyState() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="max-w-lg rounded-3xl border border-black/10 bg-white/75 p-8 text-center">
        <FileText className="mx-auto size-9 text-neutral-950" />
        <h1 className="mt-4 text-2xl font-semibold text-neutral-950">
          Import invoices to build a collections plan
        </h1>
        <p className="mt-3 text-sm leading-6 text-neutral-600">
          Zentra needs an overdue invoice export before it can rank actions,
          explain reasons, and prepare safe draft messages.
        </p>
        <Button asChild className="mt-5 rounded-full bg-neutral-950 px-5 text-white">
          <Link href="/import">Import invoices</Link>
        </Button>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-neutral-400">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium text-neutral-950">{value}</p>
      {detail ? <p className="mt-1 text-xs text-neutral-500">{detail}</p> : null}
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-neutral-400">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium text-neutral-950">{value}</p>
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
        : "border-black/10 bg-neutral-100 text-neutral-700";

  return (
    <Badge variant="outline" className={`rounded-full ${tone}`}>
      {label}
    </Badge>
  );
}

function SafetyBadge({ value }: { value: string }) {
  const tone =
    value === "blocked"
      ? "border-red-200 bg-red-50 text-red-700"
      : value === "needs_review"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-emerald-200 bg-emerald-50 text-emerald-700";

  return (
    <Badge variant="outline" className={`rounded-full ${tone}`}>
      {humanLabel(value)}
    </Badge>
  );
}

function buildSummary(invoices: Invoice[], plan: CollectionsPlanItem[]) {
  const activePlan = plan.filter((item) => item.dashboardGroup !== "do_not_chase");
  const cashNeedingAttention = activePlan.reduce(
    (total, item) => total + item.amountOutstanding,
    0,
  );
  const exceptions = plan.filter(
    (item) => item.dashboardGroup === "exceptions_to_resolve",
  );
  const promises = plan.filter(
    (item) => item.dashboardGroup === "promises_to_check",
  );
  const likelyThisWeek = invoices
    .filter(
      (invoice) =>
        invoice.status === "promised" &&
        invoice.promisedPaymentDate &&
        invoice.promisedPaymentDate <= "2026-05-14",
    )
    .reduce((total, invoice) => total + invoice.amountOutstanding, 0);

  return [
    {
      label: "Cash needing attention",
      value: formatCurrency(cashNeedingAttention),
      detail: `${activePlan.length} ranked actions`,
      icon: Clipboard,
    },
    {
      label: "Actions today",
      value: String(activePlan.length),
      detail: `${plan.filter((item) => item.dashboardGroup === "chase_now").length} ready to review`,
      icon: MailPlus,
    },
    {
      label: "Exceptions",
      value: String(exceptions.length),
      detail: "Blocked or needs review",
      icon: AlertTriangle,
    },
    {
      label: "Promises",
      value: String(promises.length),
      detail: "Payment dates to check",
      icon: CalendarCheck,
    },
    {
      label: "Likely this week",
      value: formatCurrency(likelyThisWeek),
      detail: "Based on open promises",
      icon: CheckCircle2,
    },
  ];
}

function buildDraftMessage(item: CollectionsPlanItem, invoice: Invoice) {
  const greeting = "Hi,";
  const amount = formatCurrency(invoice.amountOutstanding);
  const dueDate = invoice.dueDate ? formatDate(invoice.dueDate) : "the due date";

  if (item.safetyStatus === "blocked" && item.scenario !== "DISPUTE_RESPONSE") {
    return [
      "Draft unavailable until the blocking issue is reviewed.",
      "",
      `Reason: ${item.reason}`,
    ].join("\n");
  }

  const bodies: Record<CollectionScenario, string> = {
    PAYMENT_REMINDER: `${greeting}\n\nI hope you are well. I am checking in on invoice ${invoice.invoiceNumber} for ${amount}, which was due on ${dueDate}.\n\nCould you let me know when payment is expected, or whether there is anything you need from us to process it?\n\nThanks,\nAlex`,
    PROMISE_TO_PAY_FOLLOW_UP: `${greeting}\n\nI am following up on invoice ${invoice.invoiceNumber}. We had a payment date noted for ${invoice.promisedPaymentDate ? formatDate(invoice.promisedPaymentDate) : "earlier this week"}, but the balance of ${amount} is still showing as outstanding.\n\nCould you confirm whether payment has been made, or share an updated payment date?\n\nThanks,\nAlex`,
    REQUEST_REMITTANCE: `${greeting}\n\nThanks for the update on invoice ${invoice.invoiceNumber}. The balance of ${amount} is still showing as outstanding on our side.\n\nCould you send remittance advice or payment details so we can match this correctly?\n\nThanks,\nAlex`,
    DISPUTE_RESPONSE: `${greeting}\n\nThanks for raising the query on invoice ${invoice.invoiceNumber}. We have noted the issue and will review it before sending any further payment reminders.\n\nCould you share any details that would help us resolve the query quickly?\n\nThanks,\nAlex`,
    STATEMENT_OF_ACCOUNT: `${greeting}\n\nI am sending a quick statement check for your account. We have invoice ${invoice.invoiceNumber} showing with ${amount} outstanding.\n\nCould you confirm which open items are approved for payment and whether you need a statement of account from us?\n\nThanks,\nAlex`,
    CONFIRM_INVOICE_RECEIVED: `${greeting}\n\nI wanted to confirm that invoice ${invoice.invoiceNumber} for ${amount} has reached the right team.\n\nCould you let me know if it has been received and is scheduled for payment?\n\nThanks,\nAlex`,
    ASK_FOR_AP_CONTACT: `${greeting}\n\nWe are trying to confirm the right accounts payable contact for invoice ${invoice.invoiceNumber}.\n\nCould you point us to the best email address or person to speak to about payment processing?\n\nThanks,\nAlex`,
    DO_NOT_CHASE: "No message should be drafted for this item.",
    WAIT: "No message recommended right now. Zentra suggests waiting before sending another follow-up.",
    INTERNAL_REVIEW: `Internal review needed before drafting.\n\nReason: ${item.reason}`,
  };

  return bodies[item.scenario];
}

function defaultSubject(item: CollectionsPlanItem, invoice: Invoice) {
  if (item.scenario === "DISPUTE_RESPONSE") {
    return `Invoice ${invoice.invoiceNumber} - query to resolve`;
  }
  if (item.scenario === "REQUEST_REMITTANCE") {
    return `Remittance advice request: invoice ${invoice.invoiceNumber}`;
  }
  if (item.scenario === "PROMISE_TO_PAY_FOLLOW_UP") {
    return `Payment promise follow-up: invoice ${invoice.invoiceNumber}`;
  }
  if (item.scenario === "STATEMENT_OF_ACCOUNT") {
    return `Statement of account request`;
  }
  if (item.scenario === "ASK_FOR_AP_CONTACT") {
    return `Accounts payable contact request`;
  }
  return `Payment reminder: invoice ${invoice.invoiceNumber}`;
}

function defaultSubjectForAction(
  scenario: ActionScenario,
  item: CollectionsPlanItem,
  invoice: Invoice,
) {
  const subjects: Record<ActionScenario, string> = {
    SEND_PAYMENT_REMINDER: `Payment reminder: invoice ${invoice.invoiceNumber}`,
    ASK_FOR_PAYMENT_DATE: `Payment date request: invoice ${invoice.invoiceNumber}`,
    REQUEST_REMITTANCE: `Remittance advice request: invoice ${invoice.invoiceNumber}`,
    STATEMENT_OF_ACCOUNT: `Statement of account request`,
    CONFIRM_INVOICE_RECEIVED: `Invoice receipt check: ${invoice.invoiceNumber}`,
    ASK_FOR_AP_CONTACT: `Accounts payable contact request`,
    PROMISE_FOLLOW_UP: `Payment promise follow-up: invoice ${invoice.invoiceNumber}`,
    RESOLVE_DISPUTE: `Invoice ${invoice.invoiceNumber} - query to resolve`,
    INTERNAL_ESCALATION: `Internal escalation: ${invoice.customerName}`,
    THANK_YOU_AFTER_PAYMENT: `Thank you - invoice ${invoice.invoiceNumber}`,
  };

  return subjects[scenario] ?? defaultSubject(item, invoice);
}

function emptyScenarioDetails(): ScenarioDetails {
  return {
    promisedDate: "",
    promisedAmount: "",
    promisedBy: "",
    paymentClaimDate: "",
    paymentReference: "",
    amountClaimedPaid: "",
    disputeReason: "",
    disputeOwner: "",
    nextResolutionDate: "",
    disputeNotes: "",
    includeMultipleInvoices: true,
    totalOutstanding: "",
    statementSummary: "",
    currentContact: "",
    requestedContactRole: "Accounts payable",
    internalOwner: "",
    escalationNote: "",
  };
}

function scenarioDetailsForInvoice(
  invoice: Invoice,
  allInvoices: Invoice[],
): ScenarioDetails {
  const customerInvoices = allInvoices.filter(
    (item) => item.customerId === invoice.customerId && item.amountOutstanding > 0,
  );
  const totalOutstanding = customerInvoices.reduce(
    (sum, item) => sum + item.amountOutstanding,
    0,
  );

  return {
    ...emptyScenarioDetails(),
    promisedDate: invoice.promisedPaymentDate ?? invoice.promiseToPay?.promisedDate ?? "",
    promisedAmount: String(invoice.promiseToPay?.promisedAmount ?? invoice.amountOutstanding),
    promisedBy: invoice.promiseToPay?.recordedBy ?? "",
    paymentClaimDate: invoice.lastChasedDate ?? "",
    paymentReference: "",
    amountClaimedPaid: String(invoice.amountOutstanding),
    disputeReason: invoice.disputeReason ?? invoice.dispute?.reason ?? "",
    disputeOwner: invoice.dispute?.owner ?? "",
    nextResolutionDate: "",
    disputeNotes: invoice.customerNotes ?? "",
    totalOutstanding: String(totalOutstanding),
    statementSummary: `${customerInvoices.length} open invoice${customerInvoices.length === 1 ? "" : "s"} totalling ${formatCurrency(totalOutstanding)}.`,
    currentContact: invoice.customerEmail ?? "",
    requestedContactRole: invoice.customerContactRole ?? "Accounts payable",
    internalOwner: "Account manager",
    escalationNote: `Review ${invoice.customerName} before the next customer follow-up.`,
  };
}

function actionScenarioForPlan(item: CollectionsPlanItem): ActionScenario {
  const scenarios: Partial<Record<CollectionScenario, ActionScenario>> = {
    PAYMENT_REMINDER: "SEND_PAYMENT_REMINDER",
    PROMISE_TO_PAY_FOLLOW_UP: "PROMISE_FOLLOW_UP",
    REQUEST_REMITTANCE: "REQUEST_REMITTANCE",
    DISPUTE_RESPONSE: "RESOLVE_DISPUTE",
    STATEMENT_OF_ACCOUNT: "STATEMENT_OF_ACCOUNT",
    CONFIRM_INVOICE_RECEIVED: "CONFIRM_INVOICE_RECEIVED",
    ASK_FOR_AP_CONTACT: "ASK_FOR_AP_CONTACT",
    INTERNAL_REVIEW: "INTERNAL_ESCALATION",
  };

  return scenarios[item.scenario] ?? "SEND_PAYMENT_REMINDER";
}

function actionScenarioMeta(
  scenario: ActionScenario,
  invoice: Invoice,
  allInvoices: Invoice[],
  details: ScenarioDetails,
) {
  const customerInvoices = allInvoices.filter(
    (item) => item.customerId === invoice.customerId && item.amountOutstanding > 0,
  );
  const totalOutstanding = customerInvoices.reduce(
    (sum, item) => sum + item.amountOutstanding,
    0,
  );
  const meta: Record<ActionScenario, {
    recommendedAction: string;
    explanation: string;
    safetyChecks: string[];
    safetyStatus: "safe_to_draft" | "needs_review" | "blocked";
    confidence: "high" | "medium" | "low";
    nextStep: string;
  }> = {
    SEND_PAYMENT_REMINDER: {
      recommendedAction: "Send payment reminder",
      explanation: `${invoice.invoiceNumber} has ${formatCurrency(invoice.amountOutstanding)} outstanding and is ${invoice.daysOverdue} days overdue.`,
      safetyChecks: baseSafety(invoice, details),
      safetyStatus: invoice.disputeReason ? "blocked" : "safe_to_draft",
      confidence: invoice.disputeReason ? "low" : "high",
      nextStep: "Review the draft, then copy it into your email client.",
    },
    ASK_FOR_PAYMENT_DATE: {
      recommendedAction: "Ask for payment date",
      explanation: "The goal is not escalation; ask for a clear expected payment date.",
      safetyChecks: baseSafety(invoice, details),
      safetyStatus: "safe_to_draft",
      confidence: "high",
      nextStep: "Copy only after checking the balance is still outstanding.",
    },
    REQUEST_REMITTANCE: {
      recommendedAction: "Request remittance advice",
      explanation: `Customer may have paid, but ${formatCurrency(invoice.amountOutstanding)} is still unmatched.`,
      safetyChecks: ["Ask for remittance before sending another payment reminder.", ...baseSafety(invoice, details)],
      safetyStatus: "needs_review",
      confidence: "medium",
      nextStep: "Ask for remittance details and match the payment before chasing again.",
    },
    STATEMENT_OF_ACCOUNT: {
      recommendedAction: "Send/request statement of account",
      explanation: `${customerInvoices.length} open invoice${customerInvoices.length === 1 ? "" : "s"} total ${formatCurrency(totalOutstanding)} for this customer.`,
      safetyChecks: ["Check the statement includes only open customer invoices.", ...baseSafety(invoice, details)],
      safetyStatus: "needs_review",
      confidence: "medium",
      nextStep: "Review open items before copying the statement request.",
    },
    CONFIRM_INVOICE_RECEIVED: {
      recommendedAction: "Confirm invoice was received",
      explanation: "Use this when the invoice is early-stage, not seriously overdue, or the recipient is uncertain.",
      safetyChecks: baseSafety(invoice, details),
      safetyStatus: "safe_to_draft",
      confidence: "high",
      nextStep: "Confirm the right recipient before increasing tone.",
    },
    ASK_FOR_AP_CONTACT: {
      recommendedAction: "Ask for AP/accounts contact",
      explanation: "The current contact is missing or may not be the right person for payment queries.",
      safetyChecks: ["Do not send invoice-specific pressure until the right contact is confirmed."],
      safetyStatus: "needs_review",
      confidence: "medium",
      nextStep: "Find the right AP contact, then resume invoice-level follow-up.",
    },
    PROMISE_FOLLOW_UP: {
      recommendedAction: "Follow up promised payment",
      explanation: `A promised payment date${details.promisedDate ? ` of ${formatDate(details.promisedDate)}` : ""} needs checking.`,
      safetyChecks: ["Check bank receipts before saying the promise was missed.", ...baseSafety(invoice, details)],
      safetyStatus: "needs_review",
      confidence: "medium",
      nextStep: "Ask whether payment was made or request a revised payment date.",
    },
    RESOLVE_DISPUTE: {
      recommendedAction: "Resolve dispute",
      explanation: details.disputeReason || invoice.disputeReason || "This item should be resolved before normal chasing.",
      safetyChecks: ["Do not send a normal payment reminder while a dispute is open."],
      safetyStatus: "blocked",
      confidence: "high",
      nextStep: "Resolve the query before resuming payment reminders.",
    },
    INTERNAL_ESCALATION: {
      recommendedAction: "Escalate internally",
      explanation: "This is an internal note, not a customer chase.",
      safetyChecks: ["Keep this internal. Do not send it to the customer."],
      safetyStatus: "needs_review",
      confidence: "medium",
      nextStep: "Share internally with the account owner.",
    },
    THANK_YOU_AFTER_PAYMENT: {
      recommendedAction: "Send thank-you after payment",
      explanation: "Use only after confirming the payment has cleared.",
      safetyChecks: ["Confirm the invoice is paid before sending thanks."],
      safetyStatus: invoice.amountOutstanding > 0 ? "needs_review" : "safe_to_draft",
      confidence: invoice.amountOutstanding > 0 ? "medium" : "high",
      nextStep: "Send only after the payment is confirmed.",
    },
  };

  return meta[scenario];
}

function baseSafety(invoice: Invoice, details: ScenarioDetails) {
  const checks = ["Human review is required before sending."];
  if (!invoice.customerEmail && !details.currentContact) {
    checks.push("No customer email is present; confirm the correct contact first.");
  }
  if (invoice.disputeReason || details.disputeReason) {
    checks.push("A dispute is present; avoid normal payment reminder wording.");
  }
  return checks;
}

function buildActionDraftMessage(
  scenario: ActionScenario,
  item: CollectionsPlanItem,
  invoice: Invoice,
  allInvoices: Invoice[],
  details: ScenarioDetails,
) {
  const amount = formatCurrency(invoice.amountOutstanding);
  const dueDate = invoice.dueDate ? formatDate(invoice.dueDate) : "the due date";
  const customerInvoices = allInvoices.filter(
    (current) => current.customerId === invoice.customerId && current.amountOutstanding > 0,
  );
  const totalOutstanding = customerInvoices.reduce(
    (sum, current) => sum + current.amountOutstanding,
    0,
  );

  if (scenario === "ASK_FOR_PAYMENT_DATE") {
    return `Hi there,\n\nI am checking in on invoice ${invoice.invoiceNumber}, which is showing with ${amount} outstanding.\n\nCould you confirm the expected payment date so we can update our records?\n\nThanks,\nZentra Collect`;
  }
  if (scenario === "INTERNAL_ESCALATION") {
    return `Internal escalation\n\nCustomer: ${invoice.customerName}\nInvoice: ${invoice.invoiceNumber}\nOutstanding: ${amount}\nOwner: ${details.internalOwner || "Account manager"}\n\n${details.escalationNote || item.reason}`;
  }
  if (scenario === "THANK_YOU_AFTER_PAYMENT") {
    return `Hi there,\n\nThank you for arranging payment for invoice ${invoice.invoiceNumber}. We appreciate your help getting this sorted.\n\nThanks,\nZentra Collect`;
  }
  if (scenario === "STATEMENT_OF_ACCOUNT") {
    return `Hi there,\n\nI am checking the open items on your account. We currently have ${customerInvoices.length} open invoice${customerInvoices.length === 1 ? "" : "s"} totalling ${formatCurrency(totalOutstanding)}.\n\nCould you confirm which items are approved for payment, or whether you need a statement of account from us?\n\nThanks,\nZentra Collect`;
  }
  if (scenario === "REQUEST_REMITTANCE") {
    return `Hi there,\n\nThanks for the update on invoice ${invoice.invoiceNumber}. The balance of ${amount} is still showing as outstanding on our side.\n\nCould you send remittance advice${details.paymentReference ? ` for reference ${details.paymentReference}` : ""} so we can match this correctly?\n\nThanks,\nZentra Collect`;
  }
  if (scenario === "PROMISE_FOLLOW_UP") {
    return `Hi there,\n\nI am following up on invoice ${invoice.invoiceNumber}. We had a payment date noted${details.promisedDate ? ` for ${formatDate(details.promisedDate)}` : ""}, but ${amount} is still showing as outstanding.\n\nCould you confirm whether payment has been made, or share an updated payment date?\n\nThanks,\nZentra Collect`;
  }
  if (scenario === "RESOLVE_DISPUTE") {
    return `Hi there,\n\nThanks for raising the query on invoice ${invoice.invoiceNumber}. We have noted the issue and will review it before sending any further payment reminders.\n\nCould you share any details that would help ${details.disputeOwner || "the team"} resolve this by ${details.nextResolutionDate ? formatDate(details.nextResolutionDate) : "the next update"}?\n\nThanks,\nZentra Collect`;
  }
  if (scenario === "ASK_FOR_AP_CONTACT") {
    return `Hi there,\n\nWe are trying to confirm the best ${details.requestedContactRole || "accounts payable"} contact for invoice ${invoice.invoiceNumber}.\n\nCould you point us to the right person or email address for payment queries?\n\nThanks,\nZentra Collect`;
  }
  if (scenario === "CONFIRM_INVOICE_RECEIVED") {
    return `Hi there,\n\nI wanted to confirm that invoice ${invoice.invoiceNumber} for ${amount}, due on ${dueDate}, has reached the right team.\n\nCould you let me know whether it has been received and is scheduled for payment?\n\nThanks,\nZentra Collect`;
  }

  return buildDraftMessage(item, invoice);
}

function draftScenarioForAction(scenario: ActionScenario): DraftScenario | null {
  const scenarios: Record<ActionScenario, DraftScenario | null> = {
    SEND_PAYMENT_REMINDER: "PAYMENT_REMINDER",
    ASK_FOR_PAYMENT_DATE: "ASK_FOR_PAYMENT_DATE",
    REQUEST_REMITTANCE: "REQUEST_REMITTANCE",
    STATEMENT_OF_ACCOUNT: "STATEMENT_OF_ACCOUNT",
    CONFIRM_INVOICE_RECEIVED: "CONFIRM_INVOICE_RECEIVED",
    ASK_FOR_AP_CONTACT: "ASK_FOR_AP_CONTACT",
    PROMISE_FOLLOW_UP: "PROMISE_TO_PAY_FOLLOW_UP",
    RESOLVE_DISPUTE: "DISPUTE_RESPONSE",
    INTERNAL_ESCALATION: "INTERNAL_ESCALATION",
    THANK_YOU_AFTER_PAYMENT: "THANK_YOU_AFTER_PAYMENT",
  };

  return scenarios[scenario];
}

function recommendedToneFor(item: CollectionsPlanItem): DraftTone {
  if (item.scenario === "DISPUTE_RESPONSE") return "neutral";
  if (item.scenario === "REQUEST_REMITTANCE") return "neutral";
  if (item.scenario === "PROMISE_TO_PAY_FOLLOW_UP") return "firm";
  if (item.urgencyLevel === "critical") return "final";
  if (item.urgencyLevel === "high") return "firm";
  if (item.urgencyLevel === "medium") return "neutral";
  return "friendly";
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

function humanLabel(value: string) {
  return value
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

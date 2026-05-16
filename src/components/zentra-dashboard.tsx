"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CalendarCheck,
  CheckCircle2,
  ChevronRight,
  Clipboard,
  Copy,
  FileText,
  Flag,
  Loader2,
  MailPlus,
  ShieldCheck,
  SlidersHorizontal,
  TrendingUp,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { recordToneOutcome, type ToneOutcome } from "@/lib/collections/tone-learning";
import type { ReminderTone } from "@/types/cashpilot";
import type { Invoice as ZentraInvoice } from "@/types/zentra";
import { Button } from "@/components/ui/button";
import { DSOCard } from "@/components/dso-card";
import {
  LockedFeatureCard,
  UpgradePromptModal,
} from "@/components/billing-gates";
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
  buildInvoiceMessageSafetyResult,
  type UnifiedSafetyCheck,
  type UnifiedSafetyResult,
} from "@/lib/collections/safety";
import {
  canUseFeature,
} from "@/lib/billing/plans";
import { useLocalAccount } from "@/lib/billing/use-local-account";
import { requirePlanAccess, toAccountState } from "@/lib/account/access";
import { incrementAIUsage } from "@/lib/account/usage";
import {
  incrementUsage,
  readLocalAccount,
} from "@/lib/demo-auth";
import {
  demoCustomerBehaviourProfiles,
  demoCustomers,
  demoInvoices,
} from "@/lib/demo-data/zentra-demo-data";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { LogOutcomeButton }      from "@/components/log-outcome-button";
import { PaymentLinkButton }    from "@/components/payment-link-button";
import { WhatsAppSendButton }   from "@/components/whatsapp-send-button";
import { EmailSendButton }      from "@/components/email-send-button";
import {
  importedInvoicesStorageKey,
  importDiffStorageKey,
  importSummaryStorageKey,
  type ImportDiffOutput,
  type ImportSummary,
} from "@/lib/import/zentra-import";
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
import {
  readWorkspacePrefs,
  setWidget,
  type WorkspacePrefs,
} from "@/lib/prefs";

const referenceDate = "2026-05-07";
const demoInvoiceStateStorageKey = "zentra.demoInvoiceState.v1";

const visibleGroups: Array<{
  id: CollectionsDashboardGroup;
  title: string;
  description: string;
}> = [
  {
    id: "chase_now",
    title: "Chase now",
    description: "Overdue invoices that are safe to chase — send a reminder or make contact today.",
  },
  {
    id: "promises_to_check",
    title: "Promises to check",
    description: "Customers who said they'd pay — check whether they did and follow up if not.",
  },
  {
    id: "exceptions_to_resolve",
    title: "Exceptions to resolve",
    description: "Disputed, blocked, or incomplete invoices that need attention before chasing.",
  },
  {
    id: "wait_low_priority",
    title: "Not yet due / waiting",
    description: "Invoices chased recently, not yet due, or low priority — nothing to do right now.",
  },
];

type PlanViewFilter = "focus" | CollectionsDashboardGroup;

const planViewFilters: Array<{
  id: PlanViewFilter;
  label: string;
  description: string;
}> = [
  {
    id: "focus",
    label: "Focus",
    description: "Chase now, promises & exceptions",
  },
  {
    id: "chase_now",
    label: "Chase now",
    description: "Safe to act today",
  },
  {
    id: "promises_to_check",
    label: "Promises",
    description: "Customers who said they'd pay",
  },
  {
    id: "exceptions_to_resolve",
    label: "Exceptions",
    description: "Disputes & blocked invoices",
  },
  {
    id: "wait_low_priority",
    label: "Not due yet",
    description: "Nothing to do right now",
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
  if (typeof window === "undefined") return [];

  const localAccount = readLocalAccount();
  const isDemo = localAccount?.planId === "demo";
  const storageKey = isDemo ? demoInvoiceStateStorageKey : importedInvoicesStorageKey;
  const storedInvoices = window.localStorage.getItem(storageKey);
  if (!storedInvoices) return isDemo ? demoInvoices : [];

  try {
    const parsedInvoices = JSON.parse(storedInvoices) as Invoice[];
    return Array.isArray(parsedInvoices) && parsedInvoices.length
      ? parsedInvoices
      : isDemo ? demoInvoices : [];
  } catch {
    window.localStorage.removeItem(storageKey);
    return isDemo ? demoInvoices : [];
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

function persistInvoices(nextInvoices: Invoice[]) {
  if (typeof window === "undefined") return;
  const localAccount = readLocalAccount();
  const storageKey =
    localAccount?.planId === "demo"
      ? demoInvoiceStateStorageKey
      : importedInvoicesStorageKey;
  window.localStorage.setItem(storageKey, JSON.stringify(nextInvoices));
}

type ZentraDashboardProps = {
  initialInvoices?: Invoice[];
  demoMode?: boolean;
};

export function ZentraDashboard({ initialInvoices, demoMode: _demoMode }: ZentraDashboardProps = {}) {
  const { account } = useLocalAccount();
  const [upgradePrompt, setUpgradePrompt] = useState<{
    title: string;
    description: string;
  } | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>(() => {
    // Demo accounts always use localStorage (demoInvoices fallback) so a
    // signed-in user who clicks "Try demo" sees sample data, not their real DB.
    const acct = readLocalAccount();
    if (acct?.planId === "demo") return readImportedInvoices();
    return initialInvoices?.length ? initialInvoices : readImportedInvoices();
  });
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [planViewFilter, setPlanViewFilter] =
    useState<PlanViewFilter>("focus");
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
  const [importSummary] = useState<ImportSummary | null>(readImportSummary);
  const [importDiff] = useState<ImportDiffOutput | null>(readImportDiff);
  const [loadState, setLoadState] = useState<"ready" | "loading" | "error">(
    "ready",
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [hideSidebar, setHideSidebar] = useState(false);
  const [prefs, setPrefs] = useState<WorkspacePrefs>(() => readWorkspacePrefs());
  const [showCustomizer, setShowCustomizer] = useState(false);
  const customizerRef = useRef<HTMLDivElement>(null);

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
    () => {
      const basePlan = rankCollectionActions({
        invoices,
        customers,
        customerBehaviourProfiles: behaviourProfiles,
        referenceDate,
      });
      if (!searchQuery.trim()) return basePlan;
      const lowerQuery = searchQuery.toLowerCase();
      return basePlan.filter(item => 
        item.customerName.toLowerCase().includes(lowerQuery) || 
        (item.invoiceNumber && item.invoiceNumber.toLowerCase().includes(lowerQuery))
      );
    },
    [behaviourProfiles, customers, invoices, searchQuery],
  );
  const groups = useMemo(() => groupActionsByCategory(plan), [plan]);
  const filteredVisibleGroups = useMemo(() => {
    if (planViewFilter === "focus") {
      return visibleGroups.filter((group) => group.id !== "wait_low_priority");
    }
    return visibleGroups.filter((group) => group.id === planViewFilter);
  }, [planViewFilter]);
  const selectedPlan = plan.find((item) => item.id === selectedPlanId) ?? null;
  const selectedInvoice = selectedPlan
    ? invoices.find((invoice) => invoice.id === selectedPlan.invoiceId) ?? null
    : null;
  const selectedCustomer = selectedInvoice
    ? customers.find((customer) => customer.id === selectedInvoice.customerId) ??
      null
    : null;

  const summary = useMemo(() => buildSummary(invoices, plan), [invoices, plan]);

  // Close customizer on outside click + sync prefs from custom event
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (customizerRef.current && !customizerRef.current.contains(e.target as Node)) {
        setShowCustomizer(false);
      }
    }
    function onPrefs(e: Event) {
      setPrefs((e as CustomEvent<WorkspacePrefs>).detail);
    }
    document.addEventListener("mousedown", handleClick);
    window.addEventListener("zentra:workspaceprefs", onPrefs);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      window.removeEventListener("zentra:workspaceprefs", onPrefs);
    };
  }, []);

  function toggleWidget<K extends keyof WorkspacePrefs["widgets"]>(key: K) {
    const next = setWidget(key, !prefs.widgets[key]);
    setPrefs(next);
  }

  // Reflow: only render the right column when we have something to show there
  const hasRightColumn =
    prefs.widgets.riskInsights ||
    prefs.widgets.weeklyBrief ||
    account?.planId === "demo";

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
      invoice
        ? formatSafetyRiskNotes(
            buildDrawerSafetyResult(item, invoice, undefined, []),
          )
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
  }

  function updateInvoiceStatus(status: CollectionStatus, title: string) {
    if (!selectedInvoice) return;

    setInvoices((current) => {
      const next = current.map((invoice) =>
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
      );
      persistInvoices(next);
      return next;
    });
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

    setInvoices((current) => {
      const next = current.map((invoice) =>
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
      );
      persistInvoices(next);
      return next;
    });

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
    const access = requirePlanAccess(account, "reply_classification");
    if (!access.allowed) {
      setUpgradePrompt({
        title: "Reply classification is not available.",
        description:
          access.reason ?? "Upgrade or wait for your usage to reset before using AI actions.",
      });
      setReplyClassification({
        classification: "unclear",
        confidence: "low",
        reason:
          access.reason ?? "Upgrade or wait for your usage to reset before using AI actions.",
        suggestedStatusUpdate: "Manual review",
        suggestedNextAction: "Upgrade or continue manually.",
        requiresManualReview: true,
        source: "manual_review",
      });
      return;
    }
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
      if (account) incrementAIUsage(toAccountState(account), "classify_reply");
      incrementUsage("aiActionsThisMonth");
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
    await navigator.clipboard.writeText(
      [`Subject: ${subject}`, "", draft].join("\n"),
    );
    setCopied(true);
    updateInvoiceStatus("overdue", "Draft copied for review");
  }

  async function generateDraft() {
    if (!selectedPlan || !selectedInvoice) return;
    const access = requirePlanAccess(account, "ai_draft_generation");
    if (!access.allowed) {
      setUpgradePrompt({
        title: "Draft generation is not available.",
        description:
          access.reason ?? "Upgrade or wait for your usage to reset before using AI actions.",
      });
      setDraftRiskNotes(
        access.reason ?? "Upgrade or wait for your usage to reset before using AI actions.",
      );
      setDraftNextStep("Upgrade or continue with the current template manually.");
      setDraftConfidence("low");
      return;
    }
    setIsGenerating(true);
    const actionMeta = actionScenarioMeta(
      actionScenario,
      selectedInvoice,
      invoices,
      scenarioDetails,
      selectedTone,
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
      setDraftRiskNotes(formatSafetyRiskNotes(actionMeta.safetyResult));
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
      if (account) incrementAIUsage(toAccountState(account), "draft_generation");
      incrementUsage("aiActionsThisMonth");
      setTimeout(() => {
        document.getElementById("draft-section")?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
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

  // Hide all collections content entirely when the Collections module is off.
  if (!prefs.modules.collections) {
    return null;
  }

  if (!invoices.length) {
    return <DashboardEmptyState />;
  }

  return (
    <div className="flex flex-col gap-6">
      <UpgradePromptModal
        open={Boolean(upgradePrompt)}
        title={upgradePrompt?.title ?? ""}
        description={upgradePrompt?.description ?? ""}
        onClose={() => setUpgradePrompt(null)}
      />

      {/* Onboarding hero — moved to right sidebar column for demo users */}
      {false ? (
        <section
          className="zn-card overflow-hidden p-0 flex flex-col md:flex-row"
          style={{ background: "var(--zn-ink)", borderColor: "var(--zn-ink)" }}
        >
          <div className="flex-1 p-6 md:p-7" style={{ color: "var(--zn-surface)" }}>
            <div
              className="zn-label !p-0 mb-2"
              style={{ color: "rgba(250,245,232,0.55)" }}
            >
              Welcome to Zentra Collect
            </div>
            <h2
              className="text-[22px] md:text-[26px] leading-[1.15] mb-3"
              style={{ fontFamily: "var(--font-newsreader), ui-serif, Georgia, serif", fontWeight: 500 }}
            >
              Upload overdue invoices. Get a ranked chase plan in minutes.
            </h2>
            <p className="text-[13.5px] leading-relaxed" style={{ color: "rgba(250,245,232,0.7)" }}>
              You&apos;re looking at sample data. Every recommendation shows{" "}
              <span style={{ color: "var(--zn-surface)" }}>action + reason + draft message</span>{" "}
              — and nothing goes out without you reviewing it first.
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-5">
              <Link
                href="/chase-today"
                className="zn-pill"
                style={{ background: "var(--zn-accent)", color: "var(--zn-accent-ink)" }}
              >
                Try the demo data <ArrowRight className="size-3.5" />
              </Link>
              <Link
                href="/import"
                className="zn-pill"
                style={{
                  background: "transparent",
                  color: "var(--zn-surface)",
                  border: "1px solid rgba(250,245,232,0.25)",
                }}
              >
                Import your own CSV
              </Link>
            </div>
          </div>
          <div
            className="hidden md:flex items-end justify-end px-7 pb-6 pt-8 flex-shrink-0"
            style={{
              width: 220,
              background: "linear-gradient(180deg, rgba(184,72,31,0.08) 0%, rgba(184,72,31,0.18) 100%)",
              borderLeft: "1px solid rgba(250,245,232,0.08)",
            }}
          >
            <span
              className="text-[64px] leading-none italic"
              style={{
                fontFamily: "var(--font-newsreader), ui-serif, Georgia, serif",
                color: "var(--zn-accent)",
                opacity: 0.85,
              }}
            >
              Z
            </span>
          </div>
        </section>
      ) : null}

      {/* Greeting + customise moved to <DashboardGreeting /> (always shown, even when collections is off) */}

      {importSummary ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-900 sm:flex-row sm:items-center sm:justify-between">
          <span>
            We found {formatCurrency(importSummary.cashNeedingAttention)} needing
            attention, {importSummary.actionsRecommended} actions recommended,{" "}
            {importSummary.exceptions} exceptions.
          </span>
          <Button asChild variant="outline" className="rounded-full border-emerald-300 bg-[#faf5e8] dark:bg-[#211d17]">
            <Link href="/import/summary">View import summary</Link>
          </Button>
        </div>
      ) : null}

      {importDiff && account && canUseFeature(account.planId, "reimportComparison") ? (
        <ImportDiffDashboard diff={importDiff} />
      ) : importDiff ? (
        <LockedFeatureCard
          title="Re-import comparison is locked on this plan."
          description="Upgrade to compare this file with the previous import and see what changed."
          feature="reimportComparison"
        />
      ) : null}

      {/* 6-stat row — 5 collections stats + DSO */}
      <section className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-6">
        {summary.map((item, index) => (
          <div key={item.label} className="zn-stat">
            <div className="flex items-center justify-between mb-2.5">
              <span className="zn-label">{item.label}</span>
              <item.icon className="size-3.5" style={{ color: "var(--zn-ink-3)" }} />
            </div>
            <div
              className="zn-stat-num"
              style={{ color: index === 0 ? "var(--zn-accent)" : "var(--zn-ink)" }}
            >
              {item.value}
            </div>
            <p className="text-[12px] mt-1" style={{ color: "var(--zn-ink-3)" }}>
              {item.detail}
            </p>
          </div>
        ))}
        <DSOCard />
      </section>

      {/* Body: reflows to single column when right column is empty */}
      <section className={hasRightColumn
        ? "grid gap-[18px] lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]"
        : "grid gap-[18px]"
      }>

        {/* LEFT */}
        <div className="flex flex-col gap-5">

          {/* Today's focus — Top 5 actions */}
          <div className="zn-card p-[22px]">
            <div className="flex flex-wrap items-end justify-between gap-3 mb-3.5">
              <div>
                <div className="zn-label !p-0 mb-1">Today&apos;s focus</div>
                <h2 className="text-[18px] font-semibold text-[#1d1813] dark:text-[#f0e8d5]">
                  Top 5 actions Zentra recommends
                </h2>
                <p className="text-[12.5px] text-[#6b6253] dark:text-[#8a7d69] mt-1">
                  Sorted by impact, confidence, and urgency. You decide if and when to send.
                </p>
              </div>
              <Link
                href="/chase-today"
                className="zn-pill zn-pill-ghost"
                style={{ height: 26, fontSize: 12, padding: "0 11px" }}
              >
                View full queue <ChevronRight className="size-3" />
              </Link>
            </div>
            <div className="flex flex-col" style={{ borderTop: "1px solid var(--zn-line-soft)" }}>
              {plan
                .filter((item) => item.dashboardGroup !== "do_not_chase")
                .slice(0, 5)
                .map((item, idx, arr) => {
                  const inv = invoices.find((i) => i.id === item.invoiceId);
                  const isOverdue = (inv?.daysOverdue ?? 0) > 0;
                  return (
                    <div
                      key={item.id}
                      style={{
                        borderBottom:
                          idx === arr.length - 1 ? "none" : "1px solid var(--zn-line-soft)",
                      }}
                    >
                      {/* ── Mobile card (below md) ──────────────────────────── */}
                      <div className="flex flex-col gap-2.5 py-3.5 md:hidden">
                        {/* Row 1: client name + amount */}
                        <div className="flex items-start justify-between gap-3">
                          <span className="text-[14px] font-semibold text-[#1d1813] dark:text-[#f0e8d5] leading-tight flex-1 min-w-0 truncate">
                            {item.customerName}
                          </span>
                          <span
                            className="text-[13px] font-semibold flex-shrink-0 whitespace-nowrap"
                            style={{ fontVariantNumeric: "tabular-nums", color: "var(--zn-ink)" }}
                          >
                            {formatCurrency(item.amountOutstanding)}
                          </span>
                        </div>
                        {/* Row 2: invoice tag + overdue badge / due date + chase button */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 flex-1 min-w-0 flex-wrap">
                            {item.invoiceNumber ? (
                              <span className="zn-kind-tag" style={{ fontSize: 10 }}>
                                {item.invoiceNumber}
                              </span>
                            ) : null}
                            {isOverdue ? (
                              <span
                                className="inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-medium leading-none"
                                style={{ background: "var(--zn-risk-soft)", color: "var(--zn-risk)" }}
                              >
                                {inv!.daysOverdue}d overdue
                              </span>
                            ) : inv?.dueDate ? (
                              <span className="text-[11px]" style={{ color: "var(--zn-ink-3)" }}>
                                Due {formatDate(inv.dueDate)}
                              </span>
                            ) : null}
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <LogOutcomeButton
                              invoiceRef={item.invoiceNumber ?? item.id}
                              clientName={item.customerName}
                              amountOutstanding={item.amountOutstanding}
                            />
                            <Link
                              href={`/chase-today?customer=${encodeURIComponent(item.customerName)}`}
                              className="zn-pill flex-shrink-0"
                              style={{ height: 26, fontSize: 12, padding: "0 11px" }}
                            >
                              {isOverdue ? "Chase" : "Review"}
                            </Link>
                          </div>
                        </div>
                      </div>

                      {/* ── Desktop row (md and above) — unchanged ──────────── */}
                      <div className="hidden md:flex items-center gap-4 py-3.5">
                        <div
                          className="w-[36px] flex flex-col items-center flex-shrink-0"
                        >
                          <div
                            className="text-[18px] italic leading-none"
                            style={{
                              fontFamily: "var(--font-newsreader), ui-serif, Georgia, serif",
                              color: "var(--zn-ink-3)",
                            }}
                          >
                            {idx + 1}
                          </div>
                          <div
                            className="text-[9px] tabular-nums mt-1"
                            title={`Priority score: ${Math.round(item.priorityScore)} / 100`}
                            style={{
                              color: "var(--zn-accent)",
                              fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
                              letterSpacing: "0.04em",
                            }}
                          >
                            {Math.round(item.priorityScore)}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="text-[14px] font-semibold text-[#1d1813] dark:text-[#f0e8d5] truncate">
                              {item.customerName}
                            </div>
                            {item.invoiceNumber ? (
                              <span className="zn-kind-tag" style={{ fontSize: 10 }}>
                                {item.invoiceNumber}
                              </span>
                            ) : null}
                          </div>
                          <div className="text-[12.5px] text-[#6b6253] dark:text-[#8a7d69] mt-0.5 line-clamp-1" title={item.reason}>
                            {item.reason}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0 whitespace-nowrap">
                          <div className="text-[13px] font-semibold tabular-nums text-[#1d1813] dark:text-[#f0e8d5]">
                            {formatCurrency(item.amountOutstanding)}
                          </div>
                          {inv && inv.daysOverdue ? (
                            <div
                              className="text-[11px] tabular-nums"
                              style={{ color: "var(--zn-risk)" }}
                            >
                              {inv.daysOverdue}d overdue
                            </div>
                          ) : null}
                        </div>
                        <div
                          className="hidden xl:block w-[160px] text-[12.5px] truncate flex-shrink-0"
                          style={{ color: "var(--zn-ink-2)" }}
                        >
                          {humanAction(item.recommendedAction)}
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <LogOutcomeButton
                            invoiceRef={item.invoiceNumber ?? item.id}
                            clientName={item.customerName}
                            amountOutstanding={item.amountOutstanding}
                          />
                          <Link
                            href={`/chase-today?customer=${encodeURIComponent(item.customerName)}`}
                            className="zn-pill flex-shrink-0"
                            style={{ height: 26, fontSize: 12, padding: "0 11px" }}
                          >
                            Review
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })}
              {plan.filter((item) => item.dashboardGroup !== "do_not_chase").length === 0 ? (
                <div className="py-8 text-center text-[13px] text-[#6b6253] dark:text-[#8a7d69]">
                  Nothing flagged for action right now.
                </div>
              ) : null}
            </div>
          </div>

          {/* What changed since last import */}
          <div className="zn-card p-[22px]">
            <div className="mb-3.5">
              <div className="zn-label !p-0 mb-1">Since last import</div>
              <h2 className="text-[18px] font-semibold text-[#1d1813] dark:text-[#f0e8d5]">What changed</h2>
              <p className="text-[12.5px] text-[#6b6253] dark:text-[#8a7d69] mt-1">
                {importDiff
                  ? "Compared with your snapshot from your previous import."
                  : "Re-import your latest export to see what shifted."}
              </p>
            </div>
            <div
              className="grid grid-cols-3 gap-px rounded-xl overflow-hidden"
              style={{ background: "var(--zn-line-soft)", border: "1px solid var(--zn-line-soft)" }}
            >
              {(importDiff
                ? [
                    {
                      label: "Recovered cash",
                      value: formatCurrency(importDiff.totalPaidAmount ?? 0),
                      tone: "var(--zn-safe)",
                    },
                    {
                      label: "Newly overdue",
                      value: `${importDiff.newlyOverdue?.length ?? 0} invoices`,
                      tone: "var(--zn-risk)",
                    },
                    {
                      label: "Missed promises",
                      value: String(importDiff.promisesMissed?.length ?? 0),
                      tone: "var(--zn-ink-2)",
                    },
                  ]
                : [
                    {
                      label: "Recovered cash",
                      value: "—",
                      tone: "var(--zn-ink-3)",
                    },
                    {
                      label: "Newly overdue",
                      value: "—",
                      tone: "var(--zn-ink-3)",
                    },
                    {
                      label: "Missed promises",
                      value: "—",
                      tone: "var(--zn-ink-3)",
                    },
                  ]
              ).map((c) => (
                <div key={c.label} className="bg-[#faf5e8] dark:bg-[#211d17] p-4">
                  <div className="zn-label !p-0">{c.label}</div>
                  <div
                    className="text-[18px] font-semibold tabular-nums mt-1.5"
                    style={{ color: c.tone }}
                  >
                    {c.value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT — rendered only when at least one widget is visible */}
        {hasRightColumn && <div className="flex flex-col gap-5">

          {/* Risk insights */}
          {prefs.widgets.riskInsights && <div className="zn-card p-5">
            <div className="mb-3.5">
              <div className="zn-label !p-0 mb-1">Risk insights</div>
              <h2 className="text-[18px] font-semibold text-[#1d1813] dark:text-[#f0e8d5]">Where the risk sits</h2>
            </div>
            <div className="flex flex-col gap-4">
              {(() => {
                const overdue = invoices.filter((i) => i.daysOverdue > 0);
                const byCustomer = new Map<string, { count: number; total: number; oldest: number }>();
                overdue.forEach((i) => {
                  const c = byCustomer.get(i.customerName) ?? { count: 0, total: 0, oldest: 0 };
                  c.count += 1;
                  c.total += i.amountOutstanding;
                  c.oldest = Math.max(c.oldest, i.daysOverdue);
                  byCustomer.set(i.customerName, c);
                });
                const ranked = Array.from(byCustomer.entries()).sort(
                  (a, b) => b[1].total - a[1].total,
                );
                const top = ranked[0];
                const repeatLate = ranked.filter(([, v]) => v.oldest > 30).length;
                const missedPromises = invoices.filter((i) => i.status === "promised").length;

                return [
                  {
                    Icon: AlertTriangle,
                    kicker: "Highest exposure",
                    name: top ? top[0] : "—",
                    sub: top
                      ? `${formatCurrency(top[1].total)} · ${top[1].count} invoices`
                      : "No customers above threshold",
                  },
                  {
                    Icon: TrendingUp,
                    kicker: "Oldest overdue",
                    name: top ? `${top[1].oldest} days` : "—",
                    sub: top ? `${top[0]}` : "Nothing critical",
                  },
                  {
                    Icon: Users,
                    kicker: "Repeat late payers",
                    name: `${repeatLate} customer${repeatLate === 1 ? "" : "s"}`,
                    sub: ranked
                      .slice(0, 4)
                      .map(([n]) => n.split(" ")[0])
                      .join(", "),
                  },
                  {
                    Icon: Flag,
                    kicker: "Promises to check",
                    name: `${missedPromises} open`,
                    sub: "Confirm dates before re-chasing",
                  },
                ].map((r, i) => {
                  const Ico = r.Icon;
                  return (
                    <div key={i} className="flex items-start gap-3">
                      <div
                        className="size-7 rounded-lg inline-flex items-center justify-center flex-shrink-0"
                        style={{
                          background: "var(--zn-surface-2)",
                          border: "1px solid var(--zn-line-soft)",
                          color: "var(--zn-accent)",
                        }}
                      >
                        <Ico className="size-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="zn-label !p-0 mb-0.5">{r.kicker}</div>
                        <div className="text-[13.5px] font-semibold text-[#1d1813] dark:text-[#f0e8d5] truncate">
                          {r.name}
                        </div>
                        <div className="text-[12px] text-[#6b6253] dark:text-[#8a7d69] truncate">{r.sub}</div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>}

          {/* Weekly brief — ink black header card */}
          {prefs.widgets.weeklyBrief && <div className="zn-card overflow-hidden p-0">
            <div
              className="p-[18px]"
              style={{ background: "var(--zn-bg-inverse)", color: "var(--zn-surface)" }}
            >
              <div className="zn-label !p-0" style={{ color: "rgba(250,245,232,0.55)" }}>
                Focus for this week
              </div>
              <p
                className="mt-1.5 text-[17px] leading-[1.4] italic"
                style={{ fontFamily: "var(--font-newsreader), ui-serif, Georgia, serif" }}
              >
                Recover{" "}
                {formatCurrency(
                  plan
                    .filter((item) => item.dashboardGroup !== "do_not_chase")
                    .reduce((s, item) => s + item.amountOutstanding, 0),
                )}{" "}
                sitting overdue. The top calls likely move the needle most — aim for a
                date, not a payment.
              </p>
            </div>
            <div className="p-[18px]">
              <div className="zn-label !p-0 mb-2.5">Top 3 attention needed</div>
              <div className="flex flex-col gap-2">
                {plan
                  .filter((item) => item.dashboardGroup !== "do_not_chase")
                  .slice(0, 3)
                  .map((item) => {
                    const inv = invoices.find((i) => i.id === item.invoiceId);
                    return (
                      <Link
                        key={item.id}
                        href={`/chase-today?customer=${encodeURIComponent(item.customerName)}`}
                        className="flex items-center justify-between w-full px-3 py-2.5 rounded-[10px] text-left transition-colors hover:brightness-[0.98]"
                        style={{
                          background: "var(--zn-surface-2)",
                          border: "1px solid var(--zn-line-soft)",
                        }}
                      >
                        <div className="min-w-0">
                          <div className="text-[13px] font-semibold truncate" style={{ color: "var(--zn-ink)" }}>
                            {item.customerName}
                          </div>
                          <div className="text-[11.5px]" style={{ color: "var(--zn-ink-3)" }}>
                            {formatCurrency(item.amountOutstanding)}
                            {inv?.daysOverdue ? ` · ${inv.daysOverdue}d` : ""}
                          </div>
                        </div>
                        <ChevronRight className="size-4 flex-shrink-0" style={{ color: "var(--zn-ink-3)" }} />
                      </Link>
                    );
                  })}
              </div>
            </div>
          </div>}

          {/* Demo getting-started card — right column, bottom */}
          {account?.planId === "demo" && (
            <div
              className="zn-card overflow-hidden p-5"
              style={{ background: "var(--zn-bg-inverse)", borderColor: "var(--zn-bg-inverse)" }}
            >
              <div className="zn-label !p-0 mb-1.5" style={{ color: "rgba(250,245,232,0.5)" }}>
                Welcome to Zentra Collect
              </div>
              <p
                className="text-[15px] leading-[1.45] mb-4"
                style={{
                  fontFamily: "var(--font-newsreader), ui-serif, Georgia, serif",
                  color: "var(--zn-surface)",
                  fontStyle: "italic",
                  fontWeight: 400,
                }}
              >
                You&apos;re on sample data. Every recommendation shows action + reason + draft message.
              </p>
              <div className="flex flex-wrap gap-2">
                <Link
                  href="/chase-today"
                  className="zn-pill"
                  style={{ background: "var(--zn-accent)", color: "var(--zn-accent-ink)", height: 30, fontSize: 12 }}
                >
                  Try the demo <ArrowRight className="size-3" />
                </Link>
                <Link
                  href="/import"
                  className="zn-pill"
                  style={{
                    height: 30,
                    fontSize: 12,
                    background: "transparent",
                    color: "rgba(250,245,232,0.75)",
                    border: "1px solid rgba(250,245,232,0.2)",
                  }}
                >
                  Import your CSV
                </Link>
              </div>
            </div>
          )}
        </div>}
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
        canViewCustomerBehaviour={Boolean(
          account &&
            (account.planId === "demo" ||
              canUseFeature(account.planId, "customerBehaviourNotes")),
        )}
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
            selectedTone,
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
          setDraftRiskNotes(formatSafetyRiskNotes(nextMeta.safetyResult));
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
        onMarkSent={() => {
          updateInvoiceStatus("overdue", "Marked as sent");
          recordToneOutcomeForActive(selectedInvoice, selectedTone, "ignored");
        }}
        onMarkPromised={() => {
          updateInvoiceStatus("promised", "Promise to pay recorded");
          recordToneOutcomeForActive(selectedInvoice, selectedTone, "promised");
        }}
        onMarkDisputed={() =>
          updateInvoiceStatus("disputed", "Dispute recorded")
        }
        onMarkPaid={() => {
          updateInvoiceStatus("paid", "Marked paid");
          recordToneOutcomeForActive(selectedInvoice, selectedTone, "paid");
        }}
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
    <section className="rounded-2xl border border-[#d4c9ae] dark:border-[#2d2820] bg-[#faf5e8] dark:bg-[#211d17] p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8d8472] dark:text-[#6a5f4e]">
            What changed since last import
          </p>
          <h2
            className="mt-2 text-2xl text-[#1d1813] dark:text-[#f0e8d5]"
            style={{ fontFamily: "var(--font-newsreader), ui-serif, Georgia, serif", fontWeight: 500 }}
          >
            Import movement summary
          </h2>
        </div>
        <Button asChild variant="outline" className="rounded-full border-[#d4c9ae] dark:border-[#2d2820] bg-[#faf5e8] dark:bg-[#211d17]">
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
              className="rounded-xl border border-[#d4c9ae] dark:border-[#2d2820] bg-[#faf5e8] dark:bg-[#211d17] p-3 text-sm leading-6 text-[#3d3428] dark:text-[#d8ccb5]"
            >
              <span className="font-medium text-[#1d1813] dark:text-[#f0e8d5]">
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
    <div className="rounded-xl border border-[#d4c9ae] dark:border-[#2d2820] bg-[#faf5e8] dark:bg-[#211d17] p-4">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#8d8472] dark:text-[#6a5f4e]">
        {label}
      </p>
      <p className="mt-3 text-2xl text-[#1d1813] dark:text-[#f0e8d5] tabular-nums" style={{ fontFamily: "var(--font-newsreader), ui-serif, Georgia, serif", fontWeight: 500 }}>{value}</p>
      <p className="mt-1 text-sm text-[#8d8472] dark:text-[#6a5f4e]">{detail}</p>
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
  initialVisibleCount,
}: {
  title: string;
  description: string;
  items: CollectionsPlanItem[];
  invoices: Invoice[];
  onReview: (item: CollectionsPlanItem) => void;
  initialVisibleCount: number;
}) {
  const [showAll, setShowAll] = useState(false);
  const visibleItems = showAll ? items : items.slice(0, initialVisibleCount);
  const hiddenCount = Math.max(0, items.length - visibleItems.length);

  return (
    <Card className="rounded-[1.75rem] border border-[#d4c9ae] dark:border-[#2d2820] bg-[#faf5e8] dark:bg-[#211d17] py-0 shadow-none ring-0">
      <CardHeader className="border-b border-[#d4c9ae] dark:border-[#2d2820] p-4 sm:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-lg text-[#1d1813] dark:text-[#f0e8d5]" style={{ fontFamily: "var(--font-newsreader), ui-serif, Georgia, serif", fontWeight: 500 }}>
              {title}
              <span className="ml-2 rounded-full bg-[#f3ecd8] dark:bg-[#28231c] px-2 py-0.5 text-xs text-[#6b6253] dark:text-[#8a7d69]">
                {items.length}
              </span>
            </CardTitle>
            <CardDescription className="mt-1 text-[#6b6253] dark:text-[#8a7d69]">
              {description}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {items.length ? (
          <>
          <div className="space-y-3 p-3 sm:p-4">
            {visibleItems.map((item) => {
              const invoice = invoices.find(
                (current) => current.id === item.invoiceId,
              );

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onReview(item)}
                  className="grid w-full min-w-0 gap-4 rounded-[1.25rem] border border-[#d4c9ae] dark:border-[#2d2820] bg-[#faf5e8] dark:bg-[#211d17] p-4 text-left shadow-[0_1px_0_rgba(0,0,0,0.03)] transition hover:border-[#c0b49c] dark:border-[#3d3628] hover:bg-[#f5eed9] dark:hover:bg-[#2d2820] hover:shadow-md md:grid-cols-[minmax(0,1.15fr)_minmax(0,1.55fr)_auto]"
                >
                  <div className="min-w-0 border-b border-[#d4c9ae] dark:border-[#2d2820] pb-3 md:border-b-0 md:border-r md:pb-0 md:pr-4">
                    <p className="truncate text-base font-semibold text-[#1d1813] dark:text-[#f0e8d5]">
                      {item.customerName}
                    </p>
                    <p className="mt-1 text-sm text-[#8d8472] dark:text-[#6a5f4e]">
                      {item.invoiceNumber || "Customer balance"}
                    </p>
                    <div className="mt-4 space-y-2">
                      <p className="text-base font-semibold text-[#1d1813] dark:text-[#f0e8d5]">
                        {formatCurrency(item.amountOutstanding)}
                      </p>
                      {invoice?.daysOverdue ? (
                        <p className="text-sm font-medium text-rose-600">
                          {invoice.daysOverdue}d overdue
                          <span className="ml-1.5 font-normal text-[#a09885] dark:text-[#8a7d69]">
                            · due {invoice.dueDate ? formatDate(invoice.dueDate) : "—"}
                          </span>
                        </p>
                      ) : (
                        <p className="text-sm text-[#8d8472] dark:text-[#6a5f4e]">
                          {invoice?.dueDate ? `Due ${formatDate(invoice.dueDate)}` : "Not overdue"}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <p className="text-base font-semibold text-[#1d1813] dark:text-[#f0e8d5]">
                      {humanAction(item.recommendedAction)}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-[#6b6253] dark:text-[#8a7d69]">
                      {item.reason.split(";")[0].trim()}
                    </p>
                  </div>
                  <div className="flex min-w-0 flex-wrap items-start gap-2 md:max-w-48 md:justify-end">
                    <StatusBadge value={item.urgencyLevel} />
                    <SafetyBadge value={item.safetyStatus} />
                    <span className="mt-1 w-full rounded-full bg-[#1d1813] px-3 py-2 text-center text-xs font-semibold text-white transition hover:bg-[#3d3428]">
                      Review action
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
          {hiddenCount ? (
            <div className="border-t border-[#d4c9ae] dark:border-[#2d2820] p-4 sm:p-5">
              <Button
                type="button"
                variant="outline"
                className="w-full rounded-full border-[#d4c9ae] dark:border-[#2d2820] bg-[#faf5e8] dark:bg-[#211d17]"
                onClick={() => setShowAll(true)}
              >
                Show {hiddenCount} more in {title.toLowerCase()}
              </Button>
            </div>
          ) : showAll && items.length > initialVisibleCount ? (
            <div className="border-t border-[#d4c9ae] dark:border-[#2d2820] p-4 sm:p-5">
              <Button
                type="button"
                variant="outline"
                className="w-full rounded-full border-[#d4c9ae] dark:border-[#2d2820] bg-[#faf5e8] dark:bg-[#211d17]"
                onClick={() => setShowAll(false)}
              >
                Show fewer
              </Button>
            </div>
          ) : null}
          </>
        ) : (
          <div className="flex flex-col items-center gap-2 p-6 text-center">
            <p className="text-sm font-medium text-[#6b6253] dark:text-[#8a7d69]">
              {title === "Wait / low priority"
                ? "No low-priority items right now."
                : title === "Do not chase"
                ? "No invoices are set to 'do not chase'. Items marked here are hidden from the ranked plan."
                : `Nothing in ${title.toLowerCase()} right now.`}
            </p>
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
      ? actionScenarioMeta(actionScenario, invoice, allInvoices, scenarioDetails, tone)
      : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className="w-full overflow-y-auto border-[#d4c9ae] dark:border-[#2d2820] bg-[#faf5e8] dark:bg-[#211d17] p-0 sm:max-w-xl"
        side="right"
        style={{ boxShadow: "-8px 0 32px rgba(0,0,0,0.08)" }}
      >
        {item && invoice ? (
          <>
            <SheetHeader className="border-b border-[#d4c9ae] dark:border-[#2d2820] p-5">
              <SheetTitle className="text-2xl text-[#1d1813] dark:text-[#f0e8d5]" style={{ fontFamily: "var(--font-newsreader), ui-serif, Georgia, serif", fontWeight: 500 }}>
                {invoice.customerName}
              </SheetTitle>
              <SheetDescription className="text-[#6b6253] dark:text-[#8a7d69]">
                Invoice {invoice.invoiceNumber} ·{" "}
                {formatCurrency(invoice.amountOutstanding)} outstanding
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-5 p-5">
              <section className="grid gap-3 rounded-2xl border border-[#d4c9ae] dark:border-[#2d2820] bg-[#faf5e8] dark:bg-[#211d17] p-4 sm:grid-cols-2 [&>*]:min-w-0 [&>*]:overflow-hidden">
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

              {canViewCustomerBehaviour ? (
                <CustomerBehaviourCard profile={behaviourProfile} />
              ) : (
                <LockedFeatureCard
                  title="Customer behaviour summaries are locked."
                  description="Upgrade to use previous imports for payment behaviour notes, suggested tone, and customer memory."
                  feature="customerBehaviourNotes"
                />
              )}

              <section className="rounded-2xl border border-[#d4c9ae] dark:border-[#2d2820] bg-[#faf5e8] dark:bg-[#211d17] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8d8472] dark:text-[#6a5f4e]">
                  Recommendation
                </p>
                <h3 className="mt-3 text-lg font-semibold text-[#1d1813] dark:text-[#f0e8d5]">
                  {actionMeta?.recommendedAction ?? humanAction(item.recommendedAction)}
                </h3>
                <p className="mt-2 text-sm leading-6 text-[#6b6253] dark:text-[#8a7d69]">
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

              <section className="rounded-2xl border border-[#d4c9ae] dark:border-[#2d2820] bg-[#faf5e8] dark:bg-[#211d17] p-4">
                <div className="flex flex-col gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8d8472] dark:text-[#6a5f4e]">
                      What do you need to do?
                    </p>
                    <p className="mt-1 text-sm text-[#6b6253] dark:text-[#8a7d69]">
                      Choose the job first. Zentra adjusts the reason, safety
                      checks, fields, and draft.
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 [&>*]:min-w-0 [&>*]:overflow-hidden">
                    <div>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-[#8d8472] dark:text-[#6a5f4e]">Action Scenario</label>
                      <Select
                        value={actionScenario}
                        onValueChange={(value) => {
                          const next = value as ActionScenario;
                          onActionScenarioChange(next);
                        }}
                      >
                        <SelectTrigger className="w-full rounded-full bg-[#faf5e8] dark:bg-[#211d17]">
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
                    <div>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-[#8d8472] dark:text-[#6a5f4e]">Message Tone</label>
                      <Select
                        value={tone}
                        onValueChange={(value) => onToneChange(value as DraftTone)}
                      >
                        <SelectTrigger className="w-full rounded-full bg-[#faf5e8] dark:bg-[#211d17]">
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
                </div>
              </section>

              <ScenarioFields
                scenario={actionScenario}
                details={scenarioDetails}
                invoice={invoice}
                allInvoices={allInvoices}
                onChange={onScenarioDetailsChange}
              />

              <section className="rounded-2xl border border-[#d4c9ae] dark:border-[#2d2820] bg-[#faf5e8] dark:bg-[#211d17] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8d8472] dark:text-[#6a5f4e]">
                      Draft message
                    </p>
                    <p className="mt-1 text-sm text-[#6b6253] dark:text-[#8a7d69]">
                      Copy-only in MVP. Review before sending.
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className="rounded-full border-[#d4c9ae] dark:border-[#2d2820] bg-[#f3ecd8] dark:bg-[#28231c]"
                  >
                    {draftSource ?? "template"} · {draftConfidence}
                  </Badge>
                </div>
                <div className="mt-4 space-y-2" id="draft-section">
                  <label className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8d8472] dark:text-[#6a5f4e]">
                    Subject
                  </label>
                  <Input
                    value={subject}
                    onChange={(event) => onSubjectChange(event.target.value)}
                    className="rounded-2xl border-[#d4c9ae] dark:border-[#2d2820] bg-[#faf5e8] dark:bg-[#211d17]"
                  />
                </div>
                <Textarea
                  className="mt-4 min-h-64 resize-none rounded-2xl border-[#d4c9ae] dark:border-[#2d2820] bg-[#faf5e8] dark:bg-[#211d17] leading-6"
                  value={draft}
                  onChange={(event) => onDraftChange(event.target.value)}
                />

                {/* ── Payment link — inserts a Stripe pay-now URL into the draft ── */}
                {invoice && (
                  <PaymentLinkButton
                    invoiceRef={invoice.invoiceNumber ?? "INV"}
                    clientName={invoice.customerName}
                    amountOutstanding={invoice.amountOutstanding}
                    onInsert={(url) =>
                      onDraftChange(
                        draft
                          ? `${draft}\n\nPay now: ${url}`
                          : `Pay now: ${url}`,
                      )
                    }
                  />
                )}

                <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
                  <p className="font-semibold">Human review required</p>
                  <p className="mt-1">{riskNotes}</p>
                  <p className="mt-2">{nextStep}</p>
                </div>
              </section>

              <section className="rounded-2xl border border-[#d4c9ae] dark:border-[#2d2820] bg-[#faf5e8] dark:bg-[#211d17] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8d8472] dark:text-[#6a5f4e]">
                  Safety checks
                </p>
                <div className="mt-3 space-y-3">
                  {actionMeta?.safetyResult.checks.length ? (
                    actionMeta.safetyResult.checks.map((check) => (
                      <div
                        key={`${check.label}-${check.message}`}
                        className="rounded-xl border border-[#d4c9ae] dark:border-[#2d2820] bg-[#faf5e8] dark:bg-[#211d17] p-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-medium text-[#1d1813] dark:text-[#f0e8d5]">
                            {check.label}
                          </p>
                          <SafetyBadge value={check.status} />
                        </div>
                        <p className="mt-1 text-xs leading-5 text-[#6b6253] dark:text-[#8a7d69]">
                          {check.message}
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className="flex items-center gap-2 rounded-xl border border-[#d4c9ae] dark:border-[#2d2820] bg-[#faf5e8] dark:bg-[#211d17] p-3 text-sm text-[#3d3428] dark:text-[#d8ccb5]">
                      <ShieldCheck className="size-4" />
                      No blocking safety issues found.
                    </div>
                  )}
                </div>
              </section>

              <section className="rounded-2xl border border-[#d4c9ae] dark:border-[#2d2820] bg-[#faf5e8] dark:bg-[#211d17] p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8d8472] dark:text-[#6a5f4e]">
                      Classify customer reply
                    </p>
                    <p className="mt-1 text-sm text-[#6b6253] dark:text-[#8a7d69]">
                      Paste a reply to turn it into an AR state and next action.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {replyText.trim() && (
                      <Button
                        type="button"
                        variant="ghost"
                        className="rounded-full px-3 text-[#8d8472] dark:text-[#6a5f4e] hover:text-[#1d1813] dark:text-[#f0e8d5]"
                        onClick={() => onReplyTextChange("")}
                      >
                        Clear
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-full border-[#d4c9ae] dark:border-[#2d2820] bg-[#faf5e8] dark:bg-[#211d17]"
                      onClick={onClassifyReply}
                      disabled={!replyText.trim() || isClassifyingReply}
                    >
                      {isClassifyingReply ? "Classifying..." : "Classify"}
                    </Button>
                  </div>
                </div>
                <Textarea
                  className="mt-4 min-h-28 resize-none rounded-2xl border-[#d4c9ae] dark:border-[#2d2820] bg-[#faf5e8] dark:bg-[#211d17] leading-6"
                  value={replyText}
                  onChange={(event) => onReplyTextChange(event.target.value)}
                  placeholder="Paste the customer reply here..."
                />
                {replyClassification ? (
                  <div className="mt-4 rounded-2xl border border-[#d4c9ae] dark:border-[#2d2820] bg-[#faf5e8] dark:bg-[#211d17] p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-[#1d1813] dark:text-[#f0e8d5]">
                          {humanLabel(replyClassification.classification)}
                        </p>
                        <p className="mt-1 text-sm leading-6 text-[#6b6253] dark:text-[#8a7d69]">
                          {replyClassification.reason}
                        </p>
                      </div>
                      <Badge variant="outline" className="w-fit rounded-full border-[#d4c9ae] dark:border-[#2d2820] bg-[#faf5e8] dark:bg-[#211d17]">
                        {replyClassification.source} · {replyClassification.confidence}
                      </Badge>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2 [&>*]:min-w-0 [&>*]:overflow-hidden">
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
                      <div className="mt-4 grid gap-3 sm:grid-cols-2 [&>*]:min-w-0 [&>*]:overflow-hidden">
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
                        <label className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8d8472] dark:text-[#6a5f4e]">
                          Dispute reason
                        </label>
                        <Textarea
                          value={replyDisputeReason}
                          onChange={(event) =>
                            onReplyDisputeReasonChange(event.target.value)
                          }
                          className="mt-2 min-h-20 rounded-2xl border-[#d4c9ae] dark:border-[#2d2820] bg-[#faf5e8] dark:bg-[#211d17]"
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
                      className="mt-4 rounded-full bg-[#1d1813] text-white hover:bg-[#3d3428]"
                      onClick={onApplyReplyClassification}
                    >
                      Apply update
                    </Button>
                  </div>
                ) : null}
              </section>

              <section className="rounded-2xl border border-[#d4c9ae] dark:border-[#2d2820] bg-[#faf5e8] dark:bg-[#211d17] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8d8472] dark:text-[#6a5f4e]">
                  Activity history
                </p>
                <div className="mt-3 space-y-3">
                  {invoice.activityHistory.map((event) => (
                    <div key={event.id} className="flex gap-3">
                      <span className="mt-1 size-2 rounded-full bg-[#1d1813]" />
                      <div>
                        <p className="text-sm font-medium text-[#1d1813] dark:text-[#f0e8d5]">
                          {event.title}
                        </p>
                        <p className="text-xs leading-5 text-[#6b6253] dark:text-[#8a7d69]">
                          {event.description}
                        </p>
                        <p className="mt-1 text-xs text-[#a09885] dark:text-[#8a7d69]">
                          {formatDate(event.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <div className="sticky bottom-0 grid gap-2 border-t border-[#d4c9ae] dark:border-[#2d2820] bg-[#faf5e8] dark:bg-[#211d17]/95 p-4 backdrop-blur sm:grid-cols-2">
              <Button
                className="rounded-full bg-[#1d1813] text-white hover:bg-[#3d3428]"
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
                className="rounded-full border-[#d4c9ae] dark:border-[#2d2820] bg-[#faf5e8] dark:bg-[#211d17]"
                onClick={onCopy}
              >
                <Copy className="size-4" />
                {copied ? "Copied" : "Copy message"}
              </Button>
              <div className="sm:col-span-2">
                <Select
                  value=""
                  onValueChange={(val) => {
                    if (val === "sent") onMarkSent();
                    if (val === "promised") onMarkPromised();
                    if (val === "disputed") onMarkDisputed();
                    if (val === "paid") onMarkPaid();
                    if (val === "snooze") onSnooze();
                    if (val === "do_not_chase") onDoNotChase();
                  }}
                >
                  <SelectTrigger className="w-full rounded-full border-[#d4c9ae] dark:border-[#2d2820] bg-[#faf5e8] dark:bg-[#211d17] font-medium">
                    <SelectValue placeholder="Change status →" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sent">Mark as sent</SelectItem>
                    <SelectItem value="promised">Mark promised</SelectItem>
                    <SelectItem value="disputed">Mark disputed</SelectItem>
                    <SelectItem value="paid">Mark paid</SelectItem>
                    <SelectItem value="snooze">Snooze</SelectItem>
                    <SelectItem value="do_not_chase">Do not chase</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* ── Email & WhatsApp — send the draft directly to the client ── */}
              {invoice && (
                <>
                  <div className="sm:col-span-2">
                    <EmailSendButton
                      invoiceRef={invoice.invoiceNumber ?? "INV"}
                      clientName={invoice.customerName}
                      toEmail={invoice.customerEmail ?? ""}
                      draft={draft}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <WhatsAppSendButton
                      invoiceRef={invoice.invoiceNumber ?? "INV"}
                      clientName={invoice.customerName}
                      draft={draft}
                    />
                  </div>
                </>
              )}
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
          <label className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8d8472] dark:text-[#6a5f4e]">
            Notes
          </label>
          <Textarea
            value={details.disputeNotes}
            onChange={(event) => onChange({ disputeNotes: event.target.value })}
            className="mt-2 min-h-20 rounded-2xl border-[#d4c9ae] dark:border-[#2d2820] bg-[#faf5e8] dark:bg-[#211d17]"
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
          <label className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8d8472] dark:text-[#6a5f4e]">
            Statement summary
          </label>
          <Textarea
            value={details.statementSummary}
            onChange={(event) => onChange({ statementSummary: event.target.value })}
            className="mt-2 min-h-20 rounded-2xl border-[#d4c9ae] dark:border-[#2d2820] bg-[#faf5e8] dark:bg-[#211d17]"
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
          <label className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8d8472] dark:text-[#6a5f4e]">
            Escalation note
          </label>
          <Textarea
            value={details.escalationNote}
            onChange={(event) => onChange({ escalationNote: event.target.value })}
            className="mt-2 min-h-20 rounded-2xl border-[#d4c9ae] dark:border-[#2d2820] bg-[#faf5e8] dark:bg-[#211d17]"
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
      <section className="rounded-2xl border border-[#d4c9ae] dark:border-[#2d2820] bg-[#faf5e8] dark:bg-[#211d17] p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8d8472] dark:text-[#6a5f4e]">
          Customer behaviour
        </p>
        <h3 className="mt-3 text-lg font-semibold text-[#1d1813] dark:text-[#f0e8d5]">
          Not enough history yet.
        </h3>
        <p className="mt-2 text-sm leading-6 text-[#6b6253] dark:text-[#8a7d69]">
          Based on previous imported data, Zentra needs more invoice history
          before suggesting a customer pattern.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-[#d4c9ae] dark:border-[#2d2820] bg-[#faf5e8] dark:bg-[#211d17] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8d8472] dark:text-[#6a5f4e]">
            Customer behaviour
          </p>
          <h3 className="mt-3 text-lg font-semibold text-[#1d1813] dark:text-[#f0e8d5]">
            Based on previous imported data, this customer looks{" "}
            {profile.riskLabel}.
          </h3>
        </div>
        <Badge variant="outline" className="w-fit rounded-full border-[#d4c9ae] dark:border-[#2d2820] bg-[#f3ecd8] dark:bg-[#28231c]">
          {profile.riskLabel}
        </Badge>
      </div>
      <p className="mt-2 text-sm leading-6 text-[#6b6253] dark:text-[#8a7d69]">
        {profile.memoryNotes[0]}
      </p>
      {profile.averageDaysLate === 0 && profile.invoicesPaidLate === 0 && profile.missedPromisesCount === 0 && profile.disputesCount === 0 ? (
        <div className="mt-4 rounded-xl border border-[#d4c9ae] dark:border-[#2d2820] bg-[#faf5e8] dark:bg-[#211d17] p-3">
          <p className="text-sm text-[#3d3428] dark:text-[#d8ccb5]">Clean payment history. No missed promises or disputes recorded.</p>
        </div>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 [&>*]:min-w-0 [&>*]:overflow-hidden">
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
      )}
      <div className="mt-4 rounded-xl border border-[#d4c9ae] dark:border-[#2d2820] bg-[#faf5e8] dark:bg-[#211d17] p-3 text-sm leading-6 text-[#3d3428] dark:text-[#d8ccb5]">
        <p>
          <span className="font-medium text-[#1d1813] dark:text-[#f0e8d5]">Payment behaviour:</span>{" "}
          {profile.lastPaymentBehaviour}
        </p>
        <p className="mt-2">
          <span className="font-medium text-[#1d1813] dark:text-[#f0e8d5]">Suggested tone:</span>{" "}
          {humanLabel(profile.preferredToneSuggestion)}
        </p>
        <p className="mt-2">
          <span className="font-medium text-[#1d1813] dark:text-[#f0e8d5]">Recommendation:</span>{" "}
          {profile.recommendation}.
        </p>
        <p className="mt-2">
          <span className="font-medium text-[#1d1813] dark:text-[#f0e8d5]">Terms note:</span>{" "}
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
    <section className="rounded-2xl border border-[#d4c9ae] dark:border-[#2d2820] bg-[#faf5e8] dark:bg-[#211d17] p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8d8472] dark:text-[#6a5f4e]">
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
      <label className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8d8472] dark:text-[#6a5f4e]">
        {label}
      </label>
      <Input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 rounded-2xl border-[#d4c9ae] dark:border-[#2d2820] bg-[#faf5e8] dark:bg-[#211d17]"
      />
    </div>
  );
}

function DashboardLoadingState() {
  return (
    <div className="space-y-6">
      <div className="h-32 animate-pulse rounded-3xl bg-[#faf5e8] dark:bg-[#211d17]" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className="h-36 animate-pulse rounded-2xl bg-[#faf5e8] dark:bg-[#211d17]"
          />
        ))}
      </div>
      <div className="h-96 animate-pulse rounded-2xl bg-[#faf5e8] dark:bg-[#211d17]" />
    </div>
  );
}

function DashboardErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="max-w-md rounded-3xl border border-[#d4c9ae] dark:border-[#2d2820] bg-[#faf5e8] dark:bg-[#211d17] p-8 text-center">
        <AlertTriangle className="mx-auto size-8 text-[#1d1813] dark:text-[#f0e8d5]" />
        <h1 className="mt-4 text-2xl font-semibold text-[#1d1813] dark:text-[#f0e8d5]">
          Collections plan could not load
        </h1>
        <p className="mt-3 text-sm leading-6 text-[#6b6253] dark:text-[#8a7d69]">
          The import data or ranking rules failed to load. No messages have been
          generated or sent.
        </p>
        <Button
          onClick={onRetry}
          className="mt-5 rounded-full bg-[#1d1813] px-5 text-white"
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
      <div className="max-w-lg rounded-3xl border border-[#d4c9ae] dark:border-[#2d2820] bg-[#faf5e8] dark:bg-[#211d17] p-8 text-center">
        <FileText className="mx-auto size-9 text-[#1d1813] dark:text-[#f0e8d5]" />
        <h1 className="mt-4 text-2xl font-semibold text-[#1d1813] dark:text-[#f0e8d5]">
          Import invoices to build a collections plan
        </h1>
        <p className="mt-3 text-sm leading-6 text-[#6b6253] dark:text-[#8a7d69]">
          Zentra needs an overdue invoice export before it can rank actions,
          explain reasons, and prepare safe draft messages.
        </p>
        <Button asChild className="mt-5 rounded-full bg-[#1d1813] px-5 text-white">
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
    <div className="min-w-0 overflow-hidden">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#a09885] dark:text-[#8a7d69] truncate">
        {label}
      </p>
      <p className="mt-1 w-full overflow-hidden text-ellipsis whitespace-nowrap text-sm font-semibold leading-5 text-[#1d1813] dark:text-[#f0e8d5]" title={value}>{value}</p>
      {detail ? <p className="mt-1 w-full overflow-hidden text-ellipsis whitespace-nowrap text-xs text-[#8d8472] dark:text-[#6a5f4e]" title={detail}>{detail}</p> : null}
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 overflow-hidden">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#a09885] dark:text-[#8a7d69] truncate">
        {label}
      </p>
      <p className="mt-1 w-full overflow-hidden text-ellipsis whitespace-nowrap text-sm font-medium text-[#1d1813] dark:text-[#f0e8d5]" title={value}>
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
        : "border-[#d4c9ae] dark:border-[#2d2820] bg-[#f3ecd8] dark:bg-[#28231c] text-[#3d3428] dark:text-[#d8ccb5]";

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
      : value === "needs_review" || value === "review"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-emerald-200 bg-emerald-50 text-emerald-700";

  return (
    <Badge variant="outline" className={`rounded-full ${tone}`}>
      {humanLabel(value)}
    </Badge>
  );
}

function formatSafetyRiskNotes(result: UnifiedSafetyResult) {
  return `${result.warningMessage} ${result.checks
    .map((check) => check.message)
    .join(" ")}`.trim();
}

function buildDrawerSafetyResult(
  item: CollectionsPlanItem,
  invoice: Invoice,
  tone?: DraftTone,
  extraChecks: UnifiedSafetyCheck[] = [],
) {
  return buildInvoiceMessageSafetyResult({
    invoice,
    tone,
    extraChecks: [
      ...item.safetyChecks.map((check) => ({
        label: check.title,
        status:
          check.status === "blocked"
            ? "blocked" as const
            : check.status === "needs_review"
              ? "review" as const
              : "safe" as const,
        message: check.explanation,
      })),
      ...extraChecks,
    ],
  });
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
  tone?: DraftTone,
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
    safetyChecks: UnifiedSafetyCheck[];
    safetyResult: UnifiedSafetyResult;
    safetyStatus: "safe_to_draft" | "needs_review" | "blocked";
    confidence: "high" | "medium" | "low";
    nextStep: string;
  }> = {
    SEND_PAYMENT_REMINDER: {
      recommendedAction: "Send payment reminder",
      explanation: `${invoice.invoiceNumber} has ${formatCurrency(invoice.amountOutstanding)} outstanding and is ${invoice.daysOverdue} days overdue.`,
      ...scenarioSafety(invoice, details, [], tone),
      confidence: invoice.disputeReason ? "low" : "high",
      nextStep: "Review the draft, then copy it into your email client.",
    },
    ASK_FOR_PAYMENT_DATE: {
      recommendedAction: "Ask for payment date",
      explanation: "The goal is not escalation; ask for a clear expected payment date.",
      ...scenarioSafety(invoice, details, [], tone),
      confidence: "high",
      nextStep: "Copy only after checking the balance is still outstanding.",
    },
    REQUEST_REMITTANCE: {
      recommendedAction: "Request remittance advice",
      explanation: `Customer may have paid, but ${formatCurrency(invoice.amountOutstanding)} is still unmatched.`,
      ...scenarioSafety(invoice, details, [
        {
          label: "Remittance first",
          status: "review",
          message: "Ask for remittance before sending another payment reminder.",
        },
      ], tone),
      confidence: "medium",
      nextStep: "Ask for remittance details and match the payment before chasing again.",
    },
    STATEMENT_OF_ACCOUNT: {
      recommendedAction: "Send/request statement of account",
      explanation: `${customerInvoices.length} open invoice${customerInvoices.length === 1 ? "" : "s"} total ${formatCurrency(totalOutstanding)} for this customer.`,
      ...scenarioSafety(invoice, details, [
        {
          label: "Statement accuracy",
          status: "review",
          message: "Check the statement includes only open customer invoices.",
        },
      ], tone),
      confidence: "medium",
      nextStep: "Review open items before copying the statement request.",
    },
    CONFIRM_INVOICE_RECEIVED: {
      recommendedAction: "Confirm invoice was received",
      explanation: "Use this when the invoice is early-stage, not seriously overdue, or the recipient is uncertain.",
      ...scenarioSafety(invoice, details, [], tone),
      confidence: "high",
      nextStep: "Confirm the right recipient before increasing tone.",
    },
    ASK_FOR_AP_CONTACT: {
      recommendedAction: "Ask for AP/accounts contact",
      explanation: "The current contact is missing or may not be the right person for payment queries.",
      ...scenarioSafety(invoice, details, [
        {
          label: "Contact first",
          status: "review",
          message: "Do not send invoice-specific pressure until the right contact is confirmed.",
        },
      ], tone),
      confidence: "medium",
      nextStep: "Find the right AP contact, then resume invoice-level follow-up.",
    },
    PROMISE_FOLLOW_UP: {
      recommendedAction: "Follow up promised payment",
      explanation: `A promised payment date${details.promisedDate ? ` of ${formatDate(details.promisedDate)}` : ""} needs checking.`,
      ...scenarioSafety(invoice, details, [
        {
          label: "Receipt check",
          status: "review",
          message: "Check bank receipts before saying the promise was missed.",
        },
      ], tone),
      confidence: "medium",
      nextStep: "Ask whether payment was made or request a revised payment date.",
    },
    RESOLVE_DISPUTE: {
      recommendedAction: "Resolve dispute",
      explanation: details.disputeReason || invoice.disputeReason || "This item should be resolved before normal chasing.",
      ...scenarioSafety(invoice, details, [
        {
          label: "Dispute workflow",
          status: "blocked",
          message: "Do not send a normal payment reminder while a dispute is open.",
        },
      ], tone),
      confidence: "high",
      nextStep: "Resolve the query before resuming payment reminders.",
    },
    INTERNAL_ESCALATION: {
      recommendedAction: "Escalate internally",
      explanation: "This is an internal note, not a customer chase.",
      ...scenarioSafety(invoice, details, [
        {
          label: "Internal only",
          status: "review",
          message: "Keep this internal. Do not send it to the customer.",
        },
      ], tone),
      confidence: "medium",
      nextStep: "Share internally with the account owner.",
    },
    THANK_YOU_AFTER_PAYMENT: {
      recommendedAction: "Send thank-you after payment",
      explanation: "Use only after confirming the payment has cleared.",
      ...scenarioSafety(invoice, details, [
        {
          label: "Payment confirmation",
          status: invoice.amountOutstanding > 0 ? "review" : "safe",
          message: "Confirm the invoice is paid before sending thanks.",
        },
      ], tone),
      confidence: invoice.amountOutstanding > 0 ? "medium" : "high",
      nextStep: "Send only after the payment is confirmed.",
    },
  };

  return meta[scenario];
}

function scenarioSafety(
  invoice: Invoice,
  details: ScenarioDetails,
  extraChecks: UnifiedSafetyCheck[] = [],
  tone?: DraftTone,
): {
  safetyChecks: UnifiedSafetyCheck[];
  safetyResult: UnifiedSafetyResult;
  safetyStatus: "safe_to_draft" | "needs_review" | "blocked";
} {
  const safetyResult = buildInvoiceMessageSafetyResult({
    invoice,
    tone,
    extraChecks: [
      ...extraChecks,
      ...(details.currentContact || invoice.customerEmail
        ? []
        : [
            {
              label: "Contact missing",
              status: "blocked" as const,
              message: "No customer email is present; confirm the correct contact first.",
            },
          ]),
      ...(details.disputeReason
        ? [
            {
              label: "Scenario dispute detail",
              status: "blocked" as const,
              message: "A dispute is present; avoid normal payment reminder wording.",
            },
          ]
        : []),
    ],
  });

  return {
    safetyChecks: safetyResult.checks,
    safetyResult,
    safetyStatus:
      safetyResult.status === "blocked"
        ? "blocked"
        : safetyResult.status === "review"
          ? "needs_review"
          : "safe_to_draft",
  };
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

function recordToneOutcomeForActive(
  invoice: ZentraInvoice | null | undefined,
  draftTone: DraftTone,
  outcome: ToneOutcome,
) {
  if (!invoice) return;
  const map: Record<DraftTone, ReminderTone> = {
    friendly: "Friendly",
    neutral:  "Neutral",
    firm:     "Firm",
    final:    "Final notice",
  };
  recordToneOutcome({
    customerId: invoice.customerId,
    tone:       map[draftTone],
    outcome,
    at:         new Date().toISOString(),
  });
}

function humanLabel(value: string) {
  return value
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  Bell,
  CalendarCheck,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clipboard,
  Copy,
  FileText,
  FileUp,
  Loader2,
  MailPlus,
  MoreVertical,
  Search,
  ShieldAlert,
  ShieldCheck,
  Upload,
  X,
} from "lucide-react";
import { ActionDrawerContent } from "@/components/action-drawer-content";
import {
  PageHeader,
  MetricCard,
  SectionCard,
  StatusBadge,
  SafetyBadge,
  PillTabs,
  EmptyState,
  LoadingOverlay,
} from "./zentra-ui";
import {
  LockedFeatureCard,
  UpgradePromptModal,
} from "@/components/billing-gates";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  createUsageCounters,
} from "@/lib/demo-auth";
import type { BillingAccount } from "@/lib/billing/plans";
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
import { fetchInvoicesFromDb, fetchAccountFromDb } from "@/lib/api/client-db";
import { hasSupabaseBrowserConfig } from "@/lib/supabase/browser";

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

type PlanViewFilter = "focus" | CollectionsDashboardGroup;

const planViewFilters: Array<{
  id: PlanViewFilter;
  label: string;
  description: string;
}> = [
  {
    id: "focus",
    label: "Focus",
    description: "Chase, promises, and exceptions",
  },
  {
    id: "chase_now",
    label: "Chase now",
    description: "Ready to review",
  },
  {
    id: "promises_to_check",
    label: "Promises",
    description: "Payment dates to check",
  },
  {
    id: "exceptions_to_resolve",
    label: "Exceptions",
    description: "Blocked or unsafe to chase",
  },
  {
    id: "wait_low_priority",
    label: "Waiting",
    description: "Low priority",
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

function readImportedInvoices(demoMode: boolean) {
  if (typeof window === "undefined") return demoMode ? demoInvoices : [];

  const localAccount = readLocalAccount();
  const storageKey =
    demoMode
      ? demoInvoiceStateStorageKey
      : importedInvoicesStorageKey;
  const storedInvoices = window.localStorage.getItem(storageKey);
  if (!storedInvoices) return demoMode ? demoInvoices : [];

  try {
    const parsedInvoices = JSON.parse(storedInvoices) as Invoice[];
    return Array.isArray(parsedInvoices) && parsedInvoices.length
      ? parsedInvoices
      : (demoMode ? demoInvoices : []);
  } catch {
    window.localStorage.removeItem(storageKey);
    return demoMode ? demoInvoices : [];
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

export function ZentraDashboard({
  initialInvoices,
  demoMode = false,
}: {
  initialInvoices?: Invoice[];
  demoMode?: boolean;
} = {}) {
  const { account: localAccount } = useLocalAccount();
  const [supabaseAccount, setSupabaseAccount] = useState<BillingAccount | null>(null);
  const [upgradePrompt, setUpgradePrompt] = useState<{
    title: string;
    description: string;
  } | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>(
    () => initialInvoices ?? readImportedInvoices(demoMode),
  );
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
  const [isMobile, setIsMobile] = useState(false);
  const account = useMemo<BillingAccount | null>(() => {
    if (supabaseAccount) return supabaseAccount;
    if (localAccount) return localAccount;
    if (!demoMode) return null;
    const now = new Date().toISOString();
    return {
      planId: "demo",
      accountType: "demo",
      subscriptionStatus: "demo",
      createdAt: now,
      currentPeriodStartedAt: now,
      usage: createUsageCounters({
        activeInvoices: invoices.length,
        aiActionsThisMonth: 0,
      }),
    };
  }, [demoMode, invoices.length, localAccount, supabaseAccount]);

  useEffect(() => {
    if (!demoMode && hasSupabaseBrowserConfig()) {
      setLoadState("loading");
      
      // Fetch invoices
      fetchInvoicesFromDb()
        .then((dbInvoices) => {
          if (dbInvoices.length > 0) {
            setInvoices(dbInvoices);
          }
          setLoadState("ready");
        })
        .catch((err) => {
          console.error("Dashboard load failed:", err);
          setLoadState("error");
        });

      // Fetch account state
      fetchAccountFromDb().then(acc => {
        if (acc) {
          // Map DB account to BillingAccount type
          let planId = acc.plan_id.toLowerCase();
          if (planId === 'founding_single') planId = 'founding_single_business';
          
          setSupabaseAccount({
            planId: planId as any,
            accountType: acc.status === 'trialing' ? 'trial' : 'paid',
            subscriptionStatus: acc.status as any,
            createdAt: acc.created_at,
            usage: {
              activeInvoices: invoices.length,
              importBatches: 0,
              importsThisMonth: 0,
              aiActionsThisMonth: 0,
              clientLedgers: 0
            }
          });
        }
      });
    }
  }, [demoMode]);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

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
      if (!demoMode) persistInvoices(next);
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
      if (!demoMode) persistInvoices(next);
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
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LoadingOverlay message="Analyzing your invoices..." />
      </div>
    );
  }

  if (loadState === "error") {
    return (
      <EmptyState
        title="Something went wrong"
        description="We couldn't load your collections plan. Please try again."
        icon={ShieldAlert}
        action={
          <Button onClick={() => setLoadState("ready")} className="rounded-full bg-black text-white">
            Try again
          </Button>
        }
      />
    );
  }

  if (!invoices.length) {
    if (demoMode) return null; // Should never happen unless demo data is cleared
    
    return (
      <EmptyState
        title="Import your first invoice export"
        description="Upload a CSV or Excel AR ageing report to generate your first ranked chase plan."
        icon={FileUp}
        action={
          <Button asChild className="rounded-full bg-black text-white">
            <Link href="/import">Import invoices</Link>
          </Button>
        }
      />
    );
  }

  const hasOpenReview = Boolean(selectedPlanId && selectedPlan && selectedInvoice);

  return (
    <div className={cn(
      "relative flex min-h-0",
      hasOpenReview ? "gap-0" : ""
    )}>
      {/* Main content */}
      <div className={cn(
        "flex-1 min-w-0 space-y-6 transition-all duration-300 w-full max-w-[1280px]",
        hasOpenReview ? "mr-[420px]" : ""
      )}>
        <UpgradePromptModal
          open={Boolean(upgradePrompt)}
          title={upgradePrompt?.title ?? ""}
          description={upgradePrompt?.description ?? ""}
          onClose={() => setUpgradePrompt(null)}
        />

        {/* Page header */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-[28px] font-black tracking-tight text-neutral-950 leading-none">Today&apos;s collections plan</h1>
            <p className="mt-2 text-[14px] text-neutral-500">Know who to chase, what to do, and why.</p>
          </div>
          <div className="flex items-center gap-3">
            <Button asChild className="hidden sm:flex h-9 rounded-full bg-neutral-950 px-5 text-[12px] font-bold text-white shadow-lg transition-all hover:scale-[1.02] active:scale-95">
              <Link href={demoMode ? "/login" : "/import"}>
                <Upload className="mr-2 size-3.5" />
                {demoMode ? "Upload your own file" : "Import invoices"}
              </Link>
            </Button>
            <button className="relative flex size-9 items-center justify-center rounded-full bg-white transition-all hover:bg-neutral-50 border border-black/5 shadow-sm">
              <Bell className="size-[18px] text-neutral-600" />
              <span className="absolute right-[8px] top-[8px] flex size-[8px] rounded-full bg-red-500 ring-2 ring-white" />
            </button>
          </div>
        </div>

        {importSummary ? (
          <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <ShieldCheck className="size-4 text-emerald-600 flex-shrink-0" />
            <p className="text-[13px] text-emerald-800">
              Found <span className="font-bold">{formatCurrency(importSummary.cashNeedingAttention)}</span> needing
              attention across <span className="font-bold">{importSummary.actionsRecommended}</span> actions.
            </p>
            <Button asChild variant="outline" className="ml-auto h-7 rounded-lg border-emerald-200 bg-white text-[12px] text-emerald-700 hover:bg-emerald-50 flex-shrink-0">
              <Link href="/import/summary">View summary</Link>
            </Button>
          </div>
        ) : null}

        {importDiff && account && canUseFeature(account.planId, "reimportComparison") ? (
          <ImportDiffDashboard diff={importDiff} />
        ) : importDiff ? (
          <LockedFeatureCard
            title="Re-import comparison is locked"
            description="Upgrade to compare this file with the previous import and see what changed."
            feature="reimportComparison"
          />
        ) : null}

        {/* Metric bar — matches reference image horizontal layout */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {summary.map((item) => (
            <div
              key={item.label}
              className="flex flex-col rounded-xl border border-black/8 bg-white p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">{item.label}</p>
                {item.icon && <item.icon className="size-4 text-neutral-300 flex-shrink-0" />}
              </div>
              <p className="mt-3 text-[22px] font-bold tracking-tight text-neutral-950 leading-none">{item.value}</p>
              {item.detail && <p className="mt-0.5 text-[12px] text-neutral-400">{item.detail}</p>}
            </div>
          ))}
        </div>

        {/* Filter tabs row + Search + Sort */}
        <div className="flex items-center justify-between gap-4 rounded-[1.25rem] border border-black/8 bg-white p-2 shadow-sm">
          <div className="flex items-center gap-1 overflow-x-auto">
            {planViewFilters.map((f) => {
              const count = f.id === "focus"
                ? groups.chase_now.length + groups.promises_to_check.length + groups.exceptions_to_resolve.length
                : groups[f.id as CollectionsDashboardGroup]?.length ?? 0;
              const isActive = planViewFilter === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setPlanViewFilter(f.id as PlanViewFilter)}
                  className={cn(
                    "flex h-9 items-center gap-2 whitespace-nowrap rounded-full px-4 text-[13px] font-bold transition-all",
                    isActive
                      ? "bg-neutral-950 text-white shadow-md"
                      : "text-neutral-900 hover:bg-neutral-50"
                  )}
                >
                  {f.label}
                  <span className={cn(
                    "inline-flex size-5 items-center justify-center rounded-full text-[10px] font-black",
                    isActive ? "bg-white/20 text-white" : "bg-neutral-100 text-neutral-500"
                  )}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="hidden md:flex items-center gap-3 pr-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                placeholder="Search customer or invoice..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 w-[260px] rounded-full border border-black/10 bg-neutral-50 pl-9 pr-4 text-[13px] text-neutral-700 placeholder:text-neutral-400 outline-none focus:border-black/20 focus:bg-white transition-all"
              />
            </div>
            <div className="h-5 w-px bg-black/10" />
            <button
              type="button"
              className="flex size-9 items-center justify-center rounded-lg border border-black/10 bg-white text-neutral-500 hover:bg-neutral-50 transition-all"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
            </button>
          </div>
        </div>

        {/* Invoice groups */}
        <div className="space-y-2">
          {filteredVisibleGroups.map((group) => (
            <PlanGroup
              key={group.id}
              title={group.title}
              description={group.description}
              items={groups[group.id]}
              invoices={invoices}
              onReview={openReview}
              initialVisibleCount={planViewFilter === "focus" ? 5 : 10}
              selectedPlanId={selectedPlanId}
              compact={hasOpenReview}
            />
          ))}
        </div>
      </div>

      {/* Desktop Action Panel */}
      {selectedPlanId && selectedPlan && selectedInvoice && (
        <div className="fixed bottom-0 right-0 top-[57px] z-40 hidden w-[400px] flex-shrink-0 border-l border-black/8 bg-white shadow-xl overflow-hidden lg:flex lg:flex-col">
          <ActionDrawerContent
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
            onClose={() => setSelectedPlanId(null)}
            actionMeta={actionScenarioMeta(actionScenario, selectedInvoice, invoices, scenarioDetails, selectedTone)}
            actionScenarioOptions={actionScenarioOptions}
          />
        </div>
      )}

      {/* Mobile/Tablet Drawer */}
      {isMobile && selectedPlanId && (
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
          open={Boolean(selectedPlanId) && isMobile}
        />
      )}


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
  initialVisibleCount,
  selectedPlanId,
  compact,
}: {
  title: string;
  description: string;
  items: CollectionsPlanItem[];
  invoices: Invoice[];
  onReview: (item: CollectionsPlanItem) => void;
  initialVisibleCount: number;
  selectedPlanId: string | null;
  compact?: boolean;
}) {
  const [showAll, setShowAll] = useState(false);
  const visibleItems = showAll ? items : items.slice(0, initialVisibleCount);
  const hiddenCount = Math.max(0, items.length - visibleItems.length);

  return (
      <div className="mb-8">
        <div className="flex items-center justify-between gap-4 mb-1">
          <div className="flex items-baseline gap-3">
            <h2 className="text-[20px] font-black tracking-tight text-neutral-950">{title}</h2>
            <span className="inline-flex size-5 items-center justify-center rounded-full bg-neutral-100 text-[11px] font-bold text-neutral-600">
              {items.length}
            </span>
          </div>
          <div className="hidden sm:flex items-center gap-1.5">
            <span className="text-[13px] font-bold text-neutral-950">Sort: Priority</span>
            <ChevronDown className="size-3.5 text-neutral-500" />
          </div>
        </div>
        <p className="text-[13px] text-neutral-500 mb-6">{description}</p>

        {/* Table header */}
        <div className="hidden md:grid items-center px-4 pb-3 border-b border-black/10 text-[10px] font-bold uppercase tracking-widest text-neutral-500"
          style={{ gridTemplateColumns: "48px minmax(140px, 3fr) minmax(100px, 1.2fr) minmax(100px, 1fr) minmax(100px, 1fr) minmax(180px, 2fr) 280px" }}
        >
          <div className="text-center pr-4">#</div>
          <div className="pr-6">Customer</div>
          <div className="text-right pr-4">Amount</div>
          <div className="pr-4">Due Date</div>
          <div className="text-right pr-4">Overdue</div>
          <div className="pr-6 pl-4">Recommended Action</div>
          <div className="text-right">Review Status</div>
        </div>

        <div className="flex flex-col">
          {items.length ? (
            <>
            {visibleItems.map((item, index) => {
              const invoice = invoices.find((c) => c.id === item.invoiceId);
              const isSelected = selectedPlanId === item.id;

              const isCritical = item.urgencyLevel === "critical";
              const isHigh = item.urgencyLevel === "high";
              const urgencyStyle =
                isCritical || isHigh
                  ? "border-red-200 text-red-600"
                  : item.urgencyLevel === "medium"
                  ? "border-orange-200 text-orange-600"
                  : "border-emerald-200 text-emerald-600";

              // Safety badge styles  
              const safetyStyle =
                item.safetyStatus === "blocked"
                  ? "border-red-200 text-red-600"
                  : item.safetyStatus === "needs_review"
                  ? "border-orange-200 text-orange-600"
                  : "border-emerald-200 text-emerald-600";
              const safetyLabel =
                item.safetyStatus === "blocked"
                  ? "Blocked"
                  : item.safetyStatus === "needs_review"
                  ? "Needs review"
                  : "Safe";

              // Risk level
              const riskStyle =
                isCritical || isHigh
                  ? "border-red-200 text-red-600"
                  : item.urgencyLevel === "medium"
                  ? "border-orange-200 text-orange-600"
                  : "border-neutral-200 text-neutral-600";
              const riskLabel =
                isCritical
                  ? "High risk"
                  : isHigh
                  ? "High risk"
                  : item.urgencyLevel === "medium"
                  ? "Medium risk"
                  : "Low risk";

              const invoiceDueDate = invoice?.dueDate ? new Date(invoice.dueDate).toLocaleDateString("en-GB", { day: '2-digit', month: 'short', year: 'numeric' }) : "-";

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onReview(item)}
                  className={cn(
                    "group w-full text-left transition-all duration-150",
                    index < visibleItems.length - 1 ? "border-b border-black/6" : "",
                    isSelected
                      ? "bg-neutral-50 ring-1 ring-inset ring-black/10"
                      : "hover:bg-neutral-50/70"
                  )}
                >
                  {/* Desktop row */}
                  <div className="hidden md:grid items-center px-4 py-2.5"
                    style={{ gridTemplateColumns: "48px minmax(140px, 3fr) minmax(100px, 1.2fr) minmax(100px, 1fr) minmax(100px, 1fr) minmax(180px, 2fr) 280px" }}
                  >
                    {/* Col 0: Index */}
                    <div className="flex justify-center pr-4">
                      <span className="flex size-5 items-center justify-center rounded-full bg-neutral-100 text-[10px] font-bold text-neutral-500">
                        {index + 1}
                      </span>
                    </div>

                    {/* Col 1: Company + Invoice */}
                    <div className="min-w-0 pr-6">
                      <p className="truncate text-[13px] font-bold text-neutral-950">
                        {item.customerName}
                      </p>
                      <p className="mt-0.5 text-[11px] text-neutral-500 font-medium">
                        {item.invoiceNumber || "Balance Chase"}
                      </p>
                    </div>

                    {/* Col 2: Amount */}
                    <div className="min-w-0 pr-4 text-right">
                      <p className="text-[13px] font-bold text-neutral-950">
                        {formatCurrency(item.amountOutstanding)}
                      </p>
                    </div>

                    {/* Col 3: Due Date */}
                    <div className="min-w-0 pr-4">
                      <p className="text-[12px] font-bold text-neutral-950">
                        {invoiceDueDate}
                      </p>
                    </div>

                    {/* Col 4: Overdue */}
                    <div className="min-w-0 pr-4 text-right">
                      {invoice?.daysOverdue ? (
                        <p className="text-[12px] font-bold text-red-600">
                          {invoice.daysOverdue} days
                        </p>
                      ) : <p className="text-[12px] font-bold text-neutral-400">-</p>}
                    </div>

                    {/* Col 5: Recommended Action + Context */}
                    <div className="min-w-0 pr-6 pl-4">
                      <p className="truncate text-[13px] font-bold text-neutral-950">
                        {humanAction(item.recommendedAction)}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] text-neutral-500 font-medium">
                        {item.reason.split(";")[0].trim().split("•").slice(0, 2).join(" •")}
                      </p>
                    </div>

                    {/* Col 6: Review Status & Actions */}
                    <div className="flex items-center justify-end gap-3 flex-shrink-0">
                      <div className="flex items-center gap-1.5">
                        <span className={cn("inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold whitespace-nowrap", riskStyle)}>
                          {riskLabel}
                        </span>
                        <span className={cn("inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold whitespace-nowrap", safetyStyle)}>
                          {safetyLabel}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-1 pl-2">
                        <span className="inline-flex h-[28px] items-center justify-center rounded-full bg-neutral-950 px-4 text-[11px] font-bold text-white transition-all group-hover:bg-neutral-800">
                          Review
                        </span>
                        <button type="button" className="flex size-7 items-center justify-center rounded-full hover:bg-neutral-200 text-neutral-500 transition-colors">
                          <MoreVertical className="size-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Mobile row */}
                  <div className="flex md:hidden items-start gap-3 px-4 py-4">
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-[14px] font-semibold text-neutral-950">{item.customerName}</p>
                        <p className="text-[14px] font-bold text-neutral-950 flex-shrink-0">{formatCurrency(item.amountOutstanding)}</p>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[12px] text-neutral-400">{item.invoiceNumber}</p>
                        {invoice?.daysOverdue ? (
                          <p className="text-[12px] font-semibold text-rose-600 flex-shrink-0">{invoice.daysOverdue}d overdue</p>
                        ) : null}
                      </div>
                      <p className="text-[13px] font-semibold text-neutral-800">{humanAction(item.recommendedAction)}</p>
                      <div className="flex flex-wrap gap-1 pt-0.5">
                        <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold", urgencyStyle)}>
                          {item.urgencyLevel === "critical" ? "Critical" : item.urgencyLevel === "high" ? "High" : "Medium"}
                        </span>
                        <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold", riskStyle)}>
                          {riskLabel}
                        </span>
                      </div>
                    </div>
                    <span className="inline-flex h-8 flex-shrink-0 items-center justify-center rounded-lg bg-neutral-950 px-4 text-[12px] font-semibold text-white">
                      Review
                    </span>
                  </div>
                </button>
              );
            })}

            {hiddenCount ? (
              <div className="flex items-center justify-center border-t border-black/8 py-4">
                <div className="flex flex-col items-center gap-2">
                  <p className="text-[11px] text-neutral-400 font-medium">Showing 1 to {visibleItems.length} of {items.length} results</p>
                  <button
                    type="button"
                    onClick={() => setShowAll(true)}
                    className="flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-4 py-1.5 text-[12px] font-bold text-neutral-700 hover:bg-neutral-50 transition-all shadow-sm"
                  >
                    Load more
                    <ChevronDown className="size-3 text-neutral-400" />
                  </button>
                </div>
              </div>
            ) : showAll && items.length > initialVisibleCount ? (
              <div className="flex items-center justify-center border-t border-black/8 py-4">
                <div className="flex flex-col items-center gap-2">
                  <p className="text-[11px] text-neutral-400 font-medium">Showing all {items.length} results</p>
                  <button
                    type="button"
                    onClick={() => setShowAll(false)}
                    className="flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-4 py-1.5 text-[12px] font-bold text-neutral-700 hover:bg-neutral-50 transition-all shadow-sm"
                  >
                    Show fewer
                  </button>
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <div className="py-10 text-center">
            <p className="text-[13px] font-medium text-neutral-400">
              {title === "Wait / low priority"
                ? "No low-priority items right now."
                : `Nothing in ${title.toLowerCase()} right now.`}
            </p>
          </div>
        )}
      </div>
    </div>
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
  open,
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
  open?: boolean;
}) {
  const isOpen = open ?? Boolean(item && invoice);
  if (!item || !invoice) return null;

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent
        className="w-full overflow-y-auto border-black/10 bg-[#fbf8f1] p-0 sm:max-w-xl"
        side="right"
      >
        <ActionDrawerContent
          item={item}
          invoice={invoice}
          customer={customer}
          behaviourProfile={behaviourProfile}
          canViewCustomerBehaviour={canViewCustomerBehaviour}
          subject={subject}
          draft={draft}
          actionScenario={actionScenario}
          scenarioDetails={scenarioDetails}
          allInvoices={allInvoices}
          tone={tone}
          riskNotes={riskNotes}
          nextStep={nextStep}
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
          onActionScenarioChange={onActionScenarioChange}
          onScenarioDetailsChange={onScenarioDetailsChange}
          onToneChange={onToneChange}
          onSubjectChange={onSubjectChange}
          onDraftChange={onDraftChange}
          onReplyTextChange={onReplyTextChange}
          onClassifyReply={onClassifyReply}
          onApplyReplyClassification={onApplyReplyClassification}
          onReplyPromiseDateChange={onReplyPromiseDateChange}
          onReplyPromiseAmountChange={onReplyPromiseAmountChange}
          onReplyDisputeReasonChange={onReplyDisputeReasonChange}
          onGenerate={onGenerate}
          onCopy={onCopy}
          onMarkSent={onMarkSent}
          onMarkPromised={onMarkPromised}
          onMarkDisputed={onMarkDisputed}
          onMarkPaid={onMarkPaid}
          onSnooze={onSnooze}
          onDoNotChase={onDoNotChase}
          onClose={() => onOpenChange(false)}
          actionMeta={actionScenarioMeta(actionScenario, invoice, allInvoices, scenarioDetails, tone)}
          actionScenarioOptions={actionScenarioOptions}
        />
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
      {profile.averageDaysLate === 0 && profile.invoicesPaidLate === 0 && profile.missedPromisesCount === 0 && profile.disputesCount === 0 ? (
        <div className="mt-4 rounded-xl border border-black/10 bg-[#fbf8f1] p-3">
          <p className="text-sm text-neutral-700">Clean payment history. No missed promises or disputes recorded.</p>
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
    <div className="min-w-0 overflow-hidden">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-neutral-400 truncate">
        {label}
      </p>
      <p className="mt-1 w-full overflow-hidden text-ellipsis whitespace-nowrap text-sm font-semibold leading-5 text-neutral-950" title={value}>{value}</p>
      {detail ? <p className="mt-1 w-full overflow-hidden text-ellipsis whitespace-nowrap text-xs text-neutral-500" title={detail}>{detail}</p> : null}
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 overflow-hidden">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-neutral-400 truncate">
        {label}
      </p>
      <p className="mt-1 w-full overflow-hidden text-ellipsis whitespace-nowrap text-sm font-medium text-neutral-950" title={value}>
        {value}
      </p>
    </div>
  );
}

// Removed redundant badge functions (using zentra-ui components instead)

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

function humanLabel(value: string) {
  return value
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

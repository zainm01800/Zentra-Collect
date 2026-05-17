"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { checkAndCelebrate } from "@/components/celebration";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  FileSpreadsheet,
  FileUp,
  Plug,
  Wand2,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  LockedFeatureCard,
  UpgradePromptModal,
  UsageLimitBanner,
} from "@/components/billing-gates";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { saveImportBatchAction } from "@/actions/import";
import {
  buildInvoicesFromPreview,
  compareImportBatches,
  createImportSummary,
  getRequiredImportFields,
  importDiffStorageKey,
  importFieldLabels,
  importedInvoicesStorageKey,
  importMappingTemplateStorageKey,
  importSummaryStorageKey,
  parseCsv,
  suggestColumnMappings,
  validateImport,
  type ImportDiffOutput,
  type ImportTargetField,
} from "@/lib/import/zentra-import";
import { applyQueueSplit } from "@/lib/collections/queue-engine";
import { rankCollectionActions } from "@/lib/collections/decision-engine";
import {
  canUseFeature,
  getPlanConfig,
} from "@/lib/billing/plans";
import { useLocalAccount } from "@/lib/billing/use-local-account";
import { requirePlanAccess, toAccountState } from "@/lib/account/access";
import {
  incrementImportUsage,
  incrementSavedImportMappingUsage,
} from "@/lib/account/usage";
import { getPlanLimit } from "@/lib/account/plans";
import {
  incrementUsage,
  readLocalAccount,
  setUsage,
  toBillingAccount,
} from "@/lib/demo-auth";
import {
  readActiveClientId,
  readBookkeeperClients,
  clientInvoicesKey,
  clientSummaryKey,
  upsertBookkeeperClient,
} from "@/lib/bookkeeper-clients";
import { demoInvoices } from "@/lib/demo-data/zentra-demo-data";
import { formatCurrency, formatDate } from "@/lib/formatters";
import type { ImportValidationIssue, ImportPreviewInvoice } from "@/lib/import/zentra-import";
import { detectDuplicates, type DuplicateWarning } from "@/lib/import/duplicate-detection";

const importFields = Object.keys(importFieldLabels) as ImportTargetField[];

type ImportStep = "upload" | "mapping" | "preview" | "complete";

export function ZentraImportFlow() {
  const router = useRouter();
  const { account } = useLocalAccount();
  const [upgradePrompt, setUpgradePrompt] = useState<{
    title: string;
    description: string;
  } | null>(null);
  const [step, setStep] = useState<ImportStep>("upload");
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mappings, setMappings] = useState<
    Partial<Record<ImportTargetField, string>>
  >({});
  const [message, setMessage] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [savedTemplate, setSavedTemplate] = useState<{
    savedAt: string;
    fileName: string;
    mappings: Partial<Record<ImportTargetField, string>>;
  } | null>(null);
  const [templateApplied, setTemplateApplied] = useState(false);

  const validation = useMemo(
    () => validateImport(rows, headers, mappings),
    [rows, headers, mappings],
  );
  const errors = validation.issues.filter((issue) => issue.severity === "error");
  const warnings = validation.issues.filter(
    (issue) => issue.severity === "warning",
  );
  const sampleRows = rows.slice(0, 5);
  const requiredFields = getRequiredImportFields();
  const previewDiff = useMemo(() => {
    if (
      !account ||
      !canUseFeature(account.planId, "reimportComparison") ||
      !requirePlanAccess(account, "reimport").allowed
    ) {
      return null;
    }
    if (!validation.preview.length) return null;
    const { invoices } = buildInvoicesFromPreview(validation.preview);
    return compareImportBatches(readPreviousImportInvoices(), invoices);
  }, [account, validation.preview]);

  // Duplicate detection — runs against the user's previously-imported invoices
  // so any re-imports that look suspiciously like duplicates get flagged early.
  const duplicateWarnings = useMemo(() => {
    if (!validation.preview.length) return [];
    const previous = readPreviousImportInvoices();
    if (!previous.length) return [];
    return detectDuplicates(
      validation.preview.map((p) => ({
        invoiceNumber: p.invoiceNumber ?? "",
        customerName:  p.customerName ?? "",
        amount:        p.amountOutstanding ?? 0,
        invoiceDate:   p.invoiceDate ?? undefined,
      })),
      previous.map((inv: { invoiceNumber: string; customerName: string; amount: number; invoiceDate?: string }) => ({
        invoiceNumber: inv.invoiceNumber,
        customerName:  inv.customerName,
        amount:        inv.amount,
        invoiceDate:   inv.invoiceDate,
      })),
    );
  }, [validation.preview]);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setMessage(null);
    setFileName(file.name);

    const nameLower = file.name.toLowerCase();
    let parsed: { headers: string[]; rows: string[][] };

    if (nameLower.endsWith(".xlsx") || nameLower.endsWith(".xls")) {
      try {
        // Dynamic import keeps SheetJS out of the initial bundle
        const XLSX = await import("xlsx");
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        if (!firstSheet) {
          setMessage("This Excel file appears to be empty. Please check and try again.");
          return;
        }
        // sheet_to_json with header:1 returns rows as arrays; first row = headers
        const raw = XLSX.utils.sheet_to_json<string[]>(firstSheet, { header: 1, defval: "" });
        if (raw.length < 2) {
          setMessage("No data rows found in the Excel file. Please check the sheet has header and data rows.");
          return;
        }
        const [headerRow, ...dataRows] = raw;
        parsed = {
          headers: headerRow.map((h, i) => (String(h).trim() || `Column ${i + 1}`)),
          rows: dataRows
            .filter((r) => r.some((cell) => String(cell).trim()))
            .map((r) => r.map((cell) => String(cell ?? "").trim())),
        };
      } catch (err) {
        console.error("[import] XLSX parse error:", err);
        setMessage("Could not read this Excel file. Try exporting as CSV from your accounting tool.");
        return;
      }
    } else if (nameLower.endsWith(".csv")) {
      const text = await file.text();
      parsed = parseCsv(text);
    } else {
      setMessage("Please upload a CSV or Excel (.xlsx) file. If your accounting tool exports a different format, try exporting as CSV.");
      return;
    }

    const suggestions = suggestColumnMappings(parsed.headers);

    // Load saved template if available — try to auto-apply if columns match
    let template: typeof savedTemplate = null;
    let applied = false;
    try {
      const raw = localStorage.getItem(importMappingTemplateStorageKey);
      if (raw) {
        const t = JSON.parse(raw) as { savedAt: string; fileName: string; mappings: Partial<Record<ImportTargetField, string>> };
        template = t;
        // Check how many template columns still exist in the new file
        const headerSet = new Set(parsed.headers);
        const matchCount = Object.values(t.mappings).filter((col) => col && headerSet.has(col)).length;
        const totalMapped = Object.values(t.mappings).filter(Boolean).length;
        // Auto-apply if ≥50% of template columns match (same export structure)
        if (totalMapped > 0 && matchCount / totalMapped >= 0.5) {
          // Filter to only valid columns
          const filteredMappings = Object.fromEntries(
            Object.entries(t.mappings).map(([field, col]) => [
              field,
              col && headerSet.has(col) ? col : (suggestions[field as ImportTargetField]?.sourceColumn ?? ""),
            ]),
          );
          setMappings(filteredMappings);
          applied = true;
        }
      }
    } catch { /* ignore */ }

    setSavedTemplate(template);
    setTemplateApplied(applied);

    if (!applied) {
      setMappings(
        Object.fromEntries(
          importFields.map((field) => [field, suggestions[field]?.sourceColumn ?? ""]),
        ),
      );
    }

    setHeaders(parsed.headers);
    setRows(parsed.rows);
    setStep("mapping");
  }

  function applyTemplate() {
    if (!savedTemplate) return;
    const headerSet = new Set(headers);
    const filteredMappings = Object.fromEntries(
      Object.entries(savedTemplate.mappings).map(([field, col]) => [
        field,
        col && headerSet.has(col) ? col : "",
      ]),
    );
    setMappings((current) => ({ ...current, ...filteredMappings }));
    setTemplateApplied(true);
    setMessage("Saved mapping template applied.");
  }

  function updateMapping(field: ImportTargetField, value: string) {
    setMappings((current) => ({
      ...current,
      [field]: value === "__unmapped__" ? "" : value,
    }));
  }

  function continueToPreview() {
    if (errors.length) return;
    setStep("preview");
  }

  function saveTemplate() {
    if (!account || !canUseFeature(account.planId, "savedImportMappings")) {
      setUpgradePrompt({
        title: "Saved import mappings are not on this plan.",
        description:
          account?.planId === "demo"
            ? "Your demo account uses sample data only. Start a trial or upgrade to save mappings for live imports."
            : "Upgrade to a plan with saved import mappings to reuse this column setup.",
      });
      return;
    }

    localStorage.setItem(
      importMappingTemplateStorageKey,
      JSON.stringify({
        savedAt: new Date().toISOString(),
        fileName,
        mappings,
      }),
    );
    incrementSavedImportMappingUsage(toAccountState(account));
    setMessage("Mapping template saved for future imports in this browser.");
  }

  async function importRows() {
    if (errors.length) return;
    const user = readLocalAccount();
    const account = user ? toBillingAccount(user) : null;
    const access = requirePlanAccess(account, "csv_import");
    if (!account || !access.allowed) {
      setUpgradePrompt({
        title: "Import is not available on this account.",
        description:
          access.reason ??
          "Upgrade or start a trial before importing live invoice data.",
      });
      return;
    }

    setIsImporting(true);

    const { invoices: rawInvoices, customers } = buildInvoicesFromPreview(validation.preview);
    const accountState = toAccountState(account);
    const activeInvoiceLimit = getPlanLimit(accountState.planId, "activeInvoiceCount");

    // Split into active/waiting rather than blocking the import.
    // All invoices are ingested; only the top N (by amountOutstanding) become
    // active immediately — the rest sit in the waiting queue.
    const invoices = applyQueueSplit(rawInvoices, activeInvoiceLimit);

    const previousInvoices = readPreviousImportInvoices();
    const diff = compareImportBatches(previousInvoices, invoices);
    const plan = rankCollectionActions({ invoices, customers });
    const summary = createImportSummary(
      fileName,
      invoices,
      plan.filter((item) => item.dashboardGroup !== "do_not_chase").length,
      plan.filter((item) => item.dashboardGroup === "exceptions_to_resolve")
        .length,
      diff,
    );

    localStorage.setItem(importedInvoicesStorageKey, JSON.stringify(invoices));
    localStorage.setItem(importSummaryStorageKey, JSON.stringify(summary));
    localStorage.setItem(importDiffStorageKey, JSON.stringify(diff));
    localStorage.setItem(
      importMappingTemplateStorageKey,
      JSON.stringify({
        savedAt: new Date().toISOString(),
        fileName,
        mappings,
      }),
    );

    // If in bookkeeper mode with an active client, also save to that client's
    // dedicated storage keys so the portfolio view can show per-client data.
    const bookkeeperPlanIds = ["bookkeeper_starter", "bookkeeper_pro"];
    if (account && bookkeeperPlanIds.includes(account.planId)) {
      const activeClientId = readActiveClientId();
      if (activeClientId && activeClientId !== "all") {
        localStorage.setItem(clientInvoicesKey(activeClientId), JSON.stringify(invoices));
        localStorage.setItem(clientSummaryKey(activeClientId), JSON.stringify(summary));
        // Update the client's metadata
        const clients = readBookkeeperClients();
        const client  = clients.find((c) => c.id === activeClientId);
        if (client) {
          upsertBookkeeperClient({
            ...client,
            importedAt: summary.importedAt,
            fileName:   summary.fileName,
          });
        }
      }
    }

    incrementUsage("importBatches");
    incrementUsage("importsThisMonth");
    incrementImportUsage(accountState);
    setUsage(
      "activeInvoices",
      invoices.filter(
        (invoice) => invoice.amountOutstanding > 0 && (!invoice.queueStatus || invoice.queueStatus === "active"),
      ).length,
    );

    // Persist to Supabase — non-blocking. If it fails, pass a flag to dashboard.
    let syncFailed = false;
    try {
      const result = await saveImportBatchAction(
        {
          businessId: "default",
          source: "csv",
          fileName,
          rowCount: validation.preview.length,
          validInvoiceCount: invoices.length,
          warningCount: 0,
        },
        invoices,
      );
      if (!result?.success) syncFailed = true;
    } catch {
      syncFailed = true;
    }

    setIsImporting(false);
    setStep("complete");
    checkAndCelebrate("import");
    router.push(syncFailed ? "/dashboard?import_sync_failed=1" : "/dashboard");
  }

  return (
    <div className="space-y-8">
      <UpgradePromptModal
        open={Boolean(upgradePrompt)}
        title={upgradePrompt?.title ?? ""}
        description={upgradePrompt?.description ?? ""}
        onClose={() => setUpgradePrompt(null)}
      />
      <section>
        <div className="zn-label mb-1.5">Bring data in</div>
        <h1 className="zn-page-h1">Upload overdue invoices</h1>
        <p className="mt-1.5 max-w-[580px] text-[13.5px] text-[#6b6253] dark:text-[#8a7d69]">
          Bring in an AR ageing or unpaid invoice export, map the columns, and
          turn it into a ranked collections plan.
        </p>
      </section>

      {/* Integrations CTA — show only for non-demo users (integrations need real auth) */}
      {account?.planId !== "demo" && (
        <Link
          href="/settings/integrations"
          className="group block rounded-xl px-5 py-4 transition-colors hover:bg-[var(--zn-surface-2)]"
          style={{
            background:
              "linear-gradient(135deg, var(--zn-surface) 0%, var(--zn-bg-2) 100%)",
            border: "1px solid var(--zn-line)",
          }}
        >
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-3 min-w-0">
              <div
                className="size-10 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: "var(--zn-bg-2)", color: "var(--zn-accent)" }}
              >
                <Zap className="size-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-[14px] font-semibold" style={{ color: "var(--zn-ink)" }}>
                    Skip the CSV — connect Xero or QuickBooks directly
                  </p>
                  <span
                    className="text-[10px] font-bold tracking-[0.06em] px-1.5 py-0.5 rounded-md"
                    style={{ background: "var(--zn-accent-soft, #fef3c7)", color: "var(--zn-accent)" }}
                  >
                    NEW
                  </span>
                </div>
                <p className="text-[12.5px] mt-0.5" style={{ color: "var(--zn-ink-3)" }}>
                  One-click sync of your unpaid invoices. Read-only — Zentra never
                  writes back to your books.
                </p>
              </div>
            </div>
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold shrink-0"
              style={{ background: "var(--zn-ink)", color: "var(--zn-bg)" }}
            >
              <Plug className="size-3.5" />
              Set up integration
              <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
            </span>
          </div>
        </Link>
      )}

      {account?.planId === "demo" ? (
        <UsageLimitBanner
          title="Your demo account uses sample data only."
          description="You can test the import flow, but live invoice files are not saved permanently on Demo. Start a trial to upload your own invoices."
          actionLabel="Start trial"
        />
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        <ImportSteps current={step} />

        <div className="space-y-5">
          {message ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              {message}
            </div>
          ) : null}

          {step === "upload" ? (
            <UploadPanel onFile={handleFile} />
          ) : null}

          {step === "mapping" ? (
            <>
              {/* Saved template banner */}
              {savedTemplate && !templateApplied && (
                <div
                  className="rounded-xl px-4 py-3 flex flex-wrap items-center gap-3"
                  style={{
                    background: "var(--zn-safe-soft, #edfbf1)",
                    border: "1px solid var(--zn-safe, #22c55e)",
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <span className="text-[12.5px] font-semibold" style={{ color: "var(--zn-safe)" }}>
                      Saved mapping template available
                    </span>
                    <span className="text-[12px] ml-2" style={{ color: "var(--zn-ink-3)" }}>
                      Last used with: {savedTemplate.fileName}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={applyTemplate}
                    className="zn-pill"
                    style={{ height: 28, fontSize: 12, padding: "0 14px" }}
                  >
                    Apply template
                  </button>
                </div>
              )}
              {savedTemplate && templateApplied && (
                <div
                  className="rounded-xl px-4 py-2.5 flex items-center gap-2 text-[12.5px]"
                  style={{ background: "var(--zn-safe-soft, #edfbf1)", border: "1px solid var(--zn-safe, #22c55e)", color: "var(--zn-safe)" }}
                >
                  <span className="font-semibold">✓</span>
                  Saved mapping template applied — review the columns below.
                </div>
              )}
              <MappingPanel
                fileName={fileName}
                headers={headers}
                mappings={mappings}
                requiredFields={requiredFields}
                onMappingChange={updateMapping}
                onSaveTemplate={saveTemplate}
                canSaveTemplate={Boolean(
                  account && canUseFeature(account.planId, "savedImportMappings"),
                )}
                onContinue={continueToPreview}
                hasErrors={errors.length > 0}
              />
              <SampleRows headers={headers} rows={sampleRows} />
              <ValidationPanel issues={validation.issues} />
            </>
          ) : null}

          {step === "preview" ? (
            <>
              <PreviewPanel
                invoices={validation.preview}
                diff={previewDiff}
                canViewDiff={Boolean(
                  account && canUseFeature(account.planId, "reimportComparison"),
                )}
                warnings={warnings.length}
                errors={errors.length}
                onBack={() => setStep("mapping")}
                onImport={importRows}
                isImporting={isImporting}
              />
              <DuplicateWarningsPanel warnings={duplicateWarnings} />
              <ValidationPanel issues={validation.issues} />
            </>
          ) : null}

          {step === "complete" ? (
            <Card className="rounded-3xl border-[#d4c9ae] dark:border-[#2d2820] bg-[#faf5e8] dark:bg-[#211d17] shadow-none ring-0">
              <CardHeader>
                <CheckCircle2 className="size-8 text-[#1d1813] dark:text-[#f0e8d5]" />
                <CardTitle className="text-2xl">Import complete</CardTitle>
                <CardDescription>
                  Your dashboard is being refreshed with the new collections
                  plan.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function readPreviousImportInvoices() {
  const stored = localStorage.getItem(importedInvoicesStorageKey);
  if (!stored) return demoInvoices;

  try {
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) && parsed.length ? parsed : demoInvoices;
  } catch {
    return demoInvoices;
  }
}

function ImportSteps({ current }: { current: ImportStep }) {
  const steps: Array<{ id: ImportStep; label: string; detail: string }> = [
    { id: "upload", label: "Upload", detail: "CSV export" },
    { id: "mapping", label: "Map", detail: "Match columns" },
    { id: "preview", label: "Preview", detail: "Validate invoices" },
    { id: "complete", label: "Import", detail: "Save plan" },
  ];
  const currentIndex = steps.findIndex((step) => step.id === current);

  return (
    <Card className="h-fit rounded-2xl border-[#d4c9ae] dark:border-[#2d2820] bg-[#faf5e8] dark:bg-[#211d17] shadow-none ring-0">
      <CardHeader>
        <CardTitle>Import flow</CardTitle>
        <CardDescription>
          CSV supported. XLSX coming soon.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {steps.map((step, index) => (
          <div key={step.id} className="flex gap-3">
            <span
              className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                index <= currentIndex
                  ? "bg-[#1d1813] text-white"
                  : "bg-[#f3ecd8] dark:bg-[#28231c] text-[#8d8472] dark:text-[#6a5f4e]"
              }`}
            >
              {index + 1}
            </span>
            <div>
              <p className="text-sm font-medium text-[#1d1813] dark:text-[#f0e8d5]">{step.label}</p>
              <p className="text-xs text-[#8d8472] dark:text-[#6a5f4e]">{step.detail}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function UploadPanel({ onFile }: { onFile: (file: File | undefined) => void }) {
  return (
    <Card className="rounded-3xl border-[#d4c9ae] dark:border-[#2d2820] bg-[#faf5e8] dark:bg-[#211d17] shadow-none ring-0">
      <CardHeader>
        <div className="flex size-12 items-center justify-center rounded-2xl bg-[#f3ecd8] dark:bg-[#28231c]">
          <FileUp className="size-5 text-[#1d1813] dark:text-[#f0e8d5]" />
        </div>
        <CardTitle className="text-2xl">Upload an AR export</CardTitle>
        <CardDescription className="max-w-2xl leading-6">
          Use a customer invoice ageing, unpaid invoices, or receivables export.
          Required columns are customer, invoice number, due date, and amount
          outstanding.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <Label
          htmlFor="invoice-file"
          className="flex cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed border-[#c0b49c] dark:border-[#3d3628] bg-[#faf5e8] dark:bg-[#211d17] px-6 py-12 text-center"
        >
          <FileSpreadsheet className="size-10 text-[#1d1813] dark:text-[#f0e8d5]" />
          <span className="mt-4 text-base font-semibold text-[#1d1813] dark:text-[#f0e8d5]">
            Choose CSV file
          </span>
          <span className="mt-2 max-w-md text-sm leading-6 text-[#6b6253] dark:text-[#8a7d69]">
            CSV files supported. Excel (.xlsx) coming soon.
          </span>
          <Input
            id="invoice-file"
            type="file"
            accept=".csv,.xlsx"
            className="sr-only"
            onChange={(event) => onFile(event.target.files?.[0])}
          />
        </Label>
      </CardContent>
    </Card>
  );
}

function MappingPanel({
  fileName,
  headers,
  mappings,
  requiredFields,
  onMappingChange,
  onSaveTemplate,
  canSaveTemplate,
  onContinue,
  hasErrors,
}: {
  fileName: string;
  headers: string[];
  mappings: Partial<Record<ImportTargetField, string>>;
  requiredFields: ImportTargetField[];
  onMappingChange: (field: ImportTargetField, value: string) => void;
  onSaveTemplate: () => void;
  canSaveTemplate: boolean;
  onContinue: () => void;
  hasErrors: boolean;
}) {
  const suggestions = suggestColumnMappings(headers);

  return (
    <Card className="rounded-3xl border-[#d4c9ae] dark:border-[#2d2820] bg-[#faf5e8] dark:bg-[#211d17] shadow-none ring-0">
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-2xl">Map columns</CardTitle>
            <CardDescription className="mt-1">
              {fileName} · {headers.length} columns detected
            </CardDescription>
          </div>
          <Badge
            variant="outline"
            className="w-fit rounded-full border-[#d4c9ae] dark:border-[#2d2820] bg-[#f3ecd8] dark:bg-[#28231c]"
          >
            <Wand2 className="size-3" />
            deterministic suggestions
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {importFields.map((field) => {
          const required = requiredFields.includes(field);
          const suggestion = suggestions[field];

          return (
            <div
              key={field}
              className="grid gap-3 rounded-2xl border border-[#d4c9ae] dark:border-[#2d2820] bg-[#faf5e8] dark:bg-[#211d17] p-3 sm:grid-cols-[220px_minmax(0,1fr)_140px]"
            >
              <div>
                <p className="text-sm font-medium text-[#1d1813] dark:text-[#f0e8d5]">
                  {importFieldLabels[field]}
                  {required ? <span className="text-red-600"> *</span> : null}
                </p>
                <p className="mt-1 text-xs text-[#8d8472] dark:text-[#6a5f4e]">
                  {required ? "Required" : "Recommended"}
                </p>
              </div>
              <Select
                value={mappings[field] || "__unmapped__"}
                onValueChange={(value) => onMappingChange(field, value)}
              >
                <SelectTrigger className="w-full rounded-full bg-white dark:bg-[#211d17]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__unmapped__">Not mapped</SelectItem>
                  {headers.map((header) => (
                    <SelectItem key={`${field}-${header}`} value={header}>
                      {header}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center sm:justify-end">
                <ConfidenceBadge value={suggestion?.confidence ?? "none"} />
              </div>
            </div>
          );
        })}
        <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-end">
          <p className="mr-auto max-w-md text-xs leading-5 text-[#8d8472] dark:text-[#6a5f4e]">
            Low-confidence mappings can later be sent to a server-side
            AI-assisted mapper. This MVP does not require AI to import a file.
          </p>
            <Button
              variant="outline"
              className="rounded-full border-[#d4c9ae] dark:border-[#2d2820] bg-[#faf5e8] dark:bg-[#211d17]"
              onClick={onSaveTemplate}
            >
              {canSaveTemplate ? "Save mapping template" : "Save mapping locked"}
            </Button>
          <Button
            className="rounded-full bg-[#1d1813] px-5 text-white hover:bg-[#3d3428]"
            onClick={onContinue}
            disabled={hasErrors}
          >
            Preview invoices
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function SampleRows({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <Card className="rounded-3xl border-[#d4c9ae] dark:border-[#2d2820] bg-[#faf5e8] dark:bg-[#211d17] shadow-none ring-0">
      <CardHeader>
        <CardTitle>Sample rows</CardTitle>
        <CardDescription>
          Check the first rows before importing the full file.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto rounded-2xl border border-[#d4c9ae] dark:border-[#2d2820]">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[#f3ecd8] dark:bg-[#28231c] text-xs uppercase tracking-[0.12em] text-[#8d8472] dark:text-[#6a5f4e]">
              <tr>
                {headers.map((header) => (
                  <th key={header} className="px-3 py-3 font-medium">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-black/10 bg-[#faf5e8] dark:bg-[#211d17]">
              {rows.map((row, index) => (
                <tr key={index}>
                  {headers.map((header, cellIndex) => (
                    <td key={`${header}-${cellIndex}`} className="px-3 py-3">
                      {row[cellIndex] || "-"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function DuplicateWarningsPanel({ warnings }: { warnings: DuplicateWarning[] }) {
  if (!warnings.length) return null;

  const high = warnings.filter((w) => w.confidence === "high");
  const medium = warnings.filter((w) => w.confidence === "medium");

  return (
    <Card className="rounded-3xl border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30 shadow-none ring-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-amber-900 dark:text-amber-200">
          <AlertTriangle className="size-4" />
          Possible duplicate invoice{warnings.length === 1 ? "" : "s"} ({warnings.length})
        </CardTitle>
        <CardDescription className="text-amber-800 dark:text-amber-300">
          These rows look similar to invoices already in your workspace. Review
          before importing — you can still proceed if they really are different.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {[...high, ...medium].slice(0, 10).map((w) => (
          <div
            key={`${w.newInvoiceNumber}-${w.existingInvoiceNumber}-${w.reason}`}
            className="flex gap-3 rounded-2xl border border-amber-200 bg-white dark:border-amber-800 dark:bg-amber-950/50 p-3 text-sm text-amber-900 dark:text-amber-100"
          >
            <span
              className="inline-flex h-fit shrink-0 items-center rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.05em]"
              style={{
                background: w.confidence === "high" ? "#fef2f2" : "#fef3c7",
                color:      w.confidence === "high" ? "#991b1b" : "#92400e",
              }}
            >
              {w.confidence}
            </span>
            <span className="leading-relaxed">{w.summary}</span>
          </div>
        ))}
        {warnings.length > 10 ? (
          <p className="text-xs text-amber-700 dark:text-amber-400">
            Showing 10 of {warnings.length} duplicate warnings.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ValidationPanel({ issues }: { issues: ImportValidationIssue[] }) {
  if (!issues.length) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
        No validation issues found. Review the preview before importing.
      </div>
    );
  }

  return (
    <Card className="rounded-3xl border-[#d4c9ae] dark:border-[#2d2820] bg-[#faf5e8] dark:bg-[#211d17] shadow-none ring-0">
      <CardHeader>
        <CardTitle>Validation</CardTitle>
        <CardDescription>
          Errors must be fixed before import. Warnings can be imported with care.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {issues.slice(0, 12).map((issue) => (
          <div
            key={issue.id}
            className={`flex gap-3 rounded-2xl border p-3 text-sm ${
              issue.severity === "error"
                ? "border-red-200 bg-red-50 text-red-800"
                : "border-amber-200 bg-amber-50 text-amber-800"
            }`}
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>{issue.message}</span>
          </div>
        ))}
        {issues.length > 12 ? (
          <p className="text-xs text-[#8d8472] dark:text-[#6a5f4e]">
            Showing 12 of {issues.length} validation messages.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function PreviewPanel({
  invoices,
  diff,
  canViewDiff,
  warnings,
  errors,
  onBack,
  onImport,
  isImporting,
}: {
  invoices: ImportPreviewInvoice[];
  diff: ImportDiffOutput | null;
  canViewDiff: boolean;
  warnings: number;
  errors: number;
  onBack: () => void;
  onImport: () => void;
  isImporting: boolean;
}) {
  const total = invoices.reduce(
    (sum, invoice) => sum + invoice.amountOutstanding,
    0,
  );

  return (
    <Card className="rounded-3xl border-[#d4c9ae] dark:border-[#2d2820] bg-[#faf5e8] dark:bg-[#211d17] shadow-none ring-0">
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-2xl">Preview import</CardTitle>
            <CardDescription>
              {invoices.length} invoices · {formatCurrency(total)} outstanding ·{" "}
              {warnings} warnings
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="rounded-full border-[#d4c9ae] dark:border-[#2d2820] bg-[#faf5e8] dark:bg-[#211d17]"
              onClick={onBack}
            >
              Back
            </Button>
            <Button
              className="rounded-full bg-[#1d1813] px-5 text-white hover:bg-[#3d3428]"
              onClick={onImport}
              disabled={errors > 0 || isImporting}
            >
              {isImporting ? "Importing..." : "Import and view plan"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {diff ? <ImportDiffPreview diff={diff} /> : null}
        {!canViewDiff ? (
          <div className="mb-5">
            <LockedFeatureCard
              title="Re-import comparison is locked on this plan."
              description="Upgrade to compare this file with the previous import and see what changed."
              feature="reimportComparison"
            />
          </div>
        ) : null}
        <div className="overflow-x-auto rounded-2xl border border-[#d4c9ae] dark:border-[#2d2820]">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[#f3ecd8] dark:bg-[#28231c] text-xs uppercase tracking-[0.12em] text-[#8d8472] dark:text-[#6a5f4e]">
              <tr>
                <th className="px-3 py-3 font-medium">Customer</th>
                <th className="px-3 py-3 font-medium">Invoice</th>
                <th className="px-3 py-3 font-medium">Due</th>
                <th className="px-3 py-3 font-medium">Outstanding</th>
                <th className="px-3 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/10 bg-[#faf5e8] dark:bg-[#211d17]">
              {invoices.slice(0, 12).map((invoice) => (
                <tr key={`${invoice.rowNumber}-${invoice.invoiceNumber}`}>
                  <td className="px-3 py-3 font-medium text-[#1d1813] dark:text-[#f0e8d5]">
                    {invoice.customerName}
                  </td>
                  <td className="px-3 py-3">{invoice.invoiceNumber}</td>
                  <td className="px-3 py-3">{formatDate(invoice.dueDate)}</td>
                  <td className="px-3 py-3">
                    {formatCurrency(invoice.amountOutstanding)}
                  </td>
                  <td className="px-3 py-3">{humanLabel(invoice.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function ImportDiffPreview({ diff }: { diff: ImportDiffOutput }) {
  return (
    <div className="mb-5 rounded-2xl border border-[#d4c9ae] dark:border-[#2d2820] bg-[#faf5e8] dark:bg-[#211d17] p-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8d8472] dark:text-[#6a5f4e]">
            What changed since last import
          </p>
          <h3 className="mt-2 text-lg font-semibold text-[#1d1813] dark:text-[#f0e8d5]">
            Zentra compared this file with the previous import
          </h3>
        </div>
        <Badge variant="outline" className="w-fit rounded-full border-[#d4c9ae] dark:border-[#2d2820] bg-[#faf5e8] dark:bg-[#211d17]">
          {diff.previousInvoiceCount} previous · {diff.currentInvoiceCount} current
        </Badge>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <DiffStat label="Paid" value={formatCurrency(diff.totalPaidAmount)} />
        <DiffStat
          label="Newly overdue"
          value={`${diff.newlyOverdue.length} / ${formatCurrency(diff.totalNewlyOverdueAmount)}`}
        />
        <DiffStat
          label="Still outstanding"
          value={`${diff.stillOverdue.length} / ${formatCurrency(diff.totalStillOutstanding)}`}
        />
      </div>
      {diff.topChanges.length ? (
        <div className="mt-4 space-y-2">
          {diff.topChanges.map((change) => (
            <div
              key={change.id}
              className="rounded-xl border border-[#d4c9ae] dark:border-[#2d2820] bg-[#faf5e8] dark:bg-[#211d17] p-3 text-sm text-[#3d3428] dark:text-[#d8ccb5]"
            >
              <span className="font-medium text-[#1d1813] dark:text-[#f0e8d5]">
                {change.customerName} · {change.invoiceNumber}
              </span>{" "}
              {change.message}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function DiffStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#d4c9ae] dark:border-[#2d2820] bg-[#faf5e8] dark:bg-[#211d17] p-3">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#8d8472] dark:text-[#6a5f4e]">
        {label}
      </p>
      <p className="mt-2 text-base font-semibold text-[#1d1813] dark:text-[#f0e8d5]">{value}</p>
    </div>
  );
}

function ConfidenceBadge({ value }: { value: string }) {
  const tone =
    value === "high"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : value === "medium"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-[#d4c9ae] dark:border-[#2d2820] bg-[#f3ecd8] dark:bg-[#28231c] text-[#6b6253] dark:text-[#8a7d69]";

  return (
    <Badge variant="outline" className={`rounded-full ${tone}`}>
      {value === "none" ? "Not suggested" : `${humanLabel(value)} confidence`}
    </Badge>
  );
}

function humanLabel(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

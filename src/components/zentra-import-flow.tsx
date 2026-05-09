"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  FileSpreadsheet,
  FileUp,
  Wand2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { saveImportBatchAction } from "@/actions/import";
import { hasSupabaseBrowserConfig } from "@/lib/supabase/browser";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  LockedFeatureCard,
  UpgradePromptModal,
  UsageLimitBanner,
} from "@/components/billing-gates";
import {
  PageHeader,
  SectionCard,
  StatusBadge,
  EmptyState,
  LoadingOverlay,
} from "./zentra-ui";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { demoInvoices } from "@/lib/demo-data/zentra-demo-data";
import { formatCurrency, formatDate } from "@/lib/formatters";
import type { ImportValidationIssue, ImportPreviewInvoice } from "@/lib/import/zentra-import";

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

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setMessage(null);
    setFileName(file.name);

    if (file.name.toLowerCase().endsWith(".xlsx")) {
      setMessage(
        "XLSX support is planned next. For this MVP, please export or save the sheet as CSV.",
      );
      return;
    }

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setMessage("Please upload a CSV file. XLSX is marked as a TODO for now.");
      return;
    }

    const text = await file.text();
    const parsed = parseCsv(text);
    const suggestions = suggestColumnMappings(parsed.headers);

    setHeaders(parsed.headers);
    setRows(parsed.rows);
    setMappings(
      Object.fromEntries(
        importFields.map((field) => [field, suggestions[field]?.sourceColumn ?? ""]),
      ),
    );
    setStep("mapping");
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

  function importRows() {
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

    const { invoices, customers } = buildInvoicesFromPreview(validation.preview);
    const accountState = toAccountState(account);
    const activeInvoiceLimit = getPlanLimit(accountState.planId, "activeInvoiceCount");
    const activeInvoiceCount = invoices.filter(
      (invoice) => invoice.amountOutstanding > 0,
    ).length;
    if (
      activeInvoiceLimit !== "unlimited" &&
      activeInvoiceCount > activeInvoiceLimit
    ) {
      setIsImporting(false);
      setMessage(
        `${getPlanConfig(account.planId).name} allows ${activeInvoiceLimit} active invoices. Upgrade before importing this file.`,
      );
      setUpgradePrompt({
        title: "This file is over your active invoice limit.",
        description: `${getPlanConfig(account.planId).name} allows ${activeInvoiceLimit} active invoices. This file contains ${activeInvoiceCount}.`,
      });
      return;
    }

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

    // Save to Supabase if configured
    if (hasSupabaseBrowserConfig()) {
      try {
        await saveImportBatchAction({
          businessId: "default", // Action will handle default business creation
          source: "csv",
          fileName,
          rowCount: invoices.length,
          validInvoiceCount: invoices.length,
          warningCount: 0
        }, invoices);
      } catch (err) {
        console.error("Failed to save import to Supabase:", err);
      }
    }

    localStorage.setItem(
      importMappingTemplateStorageKey,
      JSON.stringify({
        savedAt: new Date().toISOString(),
        fileName,
        mappings,
      }),
    );
    incrementUsage("importBatches");
    incrementUsage("importsThisMonth");
    incrementImportUsage(accountState);
    setUsage(
      "activeInvoices",
      invoices.filter((invoice) => invoice.amountOutstanding > 0).length,
    );

    window.setTimeout(() => {
      setIsImporting(false);
      setStep("complete");
      router.push("/dashboard");
    }, 300);
  }

  return (
    <div className="space-y-8">
      <UpgradePromptModal
        open={Boolean(upgradePrompt)}
        title={upgradePrompt?.title ?? ""}
        description={upgradePrompt?.description ?? ""}
        onClose={() => setUpgradePrompt(null)}
      />
      <PageHeader
        title="Upload overdue invoices"
        description="Bring in an AR ageing or unpaid invoice export, map the columns, and turn it into a ranked collections plan."
      />

      {account?.planId === "demo" ? (
        <UsageLimitBanner
          title="Your demo account uses sample data only."
          description="You can test the import flow, but live invoice files are not saved permanently on Demo. Start a trial to upload your own invoices."
          actionLabel="Start trial"
        />
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)] items-start">
        <ImportSteps current={step} />

        <div className="space-y-5 w-full">
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
              <ValidationPanel issues={validation.issues} />
            </>
          ) : null}

          {step === "complete" ? (
            <div className="flex min-h-[40vh] items-center justify-center">
              <LoadingOverlay message="Building your chase plan..." />
            </div>
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
    <SectionCard title="Import journey" description="CSV supported currently.">
      <div className="space-y-4">
        {steps.map((step, index) => {
          const isDone = index < currentIndex;
          const isCurrent = index === currentIndex;
          return (
            <div key={step.id} className="flex items-center gap-4">
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-black transition-all",
                  isDone ? "bg-emerald-500 text-white" : isCurrent ? "bg-neutral-950 text-white shadow-lg scale-110" : "bg-neutral-200/60 text-neutral-500"
                )}
              >
                {isDone ? <CheckCircle2 className="size-4" /> : index + 1}
              </span>
              <div>
                <p className={cn("text-sm font-bold", isCurrent ? "text-neutral-950" : "text-neutral-500")}>
                  {step.label}
                </p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">{step.detail}</p>
              </div>
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}

function UploadPanel({ onFile }: { onFile: (file: File | undefined) => void }) {
  return (
    <SectionCard>
      <div className="flex flex-col items-center py-8">
        <div className="mb-6 flex size-16 items-center justify-center rounded-[2rem] bg-neutral-950 text-white shadow-xl">
          <FileUp className="size-8" />
        </div>
        <h2 className="text-2xl font-black tracking-tight text-neutral-950">Upload an AR export</h2>
        <p className="mt-2 max-w-md text-center text-sm font-medium text-neutral-500 leading-relaxed">
          Choose a CSV file containing your unpaid invoices. We need customer names, invoice numbers, due dates, and amounts.
        </p>

        <Label
          htmlFor="invoice-file"
          className="group mt-10 flex w-full cursor-pointer flex-col items-center justify-center rounded-[2.5rem] border border-black/10 bg-neutral-50/50 p-12 transition-all hover:border-black/20 hover:bg-white hover:shadow-xl"
        >
          <FileSpreadsheet className="size-14 text-neutral-300 transition-colors group-hover:text-neutral-950" />
          <span className="mt-5 text-lg font-black uppercase tracking-widest text-neutral-950">
            Choose CSV file
          </span>
          <Input
            id="invoice-file"
            type="file"
            accept=".csv,.xlsx"
            className="sr-only"
            onChange={(event) => onFile(event.target.files?.[0])}
          />
        </Label>
      </div>
    </SectionCard>
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
    <SectionCard
      title="Map columns"
      description={`${fileName} · ${headers.length} columns detected`}
      actions={
        <div className="flex items-center gap-2 rounded-full border border-black/5 bg-neutral-100/50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-neutral-500">
          <Wand2 className="size-3" />
          Suggestions active
        </div>
      }
    >
      <div className="space-y-3">
        {importFields.map((field) => {
          const required = requiredFields.includes(field);
          const suggestion = suggestions[field];

          return (
            <div
              key={field}
              className="grid gap-4 rounded-2xl border border-black/5 bg-neutral-50/50 p-4 sm:grid-cols-[200px_minmax(0,1fr)_120px]"
            >
              <div>
                <p className="text-sm font-black text-neutral-950">
                  {importFieldLabels[field]}
                  {required ? <span className="text-rose-600"> *</span> : null}
                </p>
                <p className="mt-0.5 text-[10px] font-bold uppercase tracking-widest text-neutral-400">
                  {required ? "Required" : "Optional"}
                </p>
              </div>
              <Select
                value={mappings[field] || "__unmapped__"}
                onValueChange={(value) => onMappingChange(field, value)}
              >
                <SelectTrigger className="w-full rounded-full border-black/5 bg-white text-sm font-bold shadow-sm ring-black/5 transition-all focus:ring-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-black/5 shadow-xl">
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
        <div className="mt-8 flex flex-col gap-4 border-t border-black/5 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-md text-[11px] font-medium leading-relaxed text-neutral-400">
            Zentra uses deterministic matching for suggestions. AI-assisted mapping is available on Pro plans for complex files.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              className="h-11 rounded-full border-black/5 bg-white px-6 text-xs font-black uppercase tracking-widest text-neutral-500 transition-all hover:bg-neutral-50 hover:text-neutral-950"
              onClick={onSaveTemplate}
            >
              {canSaveTemplate ? "Save template" : "Template locked"}
            </Button>
            <Button
              className="h-11 rounded-full bg-neutral-950 px-8 text-xs font-black uppercase tracking-widest text-white shadow-lg transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
              onClick={onContinue}
              disabled={hasErrors}
            >
              Preview
              <ArrowRight className="ml-2 size-4" />
            </Button>
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

function SampleRows({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <SectionCard title="Sample rows" description="First few rows from your file.">
      <div className="overflow-x-auto rounded-2xl border border-black/5">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-neutral-50 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">
            <tr>
              {headers.map((header) => (
                <th key={header} className="whitespace-nowrap px-4 py-4 font-black">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5 bg-white">
            {rows.map((row, index) => (
              <tr key={index} className="transition-colors hover:bg-neutral-50/50">
                {headers.map((header, cellIndex) => (
                  <td key={`${header}-${cellIndex}`} className="whitespace-nowrap px-4 py-4 font-medium text-neutral-600">
                    {row[cellIndex] || "-"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
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
    <SectionCard title="Validation" description="Fix errors before you can import.">
      <div className="space-y-3">
        {issues.slice(0, 10).map((issue) => (
          <div
            key={issue.id}
            className={cn(
              "flex gap-4 rounded-2xl border p-4 text-sm font-medium transition-all",
              issue.severity === "error"
                ? "border-rose-100 bg-rose-50/50 text-rose-900"
                : "border-amber-100 bg-amber-50/50 text-amber-900"
            )}
          >
            <AlertTriangle className={cn("mt-0.5 size-4 shrink-0", issue.severity === "error" ? "text-rose-500" : "text-amber-500")} />
            <span>{issue.message}</span>
          </div>
        ))}
        {issues.length > 10 ? (
          <p className="px-2 text-[10px] font-bold uppercase tracking-widest text-neutral-400">
            + {issues.length - 10} more issues detected
          </p>
        ) : null}
      </div>
    </SectionCard>
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
    <SectionCard
      title="Preview invoices"
      description={`${invoices.length} invoices detected · ${formatCurrency(total)} outstanding`}
      actions={
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="h-9 rounded-full border-black/5 bg-white px-5 text-[10px] font-black uppercase tracking-widest text-neutral-500 hover:text-neutral-950"
            onClick={onBack}
          >
            Back
          </Button>
          <Button
            className="h-9 rounded-full bg-neutral-950 px-6 text-[10px] font-black uppercase tracking-widest text-white shadow-lg transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
            onClick={onImport}
            disabled={errors > 0 || isImporting}
          >
            {isImporting ? "Importing..." : "Process Import"}
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {diff ? <ImportDiffPreview diff={diff} /> : null}
        {!canViewDiff ? (
          <LockedFeatureCard
            title="Re-import comparison is locked"
            description="Upgrade to compare this file with the previous import and see what changed."
            feature="reimportComparison"
          />
        ) : null}
        
        <div className="overflow-hidden rounded-2xl border border-black/5">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-neutral-50 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">
              <tr>
                <th className="px-4 py-4 font-black">Customer</th>
                <th className="px-4 py-4 font-black">Invoice</th>
                <th className="px-4 py-4 font-black text-right">Outstanding</th>
                <th className="px-4 py-4 font-black">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5 bg-white">
              {invoices.slice(0, 10).map((invoice) => (
                <tr key={`${invoice.rowNumber}-${invoice.invoiceNumber}`} className="transition-colors hover:bg-neutral-50/50">
                  <td className="px-4 py-4 font-black text-neutral-950">
                    {invoice.customerName}
                  </td>
                  <td className="px-4 py-4 font-bold text-neutral-500">
                    {invoice.invoiceNumber}
                    <span className="ml-2 text-[10px] text-neutral-400">Due {formatDate(invoice.dueDate)}</span>
                  </td>
                  <td className="px-4 py-4 text-right font-black text-neutral-950">
                    {formatCurrency(invoice.amountOutstanding)}
                  </td>
                  <td className="px-4 py-4">
                     <StatusBadge status={invoice.status} variant="neutral" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {invoices.length > 10 && (
            <div className="bg-neutral-50 p-3 text-center text-[10px] font-bold uppercase tracking-widest text-neutral-400">
              + {invoices.length - 10} more invoices in this file
            </div>
          )}
        </div>
      </div>
    </SectionCard>
  );
}

function ImportDiffPreview({ diff }: { diff: ImportDiffOutput }) {
  return (
    <div className="mb-5 rounded-2xl border border-black/10 bg-[#fbf8f1] p-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">
            What changed since last import
          </p>
          <h3 className="mt-2 text-lg font-semibold text-neutral-950">
            Zentra compared this file with the previous import
          </h3>
        </div>
        <Badge variant="outline" className="w-fit rounded-full border-black/10 bg-white/70">
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
              className="rounded-xl border border-black/10 bg-white/70 p-3 text-sm text-neutral-700"
            >
              <span className="font-medium text-neutral-950">
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
    <div className="rounded-xl border border-black/10 bg-white/70 p-3">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-neutral-500">
        {label}
      </p>
      <p className="mt-2 text-base font-semibold text-neutral-950">{value}</p>
    </div>
  );
}

function ConfidenceBadge({ value }: { value: string }) {
  const tone =
    value === "high"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : value === "medium"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-black/10 bg-neutral-100 text-neutral-600";

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

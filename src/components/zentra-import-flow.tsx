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
import { demoInvoices } from "@/lib/demo-data/zentra-demo-data";
import { formatCurrency, formatDate } from "@/lib/formatters";
import type { ImportValidationIssue, ImportPreviewInvoice } from "@/lib/import/zentra-import";

const importFields = Object.keys(importFieldLabels) as ImportTargetField[];

type ImportStep = "upload" | "mapping" | "preview" | "complete";

export function ZentraImportFlow() {
  const router = useRouter();
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
    if (!validation.preview.length) return null;
    const { invoices } = buildInvoicesFromPreview(validation.preview);
    return compareImportBatches(readPreviousImportInvoices(), invoices);
  }, [validation.preview]);

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
    localStorage.setItem(
      importMappingTemplateStorageKey,
      JSON.stringify({
        savedAt: new Date().toISOString(),
        fileName,
        mappings,
      }),
    );
    setMessage("Mapping template saved for future imports in this browser.");
  }

  function importRows() {
    if (errors.length) return;
    setIsImporting(true);

    const { invoices, customers } = buildInvoicesFromPreview(validation.preview);
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

    window.setTimeout(() => {
      setIsImporting(false);
      setStep("complete");
      router.push("/dashboard");
    }, 300);
  }

  return (
    <div className="space-y-8">
      <section className="border-b border-black/10 pb-7">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
          Import
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-normal text-neutral-950 sm:text-5xl">
          Upload overdue invoices
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-neutral-600">
          Bring in an AR ageing or unpaid invoice export, map the columns, and
          turn it into a ranked collections plan.
        </p>
      </section>

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
              <MappingPanel
                fileName={fileName}
                headers={headers}
                mappings={mappings}
                requiredFields={requiredFields}
                onMappingChange={updateMapping}
                onSaveTemplate={saveTemplate}
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
            <Card className="rounded-3xl border-black/10 bg-white/75 shadow-none ring-0">
              <CardHeader>
                <CheckCircle2 className="size-8 text-neutral-950" />
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
    <Card className="h-fit rounded-2xl border-black/10 bg-white/70 shadow-none ring-0">
      <CardHeader>
        <CardTitle>Import flow</CardTitle>
        <CardDescription>
          CSV first. XLSX support is a planned parser upgrade.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {steps.map((step, index) => (
          <div key={step.id} className="flex gap-3">
            <span
              className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                index <= currentIndex
                  ? "bg-neutral-950 text-white"
                  : "bg-neutral-100 text-neutral-500"
              }`}
            >
              {index + 1}
            </span>
            <div>
              <p className="text-sm font-medium text-neutral-950">{step.label}</p>
              <p className="text-xs text-neutral-500">{step.detail}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function UploadPanel({ onFile }: { onFile: (file: File | undefined) => void }) {
  return (
    <Card className="rounded-3xl border-black/10 bg-white/75 shadow-none ring-0">
      <CardHeader>
        <div className="flex size-12 items-center justify-center rounded-2xl bg-[#f7f2ea]">
          <FileUp className="size-5 text-neutral-950" />
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
          className="flex cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed border-black/20 bg-[#fbf8f1] px-6 py-12 text-center"
        >
          <FileSpreadsheet className="size-10 text-neutral-950" />
          <span className="mt-4 text-base font-semibold text-neutral-950">
            Choose CSV file
          </span>
          <span className="mt-2 max-w-md text-sm leading-6 text-neutral-600">
            CSV is supported now. XLSX can be added later with a spreadsheet
            parser dependency.
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
  onContinue,
  hasErrors,
}: {
  fileName: string;
  headers: string[];
  mappings: Partial<Record<ImportTargetField, string>>;
  requiredFields: ImportTargetField[];
  onMappingChange: (field: ImportTargetField, value: string) => void;
  onSaveTemplate: () => void;
  onContinue: () => void;
  hasErrors: boolean;
}) {
  const suggestions = suggestColumnMappings(headers);

  return (
    <Card className="rounded-3xl border-black/10 bg-white/75 shadow-none ring-0">
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
            className="w-fit rounded-full border-black/10 bg-[#f7f2ea]"
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
              className="grid gap-3 rounded-2xl border border-black/10 bg-[#fbf8f1] p-3 sm:grid-cols-[220px_minmax(0,1fr)_140px]"
            >
              <div>
                <p className="text-sm font-medium text-neutral-950">
                  {importFieldLabels[field]}
                  {required ? <span className="text-red-600"> *</span> : null}
                </p>
                <p className="mt-1 text-xs text-neutral-500">
                  {required ? "Required" : "Recommended"}
                </p>
              </div>
              <Select
                value={mappings[field] || "__unmapped__"}
                onValueChange={(value) => onMappingChange(field, value)}
              >
                <SelectTrigger className="w-full rounded-full bg-white">
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
          <p className="mr-auto max-w-md text-xs leading-5 text-neutral-500">
            Low-confidence mappings can later be sent to a server-side
            AI-assisted mapper. This MVP does not require AI to import a file.
          </p>
          <Button
            variant="outline"
            className="rounded-full border-black/10 bg-white/70"
            onClick={onSaveTemplate}
          >
            Save mapping template
          </Button>
          <Button
            className="rounded-full bg-neutral-950 px-5 text-white hover:bg-neutral-800"
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
    <Card className="rounded-3xl border-black/10 bg-white/75 shadow-none ring-0">
      <CardHeader>
        <CardTitle>Sample rows</CardTitle>
        <CardDescription>
          Check the first rows before importing the full file.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto rounded-2xl border border-black/10">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[#f7f2ea] text-xs uppercase tracking-[0.12em] text-neutral-500">
              <tr>
                {headers.map((header) => (
                  <th key={header} className="px-3 py-3 font-medium">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-black/10 bg-white/60">
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

function ValidationPanel({ issues }: { issues: ImportValidationIssue[] }) {
  if (!issues.length) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
        No validation issues found. Review the preview before importing.
      </div>
    );
  }

  return (
    <Card className="rounded-3xl border-black/10 bg-white/75 shadow-none ring-0">
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
          <p className="text-xs text-neutral-500">
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
  warnings,
  errors,
  onBack,
  onImport,
  isImporting,
}: {
  invoices: ImportPreviewInvoice[];
  diff: ImportDiffOutput | null;
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
    <Card className="rounded-3xl border-black/10 bg-white/75 shadow-none ring-0">
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
              className="rounded-full border-black/10 bg-white/70"
              onClick={onBack}
            >
              Back
            </Button>
            <Button
              className="rounded-full bg-neutral-950 px-5 text-white hover:bg-neutral-800"
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
        <div className="overflow-x-auto rounded-2xl border border-black/10">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[#f7f2ea] text-xs uppercase tracking-[0.12em] text-neutral-500">
              <tr>
                <th className="px-3 py-3 font-medium">Customer</th>
                <th className="px-3 py-3 font-medium">Invoice</th>
                <th className="px-3 py-3 font-medium">Due</th>
                <th className="px-3 py-3 font-medium">Outstanding</th>
                <th className="px-3 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/10 bg-white/60">
              {invoices.slice(0, 12).map((invoice) => (
                <tr key={`${invoice.rowNumber}-${invoice.invoiceNumber}`}>
                  <td className="px-3 py-3 font-medium text-neutral-950">
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

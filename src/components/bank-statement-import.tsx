"use client";

/**
 * src/components/bank-statement-import.tsx
 *
 * Manual bank statement import. Accepts exports from all major UK banks
 * (Barclays, HSBC, Lloyds, NatWest, Monzo, Starling, Revolut, Halifax,
 * Santander, RBS, PayPal, Amex) and auto-detects the format.
 *
 * Supported file types:
 *   - .csv  — comma-separated (default for most banks)
 *   - .txt  — same as CSV, just renamed
 *   - .tsv  — tab-separated (some bank exports)
 *   - .xlsx — Excel workbook (common for HSBC, Barclays business)
 *   - .xls  — legacy Excel
 *
 * All file types are normalised to CSV in-browser, then run through the
 * same auto-detect parser. Stored in localStorage under "zentra.bankStatement.v1".
 */

import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Upload, FileText, CheckCircle2, AlertTriangle, X, Info, Landmark } from "lucide-react";
import { detectBankPreset } from "@/lib/banking/bank-presets";

// ── Supported file types ──────────────────────────────────────────────────────

const SUPPORTED_EXTENSIONS = [".csv", ".txt", ".tsv", ".xlsx", ".xls"] as const;

function hasSupportedExtension(name: string): boolean {
  const lower = name.toLowerCase();
  return SUPPORTED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/** Convert any supported file type to a CSV string for the parser. */
async function fileToCsvText(file: File): Promise<string> {
  const lower = file.name.toLowerCase();

  // Excel workbooks → first sheet → CSV
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) return "";
    const sheet = workbook.Sheets[firstSheetName];
    return XLSX.utils.sheet_to_csv(sheet);
  }

  // Tab-separated → swap tabs for commas (quoting any commas already in cells)
  if (lower.endsWith(".tsv")) {
    const text = await file.text();
    return text
      .split(/\r?\n/)
      .map((line) =>
        line
          .split("\t")
          .map((cell) =>
            cell.includes(",") || cell.includes('"')
              ? `"${cell.replace(/"/g, '""')}"`
              : cell,
          )
          .join(","),
      )
      .join("\n");
  }

  // Default: read as text (CSV / TXT)
  return file.text();
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ParsedTransaction {
  date:        string;   // YYYY-MM-DD
  description: string;
  amount:      number;   // positive = credit, negative = debit
}

// ── CSV parser ────────────────────────────────────────────────────────────────

function parseCSVRow(line: string): string[] {
  const cols: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuotes = !inQuotes; }
    else if (ch === "," && !inQuotes) { cols.push(cur.trim()); cur = ""; }
    else { cur += ch; }
  }
  cols.push(cur.trim());
  return cols;
}

function tryParseDate(raw: string): string | null {
  if (!raw) return null;
  const dmy = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  const ymd = raw.match(/^(\d{4})[\/\-](\d{2})[\/\-](\d{2})$/);
  if (ymd) return `${ymd[1]}-${ymd[2]}-${ymd[3]}`;
  const months: Record<string, string> = {
    jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
    jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
  };
  const dmy2 = raw.match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/);
  if (dmy2) {
    const m = months[dmy2[2].toLowerCase()];
    if (m) return `${dmy2[3]}-${m}-${dmy2[1].padStart(2, "0")}`;
  }
  return null;
}

function colIdx(headers: string[], ...candidates: string[]): number {
  for (const candidate of candidates) {
    const idx = headers.findIndex(
      (h) => h.toLowerCase().replace(/[^a-z]/g, "").includes(candidate.toLowerCase().replace(/[^a-z]/g, "")),
    );
    if (idx !== -1) return idx;
  }
  return -1;
}

function toAmount(raw: string): number {
  return parseFloat(raw.replace(/[£,\s]/g, "")) || 0;
}

// ── Main parser ───────────────────────────────────────────────────────────────

export function parseStatement(
  csv: string,
  fileName = "",
): { rows: ParsedTransaction[]; warning?: string; detectedBank?: string } {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { rows: [], warning: "File appears empty." };

  // Detect Santander statement-document format (bank letters / full statement PDF export)
  // These contain account info, news, legal text — but NOT parseable transaction rows.
  const first200 = lines.slice(0, 20).join(" ").toLowerCase();
  const isSantanderDoc =
    (first200.includes("santander") || fileName.toLowerCase().includes("santander")) &&
    (first200.includes("total money in") || first200.includes("balance brought forward") ||
     first200.includes("account summary") || first200.includes("news and information"));
  if (isSantanderDoc) {
    return {
      rows: [],
      warning:
        "This looks like a Santander statement letter (PDF export), not a transaction export. " +
        "To get the right file: log in to Santander Online Banking → My Accounts → select account → " +
        "Export → choose CSV → pick a date range. That gives a clean transaction list.",
      detectedBank: "Santander",
    };
  }

  // Find header row — scan up to 60 lines to handle banks with large preambles
  let headerIdx = 0;
  let rawHeaders: string[] = [];
  for (let i = 0; i < Math.min(60, lines.length); i++) {
    const cols = parseCSVRow(lines[i]);
    if (cols.length >= 3 && colIdx(cols, "date") !== -1) {
      rawHeaders = cols.map((h) => h.replace(/^"|"$/g, ""));
      headerIdx = i;
      break;
    }
  }
  if (rawHeaders.length === 0) {
    // Provide a bank-specific tip if we can identify the bank from the filename
    const lowerFile = fileName.toLowerCase();
    const bankHint = lowerFile.includes("santander") ? " For Santander: use Account → Export → CSV (not Download Statement)."
      : lowerFile.includes("natwest") ? " For NatWest: go to Statements → Export → CSV."
      : lowerFile.includes("hsbc")    ? " For HSBC: go to View Transactions → Download → CSV."
      : lowerFile.includes("lloyds")  ? " For Lloyds: go to Transactions → Export → CSV."
      : lowerFile.includes("barclays")? " For Barclays: go to Statement → Download → CSV."
      : lowerFile.includes("halifax") ? " For Halifax: go to Statements → Download → CSV."
      : "";
    return { rows: [], warning: `Could not find a header row with a date column.${bankHint} Make sure you export a transaction list (not a PDF or statement letter).` };
  }

  // Try bank preset detection
  const detection = detectBankPreset(rawHeaders, fileName);
  const headers = rawHeaders.map((h) => h.toLowerCase());

  let dateCol: number;
  let descCol: number;
  let debitCol  = -1;
  let creditCol = -1;
  let amtCol    = -1;

  if (detection) {
    const { preset } = detection;
    dateCol  = rawHeaders.indexOf(preset.mappings.date);
    descCol  = rawHeaders.indexOf(preset.mappings.merchant ?? preset.mappings.description);
    if (descCol === -1) descCol = rawHeaders.indexOf(preset.mappings.description);
    if (preset.debitColumn)     debitCol  = rawHeaders.indexOf(preset.debitColumn);
    if (preset.creditColumn)    creditCol = rawHeaders.indexOf(preset.creditColumn);
    if (preset.mappings.amount) amtCol    = rawHeaders.indexOf(preset.mappings.amount);
  } else {
    dateCol   = colIdx(headers, "date", "transactiondate", "valuedate");
    descCol   = colIdx(headers, "description", "narrative", "details", "reference", "payee", "merchant", "memo", "particulars", "counterparty", "name");
    debitCol  = colIdx(headers, "debit", "debitamount", "withdrawal", "paidout", "out");
    creditCol = colIdx(headers, "credit", "creditamount", "deposit", "paidin", "in");
    amtCol    = colIdx(headers, "amount", "value", "nettamount", "net");
  }

  if (dateCol === -1) return { rows: [], warning: "No date column found." };
  if (descCol === -1) return { rows: [], warning: "No description column found." };
  if (debitCol === -1 && creditCol === -1 && amtCol === -1) {
    return { rows: [], warning: "No amount column found." };
  }

  const statusFilter = detection?.preset.statusFilter;
  const statusColIdx = statusFilter
    ? rawHeaders.findIndex((h) => h === statusFilter.column)
    : -1;

  const rows: ParsedTransaction[] = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const cols = parseCSVRow(lines[i]).map((c) => c.replace(/^"|"$/g, "").trim());
    if (cols.length < 2) continue;

    if (statusFilter && statusColIdx !== -1) {
      if ((cols[statusColIdx] ?? "") !== statusFilter.value) continue;
    }

    const date = tryParseDate(cols[dateCol] ?? "");
    if (!date) continue;
    const desc = cols[descCol] ?? "";
    if (!desc) continue;

    let amount = 0;
    if (amtCol !== -1 && cols[amtCol]) {
      amount = toAmount(cols[amtCol]);
    } else {
      const debit  = debitCol  !== -1 ? toAmount(cols[debitCol]  ?? "") : 0;
      const credit = creditCol !== -1 ? toAmount(cols[creditCol] ?? "") : 0;
      amount = credit - debit;
    }

    rows.push({ date, description: desc, amount });
  }

  return { rows, detectedBank: detection?.preset.name };
}

// ── localStorage keys ─────────────────────────────────────────────────────────

export const BANK_STATEMENT_KEY      = "zentra.bankStatement.v1";
export const BANK_STATEMENT_BANK_KEY = "zentra.bankStatement.bank.v1";

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  onImported?: (rows: ParsedTransaction[]) => void;
  /** Called when the user clears/resets the import component. */
  onCleared?:  () => void;
}

export function BankStatementImport({ onImported, onCleared }: Props) {
  const inputRef                        = useRef<HTMLInputElement>(null);
  const [preview, setPreview]           = useState<ParsedTransaction[] | null>(null);
  const [warning, setWarning]           = useState<string | null>(null);
  const [fileName, setFileName]         = useState<string | null>(null);
  const [detectedBank, setDetectedBank] = useState<string | null>(null);
  const [saved, setSaved]               = useState(false);
  const [dragging, setDragging]         = useState(false);

  async function processFile(file: File) {
    setFileName(file.name);
    setSaved(false);
    setWarning(null);
    setPreview(null);
    setDetectedBank(null);

    if (!hasSupportedExtension(file.name)) {
      setWarning(`Unsupported file type. Use CSV, Excel (.xlsx / .xls), TSV, or TXT.`);
      return;
    }

    try {
      const text = await fileToCsvText(file);
      const { rows, warning: w, detectedBank: bank } = parseStatement(text, file.name);
      if (w) setWarning(w);
      if (bank) setDetectedBank(bank);
      setPreview(rows.length > 0 ? rows : null);
      if (rows.length === 0 && !w) setWarning("No valid transactions found in this file.");
    } catch (err) {
      console.error("[bank-statement-import] parse failed:", err);
      setWarning(
        err instanceof Error
          ? `Could not read this file: ${err.message}`
          : "Could not read this file. Try saving it as CSV and re-uploading.",
      );
    }
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void processFile(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && hasSupportedExtension(file.name)) void processFile(file);
  }

  function handleSave() {
    if (!preview) return;
    localStorage.setItem(BANK_STATEMENT_KEY, JSON.stringify(preview));
    if (detectedBank) localStorage.setItem(BANK_STATEMENT_BANK_KEY, detectedBank);
    else localStorage.removeItem(BANK_STATEMENT_BANK_KEY);
    setSaved(true);
    onImported?.(preview);
  }

  function handleClear() {
    setPreview(null);
    setFileName(null);
    setWarning(null);
    setDetectedBank(null);
    setSaved(false);
    localStorage.removeItem(BANK_STATEMENT_KEY);
    localStorage.removeItem(BANK_STATEMENT_BANK_KEY);
    if (inputRef.current) inputRef.current.value = "";
    onCleared?.();
  }

  const credits = preview?.filter((r) => r.amount > 0).length ?? 0;
  const debits  = preview?.filter((r) => r.amount < 0).length ?? 0;

  return (
    <div className="space-y-4">

      {/* Drop zone */}
      {!preview && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className="flex flex-col items-center gap-3 rounded-[12px] border-2 border-dashed px-6 py-10 text-center cursor-pointer transition-colors"
          style={{
            borderColor: dragging ? "var(--zn-accent)" : "var(--zn-line)",
            background:  dragging ? "var(--zn-surface-2)" : "transparent",
          }}
        >
          <div className="size-10 rounded-xl flex items-center justify-center" style={{ background: "var(--zn-bg-2)" }}>
            <Upload className="size-5" style={{ color: "var(--zn-ink-3)" }} />
          </div>
          <div>
            <p className="text-[14px] font-semibold" style={{ color: "var(--zn-ink)" }}>
              Drop your bank statement here
            </p>
            <p className="mt-1 text-[12.5px]" style={{ color: "var(--zn-ink-3)" }}>
              or click to browse · CSV, Excel (.xlsx / .xls), TSV or TXT · auto-detects Monzo, Starling, Revolut, Barclays, HSBC, Lloyds, NatWest, Halifax, Santander, RBS, PayPal, Amex
            </p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.txt,.tsv,.xlsx,.xls,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,text/tab-separated-values,text/plain"
            className="hidden"
            onChange={handleFile}
          />
        </div>
      )}

      {/* Warning */}
      {warning && (
        <div
          className="flex items-start gap-2 rounded-[10px] px-3.5 py-3"
          style={{ background: "var(--zn-warn-soft)", border: "1px solid var(--zn-warn)" }}
        >
          <AlertTriangle className="size-3.5 flex-shrink-0 mt-0.5" style={{ color: "var(--zn-warn)" }} />
          <div>
            <p className="text-[12.5px] font-medium" style={{ color: "var(--zn-warn)" }}>{warning}</p>
            <button type="button" onClick={handleClear} className="text-[11.5px] mt-1 underline" style={{ color: "var(--zn-warn)" }}>
              Try a different file
            </button>
          </div>
        </div>
      )}

      {/* Preview */}
      {preview && preview.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <FileText className="size-3.5" style={{ color: "var(--zn-ink-3)" }} />
              <span className="text-[12.5px] font-medium" style={{ color: "var(--zn-ink-2)" }}>
                {fileName} — {preview.length} transactions ({credits} in, {debits} out)
              </span>
              {detectedBank && (
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold"
                  style={{ background: "var(--zn-safe-soft)", color: "var(--zn-safe)" }}
                >
                  <Landmark className="size-2.5" />
                  {detectedBank} detected
                </span>
              )}
            </div>
            <button type="button" onClick={handleClear} className="rounded p-0.5 hover:bg-[#ece3cc] dark:hover:bg-[#28231c] transition-colors" aria-label="Clear">
              <X className="size-3.5" style={{ color: "var(--zn-ink-3)" }} />
            </button>
          </div>

          <div className="rounded-[10px] overflow-hidden" style={{ border: "1px solid var(--zn-line-soft)" }}>
            {preview.slice(0, 8).map((row, i) => (
              <div
                key={i}
                className="flex items-center justify-between px-4 py-2.5"
                style={{ borderTop: i > 0 ? "1px solid var(--zn-line-soft)" : "none", background: "var(--zn-surface)" }}
              >
                <div className="min-w-0">
                  <p className="text-[12.5px] font-medium truncate" style={{ color: "var(--zn-ink)" }}>{row.description}</p>
                  <p className="text-[11px] mt-0.5" style={{ color: "var(--zn-ink-3)" }}>
                    {new Date(row.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>
                <p
                  className="text-[13px] font-semibold tabular-nums flex-shrink-0 ml-4"
                  style={{ color: row.amount >= 0 ? "var(--zn-safe)" : "var(--zn-risk)" }}
                >
                  {row.amount >= 0 ? "+" : ""}
                  {new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(row.amount)}
                </p>
              </div>
            ))}
            {preview.length > 8 && (
              <div className="px-4 py-2.5 text-[12px] text-center" style={{ color: "var(--zn-ink-3)", borderTop: "1px solid var(--zn-line-soft)", background: "var(--zn-surface)" }}>
                +{preview.length - 8} more transactions
              </div>
            )}
          </div>

          {saved ? (
            <div className="flex items-center gap-2 rounded-[8px] px-3 py-2" style={{ background: "var(--zn-safe-soft)", border: "1px solid var(--zn-safe)" }}>
              <CheckCircle2 className="size-3.5" style={{ color: "var(--zn-safe)" }} />
              <span className="text-[12.5px] font-medium" style={{ color: "var(--zn-safe)" }}>
                {preview.length} transactions imported — shown in the feed below
              </span>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleSave}
              className="zn-pill w-full justify-center"
              style={{ background: "var(--zn-ink)", color: "var(--zn-surface)" }}
            >
              Import {preview.length} transactions
            </button>
          )}
        </div>
      )}

      {/* Format hint */}
      <div className="flex items-start gap-2 rounded-[8px] px-3 py-2.5" style={{ background: "var(--zn-surface-2)", border: "1px solid var(--zn-line-soft)" }}>
        <Info className="size-3.5 flex-shrink-0 mt-0.5" style={{ color: "var(--zn-ink-3)" }} />
        <p className="text-[11.5px] leading-[1.6]" style={{ color: "var(--zn-ink-3)" }}>
          Export a CSV from your bank&apos;s online portal (usually under Statements or Transactions).
          Zentra auto-detects the format for all major UK banks — no manual column mapping needed.
        </p>
      </div>
    </div>
  );
}

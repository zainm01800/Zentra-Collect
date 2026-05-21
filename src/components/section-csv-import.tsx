"use client";

/**
 * section-csv-import.tsx
 *
 * A lightweight CSV / XLSX import modal used by Expenses, Mileage, Bills,
 * and Quotes. Accepts a file, shows a table preview of the first 5 rows,
 * then calls onImport with the parsed row objects.
 *
 * Column mapping is configuration-driven — each section passes its own
 * `fields` spec. The parser is fuzzy: it lower-cases header names and
 * matches synonyms so exports from different tools all work.
 */

import { useRef, useState } from "react";
import { Upload, X, CheckCircle2, AlertTriangle, FileSpreadsheet } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FieldSpec {
  /** The key that will appear in the parsed row object. */
  key:       string;
  /** Human-readable label shown in preview header. */
  label:     string;
  /** Column header synonyms (lower-cased). First match wins. */
  synonyms:  string[];
  required?: boolean;
}

export interface ImportResult {
  /** Parsed rows — only the keys from FieldSpec are present. */
  rows: Record<string, string>[];
  /** Number of rows skipped due to missing required fields. */
  skipped: number;
}

interface Props {
  /** Section title shown in the modal header. */
  title:     string;
  /** What columns to extract. */
  fields:    FieldSpec[];
  /** Called after the user confirms the import. */
  onImport:  (result: ImportResult) => void;
  /** Human-readable example of an expected row (shown as a hint). */
  example?:  string;
}

// ── CSV / XLSX parser ─────────────────────────────────────────────────────────

function parseCSVLine(line: string): string[] {
  const cells: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQ = !inQ; continue; }
    if (ch === "," && !inQ) { cells.push(cur.trim()); cur = ""; continue; }
    cur += ch;
  }
  cells.push(cur.trim());
  return cells;
}

async function parseFile(file: File): Promise<string[][]> {
  const name = file.name.toLowerCase();

  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    const xlsx = await import("xlsx");
    const buf  = await file.arrayBuffer();
    const wb   = xlsx.read(buf, { type: "array" });
    const ws   = wb.Sheets[wb.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_csv(ws).split("\n").filter(Boolean);
    return rows.map(parseCSVLine);
  }

  const text = await file.text();
  return text
    .split("\n")
    .filter(r => r.trim())
    .map(parseCSVLine);
}

function mapColumns(headers: string[], fields: FieldSpec[]): Record<string, number> {
  const lower = headers.map(h => h.toLowerCase().trim());
  const map: Record<string, number> = {};
  for (const field of fields) {
    const idx = field.synonyms.findIndex(syn =>
      lower.some(h => h === syn || h.includes(syn) || syn.includes(h))
    );
    if (idx !== -1) {
      const colIdx = lower.findIndex(h =>
        h === field.synonyms[idx] || h.includes(field.synonyms[idx]) || field.synonyms[idx].includes(h)
      );
      if (colIdx !== -1) map[field.key] = colIdx;
    }
  }
  return map;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SectionCsvImport({ title, fields, onImport, example }: Props) {
  const [open, setOpen]           = useState(false);
  const [rows, setRows]           = useState<string[][]>([]);
  const [headers, setHeaders]     = useState<string[]>([]);
  const [colMap, setColMap]       = useState<Record<string, number>>({});
  const [error, setError]         = useState("");
  const [dragging, setDragging]   = useState(false);
  const [fileName, setFileName]   = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setRows([]); setHeaders([]); setColMap({});
    setError(""); setFileName("");
  }

  async function handleFile(file: File) {
    setError("");
    try {
      const parsed = await parseFile(file);
      if (parsed.length < 2) { setError("File appears empty — need at least a header row and one data row."); return; }
      const hdrs = parsed[0];
      const data = parsed.slice(1).filter(r => r.some(c => c.trim()));
      const map  = mapColumns(hdrs, fields);
      const missing = fields.filter(f => f.required && map[f.key] === undefined).map(f => f.label);
      if (missing.length) {
        setError(`Couldn't find required column${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}. Check the header row matches the expected names.`);
        return;
      }
      setFileName(file.name);
      setHeaders(hdrs);
      setRows(data);
      setColMap(map);
    } catch {
      setError("Couldn't read that file. Try saving as CSV and uploading again.");
    }
  }

  function doImport() {
    let skipped = 0;
    const out: Record<string, string>[] = [];
    for (const row of rows) {
      const obj: Record<string, string> = {};
      let skip = false;
      for (const field of fields) {
        const idx = colMap[field.key];
        const val = idx !== undefined ? (row[idx] ?? "").trim() : "";
        if (field.required && !val) { skip = true; break; }
        obj[field.key] = val;
      }
      if (skip) { skipped++; continue; }
      out.push(obj);
    }
    onImport({ rows: out, skipped });
    setOpen(false);
    reset();
  }

  const mappedCount = fields.filter(f => colMap[f.key] !== undefined).length;
  const preview     = rows.slice(0, 5);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="zn-pill zn-pill-ghost flex items-center gap-1.5"
        style={{ height: 32, fontSize: 12, padding: "0 12px" }}
      >
        <Upload className="size-3.5" />
        Import CSV
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" style={{ background: "rgba(29,24,19,0.45)", backdropFilter: "blur(4px)" }}>
      <div
        className="w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[90dvh]"
        style={{ background: "var(--zn-surface)", border: "1px solid var(--zn-line)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--zn-line-soft)" }}>
          <div className="flex items-center gap-2.5">
            <FileSpreadsheet className="size-5" style={{ color: "var(--zn-ink-3)" }} />
            <div>
              <p className="text-sm font-semibold" style={{ color: "var(--zn-ink)" }}>Import {title}</p>
              {fileName && <p className="text-xs mt-0.5" style={{ color: "var(--zn-ink-3)" }}>{fileName} — {rows.length} rows</p>}
            </div>
          </div>
          <button type="button" onClick={() => { setOpen(false); reset(); }} className="size-7 flex items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/5">
            <X className="size-4" style={{ color: "var(--zn-ink-3)" }} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Upload zone */}
          {rows.length === 0 ? (
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
              onClick={() => inputRef.current?.click()}
              className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed py-10 cursor-pointer transition-colors"
              style={{ borderColor: dragging ? "var(--zn-accent)" : "var(--zn-line)", background: dragging ? "var(--zn-surface-2)" : "transparent" }}
            >
              <Upload className="size-8" style={{ color: "var(--zn-ink-3)" }} />
              <div className="text-center">
                <p className="text-sm font-medium" style={{ color: "var(--zn-ink)" }}>Drop a file here or click to browse</p>
                <p className="text-xs mt-1" style={{ color: "var(--zn-ink-3)" }}>CSV or Excel (.xlsx) · {fields.filter(f => f.required).map(f => f.label).join(", ")} required</p>
                {example && <p className="text-xs mt-2 font-mono px-3 py-1.5 rounded-lg inline-block" style={{ background: "var(--zn-surface-2)", color: "var(--zn-ink-2)" }}>{example}</p>}
              </div>
              <input ref={inputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            </div>
          ) : (
            <>
              {/* Column mapping summary */}
              <div className="flex flex-wrap gap-1.5">
                {fields.map(field => {
                  const mapped = colMap[field.key] !== undefined;
                  return (
                    <span
                      key={field.key}
                      className="text-[11px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1"
                      style={{
                        background: mapped ? "var(--zn-safe-soft, #d1fae5)" : field.required ? "var(--zn-risk-soft, #fee2e2)" : "var(--zn-surface-2)",
                        color:      mapped ? "var(--zn-safe, #065f46)"      : field.required ? "var(--zn-risk, #991b1b)"      : "var(--zn-ink-3)",
                      }}
                    >
                      {mapped ? <CheckCircle2 className="size-3" /> : <AlertTriangle className="size-3" />}
                      {field.label}
                    </span>
                  );
                })}
              </div>

              {/* Preview table */}
              <div className="rounded-xl overflow-hidden border" style={{ borderColor: "var(--zn-line-soft)" }}>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr style={{ background: "var(--zn-surface-2)" }}>
                        {fields.filter(f => colMap[f.key] !== undefined).map(f => (
                          <th key={f.key} className="px-3 py-2 text-left font-semibold whitespace-nowrap" style={{ color: "var(--zn-ink-2)" }}>
                            {f.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.map((row, i) => (
                        <tr key={i} style={{ borderTop: "1px solid var(--zn-line-soft)" }}>
                          {fields.filter(f => colMap[f.key] !== undefined).map(f => (
                            <td key={f.key} className="px-3 py-1.5 whitespace-nowrap truncate max-w-[180px]" style={{ color: "var(--zn-ink)" }}>
                              {row[colMap[f.key]] ?? "—"}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {rows.length > 5 && (
                  <p className="text-center text-[11px] py-2" style={{ color: "var(--zn-ink-3)", background: "var(--zn-surface-2)" }}>
                    Showing 5 of {rows.length} rows
                  </p>
                )}
              </div>
            </>
          )}

          {error && (
            <div className="flex gap-2 rounded-xl p-3 text-xs" style={{ background: "var(--zn-risk-soft, #fee2e2)", color: "var(--zn-risk, #991b1b)" }}>
              <AlertTriangle className="size-4 flex-shrink-0 mt-0.5" />
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        {rows.length > 0 && (
          <div className="flex items-center justify-between px-5 py-3 border-t" style={{ borderColor: "var(--zn-line-soft)" }}>
            <button type="button" onClick={reset} className="text-xs underline underline-offset-2" style={{ color: "var(--zn-ink-3)" }}>
              Choose different file
            </button>
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: "var(--zn-ink-3)" }}>
                {mappedCount}/{fields.length} columns matched · {rows.length} rows
              </span>
              <button
                type="button"
                onClick={doImport}
                className="zn-pill"
                style={{ height: 32, fontSize: 12, padding: "0 16px" }}
              >
                Import {rows.length} rows
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

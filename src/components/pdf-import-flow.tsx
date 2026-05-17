"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, FileText, Check, AlertTriangle, Loader2, X } from "lucide-react";
import { createInvoice, generateInvoiceNumber, readInvoices } from "@/lib/invoice-store";
import { readLocalAccount } from "@/lib/demo-auth";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ExtractedInvoice {
  customerName: string;
  customerEmail: string | null;
  invoiceNumber: string;
  invoiceDate: string | null;
  dueDate: string | null;
  amount: number;
  currency: string;
  description: string | null;
  _edited?: boolean;
}

type Step = "upload" | "extracting" | "review" | "saving" | "done";

// ── PDF.js loader ─────────────────────────────────────────────────────────────

interface PdfDoc {
  numPages: number;
  getPage(n: number): Promise<PdfPage>;
}

interface PdfPage {
  getTextContent(): Promise<{ items: Array<{ str: string }> }>;
}

type PdfjsLib = {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument: (opts: { data: Uint8Array }) => { promise: Promise<PdfDoc> };
};

async function loadPdfJs(): Promise<PdfjsLib> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  if (w.pdfjsLib) return w.pdfjsLib as PdfjsLib;
  await new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load PDF.js"));
    document.head.appendChild(s);
  });
  (w.pdfjsLib as PdfjsLib).GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  return w.pdfjsLib as PdfjsLib;
}

async function extractTextFromPdf(file: File): Promise<string> {
  const pdfjsLib = await loadPdfJs();
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
  let text = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map((item) => item.str).join(" ") + "\n";
  }
  return text;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PdfImportFlow({ onBack }: { onBack: () => void }) {
  const [step, setStep] = useState<Step>("upload");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<ExtractedInvoice[]>([]);
  const [savedCount, setSavedCount] = useState(0);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const processFiles = useCallback(async (selected: File[]) => {
    setFiles(selected);
    setError(null);
    setStep("extracting");

    try {
      let allText = "";
      for (const file of selected) {
        const text = await extractTextFromPdf(file);
        allText += `\n\n=== ${file.name} ===\n${text}`;
      }

      const res = await fetch("/api/import/extract-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: allText,
          filename: selected.map((f) => f.name).join(", "),
        }),
      });

      if (!res.ok) {
        const { error: msg } = (await res.json()) as { error?: string };
        throw new Error(msg ?? "AI extraction failed");
      }

      const { invoices: extracted } = (await res.json()) as { invoices: ExtractedInvoice[] };

      if (!extracted.length) {
        setError("No invoice data found. Check the PDF contains invoice text, then try again.");
        setStep("upload");
        return;
      }

      setInvoices(
        extracted.map((inv, i) => ({
          ...inv,
          invoiceNumber: inv.invoiceNumber || `PDF-${i + 1}`,
          currency: inv.currency || "GBP",
          amount: typeof inv.amount === "number" ? inv.amount : 0,
        }))
      );
      setStep("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Extraction failed");
      setStep("upload");
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const pdfs = Array.from(e.dataTransfer.files).filter(
        (f) => f.type === "application/pdf" || f.name.endsWith(".pdf")
      );
      if (pdfs.length) processFiles(pdfs);
    },
    [processFiles]
  );

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    if (selected.length) processFiles(selected);
  };

  const updateInvoice = (
    idx: number,
    field: keyof ExtractedInvoice,
    value: string | number | null
  ) => {
    setInvoices((prev) =>
      prev.map((inv, i) => (i === idx ? { ...inv, [field]: value, _edited: true } : inv))
    );
  };

  const removeInvoice = (idx: number) => {
    setInvoices((prev) => prev.filter((_, i) => i !== idx));
  };

  const validCount = invoices.filter((i) => i.customerName?.trim() && i.amount > 0).length;

  const handleSave = () => {
    setStep("saving");
    const account = readLocalAccount();
    const businessId = account?.email ?? "local";
    const existing = readInvoices();
    const now = new Date().toISOString();
    let count = 0;

    for (const inv of invoices) {
      if (!inv.customerName?.trim() || !(inv.amount > 0)) continue;

      const daysOverdue = inv.dueDate
        ? Math.max(0, Math.floor((Date.now() - new Date(inv.dueDate).getTime()) / 86400000))
        : 0;

      const invNum = inv.invoiceNumber?.trim() || generateInvoiceNumber([...existing]);

      createInvoice({
        id: `inv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        businessId,
        customerId: inv.customerName.toLowerCase().replace(/\s+/g, "-"),
        customerName: inv.customerName.trim(),
        customerEmail: inv.customerEmail ?? undefined,
        invoiceNumber: invNum,
        invoiceDate: inv.invoiceDate ?? now.slice(0, 10),
        dueDate: inv.dueDate ?? undefined,
        amount: inv.amount,
        amountOutstanding: inv.amount,
        currency: "GBP",
        status: daysOverdue > 0 ? "overdue" : "due_soon",
        daysOverdue,
        previousChaseCount: 0,
        relationshipType: "new customer",
        lineItems: [
          {
            id: `li-${Date.now()}-${count}`,
            description: inv.description ?? "Invoice balance",
            quantity: 1,
            unitPrice: inv.amount,
            amount: inv.amount,
          },
        ],
        activityHistory: [
          {
            id: `act-${Date.now()}-${count}`,
            businessId,
            type: "imported",
            title: "Imported from PDF",
            description: `Extracted from ${files.map((f) => f.name).join(", ")}`,
            createdAt: now,
            createdBy: "pdf-import",
          },
        ],
        sourceBatchId: `pdf-${Date.now()}`,
        importedRowNumber: count,
        queueStatus: "active",
      });
      count++;
    }

    setSavedCount(count);
    setStep("done");
  };

  // ── Upload ──────────────────────────────────────────────────────────────────

  if (step === "upload") {
    return (
      <div className="space-y-4">
        {error && (
          <div
            className="flex items-start gap-2 rounded-xl px-3.5 py-3 text-[13px]"
            style={{ background: "var(--zn-risk-soft)", color: "var(--zn-risk)" }}
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            {error}
          </div>
        )}

        <div
          className="relative cursor-pointer rounded-xl border-2 border-dashed p-12 text-center transition-colors"
          style={{
            borderColor: dragging ? "var(--zn-accent)" : "var(--zn-line)",
            background: dragging ? "var(--zn-surface-2)" : "var(--zn-surface)",
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".pdf"
            multiple
            className="hidden"
            onChange={handleFileInput}
          />
          <FileText className="mx-auto mb-3 size-10" style={{ color: "var(--zn-ink-3)" }} />
          <p className="text-[15px] font-semibold" style={{ color: "var(--zn-ink)" }}>
            Drop invoice PDFs here
          </p>
          <p className="mt-1 text-[13px]" style={{ color: "var(--zn-ink-3)" }}>
            or click to browse — multiple files supported
          </p>
          <p className="mt-3 text-[11.5px]" style={{ color: "var(--zn-ink-3)" }}>
            Works with typed invoices, aged debt reports, and customer statements
          </p>
        </div>

        <div
          className="rounded-xl px-4 py-3 text-[12.5px]"
          style={{ background: "var(--zn-surface-2)", color: "var(--zn-ink-3)" }}
        >
          <strong style={{ color: "var(--zn-ink-2)" }}>Tip:</strong> AI reads the text from your
          PDFs and extracts the customer name, invoice number, amount, and due date. You can
          correct anything before saving.
        </div>

        <button
          onClick={onBack}
          className="text-[12.5px] font-medium transition-opacity hover:opacity-70"
          style={{ color: "var(--zn-ink-3)" }}
        >
          ← Back to import options
        </button>
      </div>
    );
  }

  // ── Extracting ──────────────────────────────────────────────────────────────

  if (step === "extracting") {
    return (
      <div className="space-y-3 py-16 text-center">
        <Loader2 className="mx-auto size-8 animate-spin" style={{ color: "var(--zn-accent)" }} />
        <p className="text-[15px] font-semibold" style={{ color: "var(--zn-ink)" }}>
          Reading {files.length === 1 ? files[0].name : `${files.length} PDFs`}…
        </p>
        <p className="text-[13px]" style={{ color: "var(--zn-ink-3)" }}>
          Extracting text then parsing with AI — usually under 10 seconds
        </p>
      </div>
    );
  }

  // ── Review ──────────────────────────────────────────────────────────────────

  if (step === "review") {
    return (
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[17px] font-semibold" style={{ color: "var(--zn-ink)" }}>
              Review extracted invoices
            </h2>
            <p className="mt-0.5 text-[12.5px]" style={{ color: "var(--zn-ink-3)" }}>
              AI found {invoices.length} invoice{invoices.length !== 1 ? "s" : ""}. Correct any
              details before saving.
            </p>
          </div>
          <button
            className="zn-pill shrink-0"
            disabled={validCount === 0}
            onClick={handleSave}
          >
            Save {validCount} invoice{validCount !== 1 ? "s" : ""}
          </button>
        </div>

        <div className="max-h-[520px] space-y-3 overflow-y-auto pr-1">
          {invoices.map((inv, idx) => (
            <div
              key={idx}
              className="space-y-3 rounded-xl p-4"
              style={{
                background: "var(--zn-surface-2)",
                border: "1px solid var(--zn-line-soft)",
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <span
                  className="text-[10.5px] font-semibold uppercase tracking-wide"
                  style={{ color: "var(--zn-ink-3)" }}
                >
                  Invoice {idx + 1}
                  {inv._edited && (
                    <span className="ml-1.5" style={{ color: "var(--zn-warn)" }}>
                      edited
                    </span>
                  )}
                </span>
                <button
                  onClick={() => removeInvoice(idx)}
                  className="rounded p-0.5 transition-colors hover:bg-[var(--zn-risk-soft)]"
                  title="Remove"
                >
                  <X className="size-3.5" style={{ color: "var(--zn-ink-3)" }} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { label: "Customer *", field: "customerName", type: "text", colSpan: 1 },
                    { label: "Invoice number", field: "invoiceNumber", type: "text", colSpan: 1 },
                    { label: "Amount (£) *", field: "amount", type: "number", colSpan: 1 },
                    { label: "Due date", field: "dueDate", type: "date", colSpan: 1 },
                    { label: "Customer email", field: "customerEmail", type: "email", colSpan: 2 },
                  ] as const
                ).map(({ label, field, type, colSpan }) => (
                  <div key={field} style={{ gridColumn: `span ${colSpan}` }}>
                    <label
                      className="mb-1 block text-[10.5px] font-semibold uppercase tracking-wide"
                      style={{ color: "var(--zn-ink-3)" }}
                    >
                      {label}
                    </label>
                    <input
                      type={type}
                      className="w-full rounded-lg border px-2.5 py-1.5 text-[13px] outline-none"
                      style={{
                        borderColor: "var(--zn-line)",
                        background: "var(--zn-surface)",
                        color: "var(--zn-ink)",
                      }}
                      value={
                        field === "amount"
                          ? (inv.amount ?? "")
                          : ((inv[field as keyof ExtractedInvoice] as string) ?? "")
                      }
                      onChange={(e) =>
                        updateInvoice(
                          idx,
                          field,
                          field === "amount"
                            ? parseFloat(e.target.value) || 0
                            : e.target.value || null
                        )
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={() => setStep("upload")}
          className="text-[12.5px] font-medium transition-opacity hover:opacity-70"
          style={{ color: "var(--zn-ink-3)" }}
        >
          ← Upload different PDFs
        </button>
      </div>
    );
  }

  // ── Saving ──────────────────────────────────────────────────────────────────

  if (step === "saving") {
    return (
      <div className="space-y-3 py-16 text-center">
        <Loader2 className="mx-auto size-8 animate-spin" style={{ color: "var(--zn-accent)" }} />
        <p className="text-[15px] font-semibold" style={{ color: "var(--zn-ink)" }}>
          Saving invoices…
        </p>
      </div>
    );
  }

  // ── Done ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4 py-12 text-center">
      <div
        className="mx-auto flex size-14 items-center justify-center rounded-full"
        style={{ background: "var(--zn-safe-soft)" }}
      >
        <Check className="size-7" style={{ color: "var(--zn-safe)" }} />
      </div>
      <div>
        <p className="text-[18px] font-semibold" style={{ color: "var(--zn-ink)" }}>
          {savedCount} invoice{savedCount !== 1 ? "s" : ""} imported
        </p>
        <p className="mt-1 text-[13px]" style={{ color: "var(--zn-ink-3)" }}>
          They&apos;re ready in your chase plan.
        </p>
      </div>
      <div className="flex items-center justify-center gap-3">
        <a
          href="/chase-today"
          className="zn-pill inline-flex items-center"
          style={{ height: 36, fontSize: 13 }}
        >
          Go to chase plan
        </a>
        <button
          onClick={() => {
            setStep("upload");
            setInvoices([]);
            setFiles([]);
            setSavedCount(0);
          }}
          className="zn-pill zn-pill-ghost"
          style={{ height: 36, fontSize: 13 }}
        >
          Import more PDFs
        </button>
      </div>
    </div>
  );
}

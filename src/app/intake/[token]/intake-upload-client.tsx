"use client";

/**
 * Client-side upload form for the public intake page.
 * Handles file selection, validation, and the POST to /api/intake/[token]/upload.
 */

import { useState, useRef } from "react";
import { CheckCircle2, Upload, FileText, X } from "lucide-react";

interface IntakeUploadClientProps {
  token:          string;
  tokenId:        string;
  clientName:     string;
  clientId:       string;
  bookkeeperName: string;
  expiresAt:      string;
}

type UploadType = "invoices" | "bank_statement" | "receipts" | "other";

interface PendingFile {
  type: UploadType;
  file: File;
}

interface UploadResult {
  type:    UploadType;
  success: boolean;
  error?:  string;
}

const UPLOAD_TYPE_LABELS: Record<UploadType, string> = {
  invoices:       "Invoice / accounts receivable export",
  bank_statement: "Bank statement",
  receipts:       "Receipts / expenses",
  other:          "Other document",
};

const UPLOAD_TYPE_HINTS: Record<UploadType, string> = {
  invoices:       "CSV export from your invoicing software (Xero, QuickBooks, FreeAgent, etc.)",
  bank_statement: "CSV export from your bank's online portal (avoid PDFs where possible)",
  receipts:       "CSV summary or image of receipts for expense tracking",
  other:          "Any other financial document your bookkeeper requested",
};

export function IntakeUploadClient({
  token,
  clientName,
  bookkeeperName,
  expiresAt,
}: IntakeUploadClientProps) {
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [uploading,    setUploading]    = useState(false);
  const [results,      setResults]      = useState<UploadResult[] | null>(null);
  const [globalError,  setGlobalError]  = useState<string | null>(null);

  // One file input ref per upload type
  const inputRefs: Record<UploadType, React.RefObject<HTMLInputElement | null>> = {
    invoices:       useRef<HTMLInputElement | null>(null),
    bank_statement: useRef<HTMLInputElement | null>(null),
    receipts:       useRef<HTMLInputElement | null>(null),
    other:          useRef<HTMLInputElement | null>(null),
  };

  function addFile(type: UploadType, file: File) {
    setPendingFiles((prev) => {
      // Replace if same type already staged
      const filtered = prev.filter((p) => p.type !== type);
      return [...filtered, { type, file }];
    });
  }

  function removeFile(type: UploadType) {
    setPendingFiles((prev) => prev.filter((p) => p.type !== type));
  }

  async function handleSubmit() {
    if (pendingFiles.length === 0) {
      setGlobalError("Please select at least one file to upload.");
      return;
    }
    setUploading(true);
    setGlobalError(null);

    const uploadResults: UploadResult[] = [];

    for (const { type, file } of pendingFiles) {
      try {
        // Read file content as text (CSVs) or base64 (images, PDFs, xlsx)
        const rawContent = await readFileAsContent(file);

        const res = await fetch(`/api/intake/${token}/upload`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({
            uploadType:    type,
            fileName:      file.name,
            fileSizeBytes: file.size,
            rawContent,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({})) as { error?: string };
          uploadResults.push({ type, success: false, error: data.error ?? `Server error ${res.status}` });
        } else {
          uploadResults.push({ type, success: true });
        }
      } catch (err) {
        uploadResults.push({ type, success: false, error: err instanceof Error ? err.message : "Upload failed" });
      }
    }

    setResults(uploadResults);
    setUploading(false);
  }

  const allSucceeded = results?.every((r) => r.success) ?? false;
  const expiryDate   = new Date(expiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  // ── Success screen ────────────────────────────────────────────────────────
  if (results && allSucceeded) {
    return (
      <Shell>
        <div className="flex flex-col items-center text-center gap-4 py-8">
          <div
            className="size-14 rounded-2xl flex items-center justify-center"
            style={{ background: "#e8f5e9" }}
          >
            <CheckCircle2 className="size-7" style={{ color: "#2e7d32" }} />
          </div>
          <div>
            <h2 className="text-[18px] font-semibold text-[#1d1813]">Files uploaded successfully</h2>
            <p className="mt-1.5 text-[13.5px] text-[#6b6253]">
              {bookkeeperName} has been notified and will import your data shortly.
              You can close this tab.
            </p>
          </div>
          <div className="w-full rounded-xl p-4" style={{ background: "#f0f4f8", border: "1px solid #dde3ea" }}>
            {results.map((r) => (
              <div key={r.type} className="flex items-center gap-2 text-[13px] text-[#1d1813] py-1">
                <CheckCircle2 className="size-4 text-green-600 flex-shrink-0" />
                {UPLOAD_TYPE_LABELS[r.type]}
              </div>
            ))}
          </div>
        </div>
      </Shell>
    );
  }

  // ── Upload form ──────────────────────────────────────────────────────────
  return (
    <Shell>
      {/* Header */}
      <div className="mb-6">
        <div
          className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide mb-3"
          style={{ background: "#f0ede8", color: "#6b6253" }}
        >
          SECURE UPLOAD
        </div>
        <h1 className="text-[22px] font-semibold text-[#1d1813] leading-tight">
          Send documents to {bookkeeperName}
        </h1>
        <p className="mt-1.5 text-[13.5px] text-[#6b6253]">
          You are uploading as <strong>{clientName}</strong>. Select the files below and click
          &ldquo;Send to bookkeeper&rdquo; — your data is transmitted securely.
        </p>
        <p className="mt-2 text-[11.5px]" style={{ color: "#9b8e80" }}>
          This link expires on {expiryDate}. Ask your bookkeeper for a new link if it&apos;s expired.
        </p>
      </div>

      {/* File pickers */}
      <div className="flex flex-col gap-3 mb-5">
        {(["invoices", "bank_statement", "receipts"] as UploadType[]).map((type) => {
          const staged = pendingFiles.find((p) => p.type === type);
          return (
            <div
              key={type}
              className="rounded-xl p-4"
              style={{ border: "1px solid #e2ddd7", background: staged ? "#f5fbf5" : "#fdfcfa" }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[13.5px] font-semibold text-[#1d1813]">
                    {UPLOAD_TYPE_LABELS[type]}
                  </div>
                  <div className="text-[12px] text-[#9b8e80] mt-0.5">
                    {UPLOAD_TYPE_HINTS[type]}
                  </div>
                </div>

                {staged ? (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-medium"
                      style={{ background: "#e8f5e9", color: "#2e7d32" }}>
                      <FileText className="size-3.5" />
                      <span className="max-w-[120px] truncate">{staged.file.name}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(type)}
                      className="size-6 rounded-full flex items-center justify-center hover:bg-red-50 transition-colors"
                      style={{ color: "#9b8e80" }}
                      aria-label="Remove file"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => inputRefs[type].current?.click()}
                    className="flex-shrink-0 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors hover:bg-[#e8e3dc]"
                    style={{ border: "1px solid #c8c0b4", color: "#4a3f35" }}
                  >
                    <Upload className="size-3.5" />
                    Choose file
                  </button>
                )}
              </div>

              <input
                ref={inputRefs[type]}
                type="file"
                accept=".csv,.xlsx,.xls,.pdf,.jpg,.jpeg,.png"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) addFile(type, f);
                  if (e.target) e.target.value = "";
                }}
              />
            </div>
          );
        })}
      </div>

      {/* Errors from partial failures */}
      {results && results.some((r) => !r.success) && (
        <div
          className="rounded-xl p-4 mb-4 text-[13px]"
          style={{ background: "#fff3f3", border: "1px solid #f5c6c6", color: "#c0392b" }}
        >
          <p className="font-semibold mb-2">Some files could not be uploaded:</p>
          {results.filter((r) => !r.success).map((r) => (
            <p key={r.type}>• {UPLOAD_TYPE_LABELS[r.type]}: {r.error}</p>
          ))}
          <p className="mt-2 text-[12px]">Please try again or contact your bookkeeper.</p>
        </div>
      )}

      {globalError && (
        <div
          className="rounded-xl p-3 mb-4 text-[12.5px]"
          style={{ background: "#fff3f3", border: "1px solid #f5c6c6", color: "#c0392b" }}
        >
          {globalError}
        </div>
      )}

      {/* Submit */}
      <button
        type="button"
        disabled={uploading || pendingFiles.length === 0}
        onClick={handleSubmit}
        className="w-full flex items-center justify-center gap-2 rounded-full py-3 text-[14px] font-semibold transition-opacity disabled:opacity-40"
        style={{ background: "#1d1813", color: "#ffffff" }}
      >
        {uploading ? (
          <>
            <span className="inline-block size-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
            Uploading…
          </>
        ) : (
          <>
            <Upload className="size-4" />
            Send to bookkeeper ({pendingFiles.length} file{pendingFiles.length !== 1 ? "s" : ""})
          </>
        )}
      </button>

      <p className="mt-4 text-center text-[11.5px]" style={{ color: "#9b8e80" }}>
        Powered by Zentra Collect · Your files are encrypted in transit
      </p>
    </Shell>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function readFileAsContent(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Could not read file"));
    // Only read as UTF-8 text when the file really is text (CSV/TSV/TXT).
    // Everything else — images, PDFs, and crucially binary spreadsheets
    // (.xlsx/.xls) — is read as a base64 data URL so it isn't corrupted.
    const name = file.name.toLowerCase();
    const isText = file.type.startsWith("text/") || /\.(csv|tsv|txt)$/.test(name);
    if (isText) {
      reader.readAsText(file, "utf-8");
    } else {
      reader.readAsDataURL(file);
    }
  });
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "#faf9f7" }}>
      <div
        className="w-full max-w-lg rounded-2xl p-6 sm:p-8"
        style={{ background: "#ffffff", border: "1px solid #e2ddd7", boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}
      >
        {/* Zentra wordmark */}
        <div className="flex items-center gap-2 mb-6">
          <div
            className="size-7 rounded-lg flex items-center justify-center text-[13px] font-bold"
            style={{ background: "#1d1813", color: "#ffffff" }}
          >
            Z
          </div>
          <span className="text-[13px] font-semibold text-[#1d1813]">Zentra Collect</span>
        </div>
        {children}
      </div>
    </div>
  );
}

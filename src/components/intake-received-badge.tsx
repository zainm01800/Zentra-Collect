"use client";

/**
 * Shows a "N received" badge on a bookkeeper's client card when the client has
 * sent files through their intake link. Clicking opens a modal listing each
 * upload with Download + "Mark handled" actions.
 *
 * This completes the intake loop: createIntakeToken generates the link, the
 * public /intake/[token] page receives files, and this surfaces them back to
 * the bookkeeper inside the app.
 */

import { useState } from "react";
import { Download, FileText, Inbox, Loader2, Check, X } from "lucide-react";
import {
  getIntakeUploadContent,
  markIntakeUploadImported,
  type PendingUpload,
} from "@/actions/intake";

const TYPE_LABELS: Record<string, string> = {
  invoices:       "Invoices / AR export",
  bank_statement: "Bank statement",
  receipts:       "Receipts / expenses",
  other:          "Other document",
};

function fmtSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function IntakeReceivedBadge({
  clientName,
  uploads,
  onChange,
}: {
  clientName: string;
  uploads: PendingUpload[];
  onChange: () => void;
}) {
  const [open, setOpen]       = useState(false);
  const [busyId, setBusyId]   = useState<string | null>(null);

  if (uploads.length === 0) return null;

  async function download(u: PendingUpload) {
    setBusyId(u.id);
    try {
      const res = await getIntakeUploadContent(u.id);
      if (!res.rawContent) return;
      // Receipts/PDFs arrive as base64 data URLs; CSVs as plain text.
      let blob: Blob;
      if (res.rawContent.startsWith("data:")) {
        const [meta, b64] = res.rawContent.split(",");
        const mime = meta.match(/data:(.*?);base64/)?.[1] ?? "application/octet-stream";
        const bin  = atob(b64);
        const arr  = Uint8Array.from(bin, (c) => c.charCodeAt(0));
        blob = new Blob([arr], { type: mime });
      } else {
        blob = new Blob([res.rawContent], { type: "text/csv" });
      }
      const url = URL.createObjectURL(blob);
      const a   = document.createElement("a");
      a.href = url;
      a.download = res.fileName ?? u.fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setBusyId(null);
    }
  }

  async function markHandled(u: PendingUpload) {
    setBusyId(u.id);
    try {
      await markIntakeUploadImported(u.id);
      onChange();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
        style={{ background: "var(--zn-accent-soft, #e8f0e8)", color: "var(--zn-accent, #2e7d32)" }}
        title={`${uploads.length} file${uploads.length === 1 ? "" : "s"} received from this client`}
      >
        <Inbox className="size-3.5" />
        {uploads.length} received
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.45)" }}
          onClick={(e) => { e.stopPropagation(); setOpen(false); }}
        >
          <div
            className="rounded-2xl w-full max-w-md"
            style={{ background: "var(--zn-bg)", border: "1px solid var(--zn-line)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: "var(--zn-line-soft)" }}>
              <div>
                <p className="text-[14px] font-semibold" style={{ color: "var(--zn-ink)" }}>
                  Files from {clientName}
                </p>
                <p className="text-[11.5px] mt-0.5" style={{ color: "var(--zn-ink-3)" }}>
                  Download, then mark handled to clear it from the queue.
                </p>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close">
                <X className="size-4" style={{ color: "var(--zn-ink-3)" }} />
              </button>
            </div>

            <div className="p-4 flex flex-col gap-2.5 max-h-[60vh] overflow-y-auto">
              {uploads.map((u) => (
                <div
                  key={u.id}
                  className="rounded-xl p-3 flex items-center gap-3"
                  style={{ background: "var(--zn-surface)", border: "1px solid var(--zn-line-soft)" }}
                >
                  <div
                    className="size-9 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: "var(--zn-surface-2)" }}
                  >
                    <FileText className="size-4" style={{ color: "var(--zn-ink-3)" }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[12.5px] font-medium truncate" style={{ color: "var(--zn-ink)" }}>
                      {u.fileName}
                    </div>
                    <div className="text-[11px]" style={{ color: "var(--zn-ink-3)" }}>
                      {TYPE_LABELS[u.uploadType] ?? u.uploadType}
                      {fmtSize(u.fileSizeBytes) && <> · {fmtSize(u.fileSizeBytes)}</>}
                      {" · "}
                      {new Date(u.uploadedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => download(u)}
                      disabled={busyId === u.id}
                      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-medium border disabled:opacity-50"
                      style={{ borderColor: "var(--zn-line)", color: "var(--zn-ink-2)" }}
                    >
                      {busyId === u.id ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
                      Download
                    </button>
                    <button
                      type="button"
                      onClick={() => markHandled(u)}
                      disabled={busyId === u.id}
                      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-medium disabled:opacity-50"
                      style={{ background: "var(--zn-ink)", color: "var(--zn-bg)" }}
                      title="Mark as handled"
                    >
                      <Check className="size-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

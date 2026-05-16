"use client";

/**
 * Thin wrapper that renders BankStatementImport inside a titled card.
 * Kept separate so banking/page.tsx (server component) can import it cleanly.
 */

import { BankStatementImport } from "@/components/bank-statement-import";
import { Upload } from "lucide-react";

export function BankStatementImportCard() {
  return (
    <div className="zn-card px-5 py-5 space-y-4">
      {/* Section header */}
      <div className="flex items-center gap-2.5">
        <div
          className="size-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: "var(--zn-bg-2)" }}
        >
          <Upload className="size-3.5" style={{ color: "var(--zn-ink-3)" }} />
        </div>
        <div>
          <p className="text-[14px] font-semibold" style={{ color: "var(--zn-ink)" }}>
            Import bank statement
          </p>
          <p className="text-[12px]" style={{ color: "var(--zn-ink-3)" }}>
            CSV, Excel (.xlsx / .xls), TSV or TXT — auto-detects every major UK bank.
          </p>
        </div>
      </div>

      <div style={{ borderTop: "1px solid var(--zn-line-soft)", paddingTop: "1rem" }}>
        <BankStatementImport />
      </div>
    </div>
  );
}

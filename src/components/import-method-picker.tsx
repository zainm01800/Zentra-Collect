"use client";

import { useRouter } from "next/navigation";
import { FileSpreadsheet, FileText, PenLine, ArrowRight, Landmark } from "lucide-react";

interface Method {
  id: "csv" | "pdf" | "manual" | "bank";
  icon: React.ReactNode;
  title: string;
  description: string;
  badge?: string;
}

const METHODS: Method[] = [
  {
    id: "csv",
    icon: <FileSpreadsheet className="size-5" />,
    title: "CSV or Excel export",
    description:
      "Upload an AR ageing or overdue invoice export from Xero, QuickBooks, Sage, or any spreadsheet.",
    badge: "Most common",
  },
  {
    id: "pdf",
    icon: <FileText className="size-5" />,
    title: "Invoice PDFs",
    description:
      "Drop in your sent invoice PDFs. AI reads the text and extracts customer, amount, and due date.",
    badge: "No spreadsheet needed",
  },
  {
    id: "manual",
    icon: <PenLine className="size-5" />,
    title: "Enter manually",
    description:
      "Add invoices one at a time. Good for a handful of overdue invoices you already know off the top of your head.",
  },
  {
    id: "bank",
    icon: <Landmark className="size-5" />,
    title: "Match bank payments",
    description:
      "Already imported invoices? Upload a bank statement CSV to automatically identify which ones have been paid.",
  },
];

interface Props {
  onSelectCsv: () => void;
  onSelectPdf: () => void;
}

export function ImportMethodPicker({ onSelectCsv, onSelectPdf }: Props) {
  const router = useRouter();

  function handleSelect(id: Method["id"]) {
    if (id === "csv") onSelectCsv();
    if (id === "pdf") onSelectPdf();
    if (id === "manual") router.push("/invoices?create=1");
    if (id === "bank") router.push("/banking");
  }

  return (
    <div className="space-y-3">
      <div className="mb-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color: "var(--zn-ink-3)" }}>
          How would you like to add invoices?
        </p>
        <p className="mt-1 text-[13px]" style={{ color: "var(--zn-ink-3)" }}>
          Choose the method that fits your workflow — no accounting software required.
        </p>
      </div>

      {METHODS.map((m) => (
        <button
          key={m.id}
          type="button"
          onClick={() => handleSelect(m.id)}
          className="group flex w-full items-start gap-4 rounded-xl px-4 py-4 text-left transition-colors"
          style={{
            background: "var(--zn-surface-2)",
            border: "1px solid var(--zn-line-soft)",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = "var(--zn-line)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = "var(--zn-line-soft)";
          }}
        >
          {/* Icon */}
          <div
            className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg"
            style={{ background: "var(--zn-surface)", color: "var(--zn-ink-2)" }}
          >
            {m.icon}
          </div>

          {/* Text */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[14px] font-semibold" style={{ color: "var(--zn-ink)" }}>
                {m.title}
              </span>
              {m.badge && (
                <span
                  className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: "var(--zn-accent-soft, var(--zn-surface))", color: "var(--zn-ink-2)", border: "1px solid var(--zn-line-soft)" }}
                >
                  {m.badge}
                </span>
              )}
            </div>
            <p className="mt-0.5 text-[12.5px] leading-snug" style={{ color: "var(--zn-ink-3)" }}>
              {m.description}
            </p>
          </div>

          {/* Arrow */}
          <ArrowRight
            className="mt-0.5 size-4 shrink-0 transition-transform group-hover:translate-x-0.5"
            style={{ color: "var(--zn-ink-3)" }}
          />
        </button>
      ))}
    </div>
  );
}

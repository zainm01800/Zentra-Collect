import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { TemplateLibraryEditor } from "@/components/template-library-editor";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Email templates · Settings",
  description: "Pre-built chase templates you can fork and save.",
};

export default function TemplatesPage() {
  return (
    <div className="flex flex-col gap-5 max-w-3xl">
      <Link
        href="/settings"
        className="inline-flex items-center gap-1.5 text-[12.5px] font-medium w-fit hover:opacity-70"
        style={{ color: "var(--zn-ink-3)" }}
      >
        <ArrowLeft className="size-3.5" />
        Back to settings
      </Link>

      <div>
        <p
          className="text-[10.5px] font-semibold uppercase tracking-[0.16em]"
          style={{ color: "var(--zn-ink-3)" }}
        >
          Workspace configuration
        </p>
        <h1
          className="text-[26px] font-semibold mt-1 leading-tight"
          style={{ color: "var(--zn-ink)" }}
        >
          Email templates
        </h1>
        <p className="mt-1.5 text-[13.5px]" style={{ color: "var(--zn-ink-3)" }}>
          Starter chase templates you can copy, customise, and save. Use{" "}
          <code className="rounded bg-[var(--zn-bg-2)] px-1 py-0.5 text-[11.5px]">
            {"{{customerName}}"}
          </code>
          ,{" "}
          <code className="rounded bg-[var(--zn-bg-2)] px-1 py-0.5 text-[11.5px]">
            {"{{invoiceNumber}}"}
          </code>
          ,{" "}
          <code className="rounded bg-[var(--zn-bg-2)] px-1 py-0.5 text-[11.5px]">
            {"{{amount}}"}
          </code>
          ,{" "}
          <code className="rounded bg-[var(--zn-bg-2)] px-1 py-0.5 text-[11.5px]">
            {"{{dueDate}}"}
          </code>
          ,{" "}
          <code className="rounded bg-[var(--zn-bg-2)] px-1 py-0.5 text-[11.5px]">
            {"{{daysOverdue}}"}
          </code>
          , and{" "}
          <code className="rounded bg-[var(--zn-bg-2)] px-1 py-0.5 text-[11.5px]">
            {"{{businessName}}"}
          </code>
          .
        </p>
      </div>

      <TemplateLibraryEditor />
    </div>
  );
}

import { DatabaseZap } from "lucide-react";

export function DemoModeBanner() {
  return (
    <div
      className="flex flex-col gap-2 rounded-[12px] px-4 py-3 text-[13px] sm:flex-row sm:items-center sm:justify-between"
      style={{
        background: "var(--zn-warn-soft)",
        color: "var(--zn-warn)",
        border: "1px solid var(--zn-warn-soft)",
      }}
    >
      <div className="flex items-start gap-2">
        <DatabaseZap className="mt-0.5 size-4 shrink-0" />
        <p>
          Demo mode is active. Invoices are realistic mock data and status changes
          stay in your browser session.
        </p>
      </div>
      <span className="font-medium">Xero sync placeholder</span>
    </div>
  );
}

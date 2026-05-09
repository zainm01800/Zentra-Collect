import { Badge } from "@/components/ui/badge";
import type { InvoiceStatus, UrgencyLevel } from "@/types/cashpilot";

const statusStyles: Record<InvoiceStatus, string> = {
  "Not due": "border-zinc-200 bg-zinc-50 text-zinc-700",
  "Due soon": "border-sky-200 bg-sky-50 text-sky-700",
  Overdue: "border-amber-200 bg-amber-50 text-amber-800",
  "Reminder drafted": "border-violet-200 bg-violet-50 text-violet-700",
  "Reminder sent": "border-blue-200 bg-blue-50 text-blue-700",
  "Promised payment": "border-emerald-200 bg-emerald-50 text-emerald-700",
  Disputed: "border-red-200 bg-red-50 text-red-700",
  "Needs call": "border-orange-200 bg-orange-50 text-orange-800",
  Paid: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

const urgencyStyles: Record<UrgencyLevel, string> = {
  Low: "border-zinc-200 bg-zinc-50 text-zinc-700",
  Medium: "border-sky-200 bg-sky-50 text-sky-700",
  High: "border-amber-200 bg-amber-50 text-amber-800",
  Critical: "border-red-200 bg-red-50 text-red-700",
  Blocked: "border-purple-200 bg-purple-50 text-purple-700",
};

export function StatusBadge({ status }: { status: InvoiceStatus }) {
  return (
    <Badge variant="outline" className={statusStyles[status]}>
      {status}
    </Badge>
  );
}

export function UrgencyBadge({ urgency }: { urgency: UrgencyLevel }) {
  return (
    <Badge variant="outline" className={urgencyStyles[urgency]}>
      {urgency}
    </Badge>
  );
}

import {
  AlertTriangle,
  Banknote,
  CalendarClock,
  CheckCircle2,
  HandCoins,
  MessageSquareWarning,
} from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import type { Invoice } from "@/types/cashpilot";
import { getDashboardStats } from "@/lib/invoice-logic";

export function DashboardStats({ invoices }: { invoices: Invoice[] }) {
  const stats = getDashboardStats(invoices);
  const cards = [
    {
      label: "Overdue amount",
      value: formatCurrency(stats.overdueAmount),
      detail: `${stats.overdueCount} overdue invoices`,
      icon: Banknote,
      accent: true, // primary stat — highlighted
    },
    {
      label: "Due this week",
      value: formatCurrency(stats.dueThisWeekAmount),
      detail: "Upcoming cash to watch",
      icon: CalendarClock,
    },
    {
      label: "Chase today",
      value: String(stats.needsActionToday),
      detail: `${stats.averageDaysOverdue} avg days overdue`,
      icon: AlertTriangle,
    },
    {
      label: "Promised",
      value: String(stats.promisedPayments),
      detail: "Confirm before re-chasing",
      icon: CheckCircle2,
    },
    {
      label: "Disputed",
      value: String(stats.disputedInvoices),
      detail: "Resolve before reminding",
      icon: MessageSquareWarning,
    },
    {
      label: "Recovered",
      value: formatCurrency(stats.recoveredAfterChase),
      detail: `${stats.averageChasesToPayment} avg chases to paid`,
      icon: HandCoins,
    },
  ];

  return (
    <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {cards.map((card) => (
        <div key={card.label} className="zn-stat">
          <div className="flex items-center justify-between mb-2.5">
            <span className="zn-label">{card.label}</span>
            <card.icon
              className="size-3.5"
              style={{ color: card.accent ? "var(--zn-accent)" : "var(--zn-ink-3)" }}
            />
          </div>
          <div
            className="zn-stat-num"
            style={{ color: card.accent ? "var(--zn-accent)" : "var(--zn-ink)" }}
          >
            {card.value}
          </div>
          <p className="text-[12px] mt-1" style={{ color: "var(--zn-ink-3)" }}>
            {card.detail}
          </p>
        </div>
      ))}
    </div>
  );
}

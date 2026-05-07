import {
  AlertTriangle,
  Banknote,
  CalendarClock,
  CheckCircle2,
  HandCoins,
  MessageSquareWarning,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    },
    {
      label: "Due this week",
      value: formatCurrency(stats.dueThisWeekAmount),
      detail: "Upcoming cash to watch",
      icon: CalendarClock,
    },
    {
      label: "Needs chasing today",
      value: String(stats.needsActionToday),
      detail: `${stats.averageDaysOverdue} average days overdue`,
      icon: AlertTriangle,
    },
    {
      label: "Promised payments",
      value: String(stats.promisedPayments),
      detail: "Confirm before re-chasing",
      icon: CheckCircle2,
    },
    {
      label: "Disputed invoices",
      value: String(stats.disputedInvoices),
      detail: "Resolve before reminding",
      icon: MessageSquareWarning,
    },
    {
      label: "Recovered after chase",
      value: formatCurrency(stats.recoveredAfterChase),
      detail: `${stats.averageChasesToPayment} average chases to paid`,
      icon: HandCoins,
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
      {cards.map((card) => (
        <Card key={card.label} className="rounded-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {card.label}
            </CardTitle>
            <card.icon className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tracking-tight">{card.value}</div>
            <p className="mt-1 text-xs text-muted-foreground">{card.detail}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

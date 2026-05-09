import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DashboardStats } from "@/components/dashboard-stats";
import { ChaseQueue } from "@/components/chase-queue";
import { DemoModeBanner } from "@/components/demo-mode-banner";
import { TodayPlan } from "@/components/today-plan";
import { SyncStatus } from "@/components/sync-status";
import type { Invoice } from "@/types/cashpilot";

export function DashboardView({ invoices }: { invoices: Invoice[] }) {
  return (
    <div className="space-y-7">
      <DemoModeBanner />
      <div className="flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            Daily credit-control workspace
          </p>
          <h1 className="mt-2 max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">
            Prioritise overdue invoices, approve the right reminder, and keep
            follow-ups moving.
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
          Zentra Collect is intentionally narrow: it helps your team recover overdue
            invoices without becoming another accounting system.
          </p>
        </div>
        <Button asChild className="w-full sm:w-auto">
          <Link href="/chase-today">
            Open queue
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </div>
      <TodayPlan invoices={invoices} />
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Cash position</h2>
          <p className="text-sm text-muted-foreground">
            The numbers that decide whether today is a quick reminder day or an
            escalation day.
          </p>
        </div>
        <DashboardStats invoices={invoices} />
      </section>
      <SyncStatus />
      <ChaseQueue initialInvoices={invoices} />
    </div>
  );
}

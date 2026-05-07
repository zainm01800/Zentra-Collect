import { AppShell } from "@/components/app-shell";
import { ChaseQueue } from "@/components/chase-queue";
import { DashboardStats } from "@/components/dashboard-stats";
import { DemoModeBanner } from "@/components/demo-mode-banner";
import { demoInvoices } from "@/data/demo-invoices";

export default function ChaseTodayPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <DemoModeBanner />
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            Daily credit-control queue
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            Chase Today
          </h1>
        </div>
        <DashboardStats invoices={demoInvoices} />
        <ChaseQueue initialInvoices={demoInvoices} onlyToday={false} />
      </div>
    </AppShell>
  );
}

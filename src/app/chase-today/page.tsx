import { AppShell } from "@/components/app-shell";
import { ChaseQueue } from "@/components/chase-queue";
import { DashboardStats } from "@/components/dashboard-stats";
import { DemoModeBanner } from "@/components/demo-mode-banner";
import { PageHeader } from "@/components/page-header";
import { demoInvoices } from "@/data/demo-invoices";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Collections",
  description: "Your ranked chase plan. Each row shows the recommended action, the reason behind it, and a Review step before anything goes out.",
};

export default function ChaseTodayPage() {
  return (
    <AppShell>
      <div className="flex flex-col gap-5">
        <DemoModeBanner />
        <PageHeader
          kicker="Working queue"
          title="Collections"
          sub="Your ranked chase plan. Each row has a recommended action, the reason behind it, and a Review step before anything goes out."
          actions={<button className="zn-pill zn-pill-ghost">Export</button>}
        />
        <DashboardStats invoices={demoInvoices} />
        <ChaseQueue initialInvoices={demoInvoices} onlyToday={false} />
      </div>
    </AppShell>
  );
}

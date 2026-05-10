import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import { ChaseQueue } from "@/components/chase-queue";
import { DemoModeBanner } from "@/components/demo-mode-banner";
import { PageHeader } from "@/components/page-header";
import { demoCashpilotInvoices as demoInvoices } from "@/lib/demo-data/zentra-demo-data";

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
        <Suspense fallback={null}>
          <ChaseQueue initialInvoices={demoInvoices} onlyToday={false} />
        </Suspense>
      </div>
    </AppShell>
  );
}

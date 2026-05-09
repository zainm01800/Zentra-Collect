import { AppShell } from "@/components/app-shell";
import { ChaseQueue } from "@/components/chase-queue";
import { demoInvoices } from "@/data/demo-invoices";
import { PageHeader } from "@/components/zentra-ui";

export default function ChaseTodayPage() {
  return (
    <AppShell>
      <div className="space-y-8">
        <PageHeader
          title="Chase Today"
          description="Your ranked collections queue. Every item shows the recommended action and why."
        />
        <ChaseQueue 
          initialInvoices={demoInvoices} 
          onlyToday={false} 
        />
      </div>
    </AppShell>
  );
}

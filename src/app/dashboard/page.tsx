import { AppShell } from "@/components/app-shell";
import { ZentraDashboard } from "@/components/zentra-dashboard";
import { getInvoices } from "@/lib/api/db";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Your collections position at a glance — what's changed, what needs you today, and what cash is likely this week.",
};

export default async function DashboardPage() {
  // Fetch from Supabase when a user session exists. Falls back to [] when
  // Supabase is not configured or the user is not authenticated, in which case
  // ZentraDashboard reads localStorage as before.
  const dbInvoices = await getInvoices();

  return (
    <AppShell>
      <ZentraDashboard initialInvoices={dbInvoices.length ? dbInvoices : undefined} />
    </AppShell>
  );
}

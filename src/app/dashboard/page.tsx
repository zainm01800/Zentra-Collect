import { AppShell } from "@/components/app-shell";
import { ZentraDashboard } from "@/components/zentra-dashboard";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Your collections position at a glance — what's changed, what needs you today, and what cash is likely this week.",
};

export default function DashboardPage() {
  return (
    <AppShell>
      <ZentraDashboard />
    </AppShell>
  );
}

"use client";

import { ZentraDashboard } from "@/components/zentra-dashboard";
import { demoInvoices } from "@/lib/demo-data/zentra-demo-data";

export function DemoWorkspace() {
  return <ZentraDashboard initialInvoices={demoInvoices} demoMode />;
}

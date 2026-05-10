import { AppShell } from "@/components/app-shell";
import { PortfolioGate } from "@/components/portfolio-gate";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Portfolio",
  description: "One pane across every client ledger. Spot the ones that need you today.",
};

export default function PortfolioPage() {
  return (
    <AppShell>
      <PortfolioGate />
    </AppShell>
  );
}

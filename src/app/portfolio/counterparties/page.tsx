import { CounterpartiesGate } from "./gate";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Counterparty exposure · Portfolio",
  description: "Cross-ledger view of customers who owe more than one of your clients.",
};

// Gating is delegated to a client component so it reads the same real
// user plan that /portfolio (PortfolioGate) reads — fixes audit issue #2
// where the two routes disagreed on whether the user had access.
export default function CounterpartiesPage() {
  return <CounterpartiesGate />;
}

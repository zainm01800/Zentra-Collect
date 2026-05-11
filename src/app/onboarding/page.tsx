import { FinancialSetupFlow } from "@/components/financial-setup-flow";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Get set up — Zentra Flow",
  description: "Tell us a little about your work so we can set up your workspace.",
};

export default function OnboardingPage() {
  return <FinancialSetupFlow />;
}

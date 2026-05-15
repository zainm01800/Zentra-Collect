import { LatePaymentCalculator } from "@/components/late-payment-calculator";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Late Payment Interest Calculator",
  description:
    "Calculate UK statutory late payment interest and compensation charges under the Late Payment of Commercial Debts Act 1998. For B2B invoices only.",
};

export default function LatePaymentInterestPage() {
  return <LatePaymentCalculator />;
}

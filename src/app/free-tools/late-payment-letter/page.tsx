import { FreeToolShell } from "@/components/free-tools-shell";
import { LatePaymentLetterClient } from "./client";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "UK Late Payment Letter Generator — free template",
  description:
    "Generate a formal late-payment demand letter for an overdue UK B2B invoice, citing the Late Payment of Commercial Debts (Interest) Act 1998. Free, no signup.",
  alternates: { canonical: "/free-tools/late-payment-letter" },
};

export default function Page() {
  return (
    <FreeToolShell
      title="UK Late Payment Letter Generator"
      subtitle="Generate a formal demand letter for an overdue B2B invoice. Cites the Late Payment of Commercial Debts (Interest) Act 1998 and includes the statutory interest figure pre-calculated."
    >
      <LatePaymentLetterClient />
    </FreeToolShell>
  );
}

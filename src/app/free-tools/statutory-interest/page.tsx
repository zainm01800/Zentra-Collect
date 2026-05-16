import { FreeToolShell } from "@/components/free-tools-shell";
import { StatutoryInterestCalculatorClient } from "./client";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "UK Statutory Interest Calculator — free, no signup",
  description:
    "Calculate the statutory late-payment interest and compensation you're legally entitled to under the UK Late Payment of Commercial Debts (Interest) Act 1998. Free, no signup.",
  alternates: { canonical: "/free-tools/statutory-interest" },
};

export default function Page() {
  return (
    <FreeToolShell
      title="UK Statutory Interest Calculator"
      subtitle="Under the Late Payment of Commercial Debts (Interest) Act 1998 you're legally entitled to interest plus a fixed compensation amount on overdue B2B invoices. This calculator does the maths and gives you copy-paste wording."
    >
      <StatutoryInterestCalculatorClient />
    </FreeToolShell>
  );
}

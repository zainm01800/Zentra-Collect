import { FreeToolShell } from "@/components/free-tools-shell";
import { DsoCalculatorClient } from "./client";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Free DSO Calculator — Days Sales Outstanding for UK small businesses",
  description:
    "Calculate your average Days Sales Outstanding (DSO) by pasting a few invoices. Benchmark against UK SMB averages. Free, no signup.",
  alternates: { canonical: "/free-tools/dso" },
};

export default function Page() {
  return (
    <FreeToolShell
      title="DSO Calculator"
      subtitle="Days Sales Outstanding measures how long it takes you to get paid on average. Paste your invoices (paid or open) and we'll calculate it plus benchmark against UK SMB averages."
    >
      <DsoCalculatorClient />
    </FreeToolShell>
  );
}

import { FreeToolShell } from "@/components/free-tools-shell";
import { ChaseEmailClient } from "./client";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Free Chase Email Writer — UK invoice reminder generator",
  description:
    "Generate a copy-pasteable chase email for an overdue UK invoice. Pick the tone, paste invoice details, optionally include statutory interest wording. Free, no signup.",
  alternates: { canonical: "/free-tools/chase-email" },
};

export default function Page() {
  return (
    <FreeToolShell
      title="Chase Email Writer"
      subtitle="Pick a tone, paste the invoice details, get a ready-to-send chase email. Optionally include the statutory interest wording you're legally entitled to under the 1998 Act."
    >
      <ChaseEmailClient />
    </FreeToolShell>
  );
}
